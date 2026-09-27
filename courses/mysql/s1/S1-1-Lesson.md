# MySQL 体系结构与一条 SQL 的旅程

> 本节难度 ★★★☆☆ · 重要性 ★★★★★
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

## 六、动手实验（本机 Docker 即可）

1. 启动 MySQL 8：`docker run -e MYSQL_ROOT_PASSWORD=123456 -p 3306:3306 -d mysql:8.0`
2. 用脚本造 100 万行用户表，分别执行：
   - `EXPLAIN SELECT * FROM t_user WHERE name = 'u100000'`（无索引）
   - 加索引后再次 `EXPLAIN`，观察 `type`、`key`、`rows`、`Extra` 四个字段变化
3. 观察一次更新前后 `SHOW ENGINE INNODB STATUS` 中 redo 相关指标与 `SHOW BINARY LOGS`。
4. 手动 kill -9 mysqld 后重启，观察崩溃恢复日志，理解"未刷盘的脏页如何找回"。

## 七、关联技术栈

- **持久层**：MySQL Connector/J（JDBC 驱动）、HikariCP / Druid 连接池
- **框架层**：MyBatis / MyBatis-Plus、Spring Data JPA、事务传播（Spring TX）
- **中间件**：RocketMQ / Canal（订阅 binlog 做异构同步）、ShardingSphere（分库分表）
- **运维层**：主从复制、MHA / Orchestrator、备份（xtrabackup）、监控（Prometheus mysqld_exporter）
- **诊断**：慢查询日志、performance_schema、`EXPLAIN ANALYZE`
