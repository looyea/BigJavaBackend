# 小测验 · binlog、redo、undo 与两阶段提交

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. WAL（预写日志）的核心思想是？（15分）

- A. 每次改数据都立刻随机刷数据页
- B. 提交前先把 redo log 顺序落盘，脏数据页稍后由后台慢慢刷；崩溃时用 redo 重做
- C. 只写 binlog 不写 redo
- D. 先写 undo 再写 redo

> 答案：B
> 解析：WAL 用"顺序写日志 + 延迟刷脏页 + 崩溃重做"兼顾性能与持久性。A 是最慢做法，C/D 与 WAL 定义无关。

### 2. "双一"参数指的是哪两个设为 1？（15分）

- A. `innodb_buffer_pool_size` 和 `sync_binlog`
- B. `innodb_flush_log_at_trx_commit=1` 和 `sync_binlog=1`
- C. `max_connections` 和 `sync_binlog`
- D. `innodb_flush_log_at_trx_commit=1` 和 `innodb_lock_wait_timeout`

> 答案：B
> 解析：双一 = redo 每次提交 fsync（`innodb_flush_log_at_trx_commit=1`）+ binlog 每次提交 fsync（`sync_binlog=1`），是机器断电不丢已提交事务的金融级底线。

### 3. 【多选】关于三大日志，正确的有哪些？（20分）

- A. redo log 是 InnoDB 引擎层的物理日志、循环写，用于崩溃恢复
- B. binlog 是 Server 层的逻辑日志、追加写，用于主从复制与归档恢复
- C. undo log 既用于事务回滚，也为 MVCC 提供版本链
- D. 崩溃恢复主要靠 binlog 完成

> 答案：ABC
> 解析：D 错——崩溃恢复靠 **redo log**（WAL 重做），binlog 服务于复制/归档。A/B/C 分别准确描述三大日志的层、类型与用途。

### 4. 判断：两阶段提交中，崩溃恢复时以 redo 是否 commit 为唯一裁决，与 binlog 无关。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：redo 处于 prepare 时，要看**对应 binlog 是否完整**来裁决——binlog 完整则提交、不完整则回滚。因为 binlog 一旦写出就会传给从库，必须以 binlog 为准才不会主从不一致。

### 5. 填空题：redo 保 ______（ACID 哪个字母）、undo 保 ______、binlog 主要用于 ______ 与备份。（15分）

> 答案：持久性 D / 原子性 A / 主从复制

### 6. 为什么 redo 和 binlog 必须两阶段提交？若各写各的、不用 2PC，崩溃后会出现什么问题？（25分）

> 参考答案：
> - redo 属引擎层、binlog 属 Server 层，是两套独立日志，必须保证对同一事务最终状态判断一致
> - 若无 2PC：先写 redo commit、binlog 未写就崩 → 引擎有改动、binlog/从库没有 → 从库丢更新、用 binlog 恢复也丢
> - 反过来先写 binlog、redo 未 commit 就崩 → binlog 有、引擎回滚 → 从库多出一条主库没有的记录
> - 2PC 流程：prepare(写 redo)→写并 fsync binlog→commit(改 redo)；崩溃时 redo=prepare 就以 binlog 完整性裁决（完整提交/不完整回滚）
