# 小测验 · MySQL 体系结构与一条 SQL 的旅程

共 6 题，满分 100 分，≥ 60 分通过。

### 1. MySQL 8.0 中负责 SQL 解析与优化的是哪一层？

- A. InnoDB 引擎层
- B. Server 层
- C. 连接器
- D. 操作系统页缓存

> 解析：解析、优化、执行以及 binlog 都属于 Server 层；InnoDB 只负责存储、事务与锁。

### 2. redo log 与 binlog 的本质区别是？

- A. redo 是逻辑日志，binlog 是物理日志
- B. redo 是物理日志循环写用于崩溃恢复，binlog 是逻辑日志追加写用于复制与恢复
- C. 两者可以互相替代
- D. binlog 只在事务回滚时写

> 解析：这是 InnoDB 双日志设计的基础，理解后才能解释两阶段提交。

### 3. 两阶段提交主要为了解决什么问题？

- A. 提升更新性能
- B. 保证 redo log 与 binlog 的内容一致，避免主从数据不一致
- C. 减少锁等待
- D. 支持并行复制

> 解析：redo prepare → 写 binlog → redo commit，恢复时按 binlog 是否完整决定提交或回滚。

### 4. 二级索引查询需要回表，原因是？

- A. 二级索引不完整
- B. 二级索引叶子节点存的是主键值，需要再走聚簇索引取整行
- C. MySQL 不允许直接读二级索引数据
- D. 缓冲池太小

> 解析：覆盖索引之所以快，正是因为省掉这次回表。

### 5.（多选）以下哪些写法会导致索引失效或无法用满？

- A. `WHERE phone = 13800000000`（phone 为 varchar）
- B. `WHERE DATE(create_time) = '2026-09-27'`（create_time 有索引）
- C. `WHERE name LIKE '%abc'`
- D. `WHERE a = 1 AND b = 2`（联合索引 `(a,b)`）
- E. `WHERE id IN (1,2,3)`（id 为主键）

> 解析：A 触发隐式转换、B 对列使用函数、C 前置通配无法走 B+ 树前缀；D、E 都能正常命中。

### 6. 生产环境为了尽量不丢事务数据，推荐的参数组合是？

- A. `innodb_flush_log_at_trx_commit=2` 且 `sync_binlog=0`
- B. `innodb_flush_log_at_trx_commit=1` 且 `sync_binlog=1`
- C. 关闭 binlog
- D. 只调大缓冲池即可

> 解析：双一保证 redo 与 binlog 都同步刷盘，性能有代价但一致性最好，是金融级默认要求。

## 答案

1. B
2. B
3. B
4. B
5. ABC
6. B
