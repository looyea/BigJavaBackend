# MySQL 体系结构与一条 SQL 的旅程

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：能画出从连接器到存储引擎的完整链路，说清 redo log 与 binlog 为什么需要两套日志。

## 一、MySQL 是干什么的

MySQL 是一个 **以 B+ 树聚簇索引为核心的单机事务型关系数据库**，8.0 版本通过 InnoDB 提供 ACID 中的原子性、一致性、持久性与行级锁隔离。它的定位决定了国内后端选型：读多写少、强一致要求、结构化关系建模的业务系统。

理解 MySQL 的关键是 **分层**：Server 层与引擎层职责分明，这决定了"优化什么该找 DBA、什么该改 SQL"。

| 层 | 负责什么 | 典型组件 |
| --- | --- | --- |
| Server 层 | 连接管理、SQL 解析、优化器、权限、缓存、binlog | Connector、Parser、Optimizer、Executor |
| 引擎层 | 数据存储、事务、锁、崩溃恢复 | InnoDB、MyISAM（仅表级锁、无事务） |

## 二、一条查询 SQL 的旅程

```flow
客户端 -> 连接器（认证/权限） -> 查询缓存（8.0.1 起已移除） -> 分析器（词法/语法）
-> 优化器（选索引/决定 join 顺序） -> 执行器（权限再校验/调用引擎接口）
-> InnoDB 存储引擎（缓冲池命中？-> 否则读盘页） -> 结果集回传
```

## 三、一条更新 SQL 的旅程（重点）

```flow
执行器 -> 定位目标页（缓冲池/读盘）-> 内存中修改页 -> 写 redo log（prepare 状态）
-> 写 binlog -> 提交事务 -> redo log 进入 commit 状态
（脏页由后台线程择机刷盘 = WAL 预写日志）
```

### 为什么需要两套日志？

| 日志 | 类型 | 写入时机 | 用途 |
| --- | --- | --- | --- |
| redo log | 物理日志（页的增量） | 事务执行中持续写，循环写 | 崩溃恢复，保证持久性 |
| binlog | 逻辑日志（语句/行变更） | 事务提交时一次性写，追加写 | 主从复制、数据恢复与回档 |

**核心矛盾**：redo log 保证 MySQL 自身不丢数据，binlog 保证副本与其他系统能看到完整变更。两者无法原子提交，于是引入 **两阶段提交**：redo 先 prepare → 写 binlog → redo 再 commit。

崩溃恢复时的判定规则（面试高频）：

- redo 是 commit 状态 → 提交
- redo 是 prepare 且 binlog 完整 → 提交
- redo 是 prepare 但 binlog 缺失 → 回滚

这解释了经典事故：**主库崩溃恢复后从库少数据**，正是 binlog 与 redo 不一致 + 复制基于 binlog 造成的，因此生产必须 `innodb_flush_log_at_trx_commit=1` 且 `sync_binlog=1`（双一）。

## 四、B+ 树索引结构要点

- 三层 B+ 树可支撑约 **2000 万行**（16KB 页、非叶节点存键+指针、叶子节点用双向链表串联支持范围扫描）。
- **聚簇索引**：叶子节点存整行数据，即主键索引。二级索引叶子存的是主键值 → 因此需要 **回表**。
- **覆盖索引**：查询字段全部在索引中，避免回表，是最常用的优化手段。
- **最左前缀**：联合索引 `(a,b,c)` 支持 `a` / `a,b` / `a,b,c` 查询，跨列或跳过 a 则无法用满。
- 主键尽量短且单调递增：过长使二级索引膨胀，随机（如 UUID）导致页分裂与碎片。

## 五、特别注意点（现场事故高发）

1. **`utf8mb4` 与索引长度**：一个字符最多 4 字节，`varchar(255)` 建索引可能触达 767/3072 字节上限，需前缀索引。
2. **隐式类型转换导致索引失效**：字段是 varchar，条件写 `where phone = 13800000000` 会走全表扫描（数字比较触发 CAST）。
3. **函数与运算使索引失效**：`where date(t) = '2026-09-27'` 应改写为区间条件。
4. **`count(*)` 不等于 `count(列)`**：后者不统计 NULL；`count(1)` 与 `count(*)` 性能基本一致，MySQL 会优化到最小的二级索引树扫描。
5. **大表 DDL**：8.0 的 `ALGORITHM=INSTANT` 只适用于加列等少数场景，其余需 `pt-online-schema-change` / `gh-ost`。

## 六、例子：建表、索引生效与失效、两阶段提交配置（正确用法与错误用法）

```sql
-- 例子目的：用真实 DDL/DML 展示主键选型、覆盖索引避免回表、两类典型索引失效，以及双一配置
-- 建表：主键用单调递增 BIGINT（正确使用结果：页分裂少、碎片低；错误用法：主键用 UUID → 随机写导致页分裂与二级索引膨胀）
CREATE TABLE t_user (
  id     BIGINT PRIMARY KEY AUTO_INCREMENT,       -- 聚簇索引，叶子存整行
  name   VARCHAR(64)  NOT NULL,
  phone  VARCHAR(20)  NOT NULL,
  ctime  DATETIME     NOT NULL,
  KEY idx_name (name)                             -- 二级索引，叶子存的是主键值→命中后需回表
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;          -- utf8mb4：一个字符最多 4 字节（错误用法：对 varchar(255) 整列建索引可能触达 3072 字节上限）

-- 覆盖索引（正例）：查询列全在 idx_name 里，Extra 显示 Using index，免回表
EXPLAIN SELECT id, name FROM t_user WHERE name = 'u100000';  -- 正确使用结果：type=ref、Extra=Using index
SELECT * FROM t_user WHERE name = 'u100000';                 -- 错误对照：SELECT * 取未入索引列→需回表，Extra 无 Using index

-- 隐式类型转换使索引失效（错误用法）：phone 是 varchar 却用数字比较→触发 CAST→全表扫描
SELECT * FROM t_user WHERE phone = 13800000000;   -- 错误结果：type=ALL 全表扫描
SELECT * FROM t_user WHERE phone = '13800000000'; -- 正确用法：加引号与列类型一致→可走索引

-- 函数/运算使索引失效（错误用法）：对索引列套函数→无法用 B+ 树定位
SELECT * FROM t_user WHERE DATE(ctime) = '2026-09-27';            -- 错误：type=ALL
SELECT * FROM t_user WHERE ctime >= '2026-09-27' AND ctime < '2026-09-28'; -- 正确：改写成区间→可走 ctime 索引
```

```sql
-- 例子目的：两阶段提交的持久性开关——生产必须"双一"，否则崩溃恢复后主从可能不一致（丢 binlog）
-- 正确使用结果：redo 与 binlog 每事务都落盘，宕机不丢已提交事务
SET GLOBAL innodb_flush_log_at_trx_commit = 1;   -- 1：每事务刷 redo（错误：设 2/0 性能好但宕机可能丢 1 秒事务）
SET GLOBAL sync_binlog = 1;                       -- 1：每事务刷 binlog（错误：设 0 由 OS 决定→主从回档时从库少数据）
-- 错误用法：只开双一之一 → 仍可能出现 redo/binlog 不一致，恢复时误判回滚/提交
```

## 七、动手实验（本机 Docker 即可）

1. 启动 MySQL 8：`docker run -e MYSQL_ROOT_PASSWORD=123456 -p 3306:3306 -d mysql:8.0`
2. 用脚本造 100 万行用户表，分别执行：
   - `EXPLAIN SELECT * FROM t_user WHERE name = 'u100000'`（无索引）
   - 加索引后再次 `EXPLAIN`，观察 `type`、`key`、`rows`、`Extra` 四个字段变化
3. 观察一次更新前后 `SHOW ENGINE INNODB STATUS` 中 redo 相关指标与 `SHOW BINARY LOGS`。
4. 手动 kill -9 mysqld 后重启，观察崩溃恢复日志，理解"未刷盘的脏页如何找回"。

## 八、关联技术栈

- **持久层**：MySQL Connector/J（JDBC 驱动）、HikariCP / Druid 连接池
- **框架层**：MyBatis / MyBatis-Plus、Spring Data JPA、事务传播（Spring TX）
- **中间件**：RocketMQ / Canal（订阅 binlog 做异构同步）、ShardingSphere（分库分表）
- **运维层**：主从复制、MHA / Orchestrator、备份（xtrabackup）、监控（Prometheus mysqld_exporter）
- **诊断**：慢查询日志、performance_schema、`EXPLAIN ANALYZE`
