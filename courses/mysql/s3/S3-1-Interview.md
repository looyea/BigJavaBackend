# 实际面试题 · binlog、redo、undo 与两阶段提交

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。三大日志 + 2PC 是"存储引擎必考压轴"，答要能对比 + 讲清崩溃裁决。

## 题 1：redo、undo、binlog 有什么区别？

**期望时长**：2 分钟

**答题要点**：

- **redo**：InnoDB 引擎层、**物理**日志、**循环写**，用于**崩溃恢复**（WAL 重做），保 **持久性 D**。
- **undo**：引擎层、逻辑日志，记录反向操作，用于**回滚（原子性 A）+ MVCC 版本链**。
- **binlog**：Server 层、逻辑日志、**追加写**，用于**主从复制 + 归档恢复**。

**追问链**：崩溃恢复靠哪个？→ redo，不是 binlog；binlog 是给"外面"（从库、备份回放）用的。

## 题 2：为什么要两阶段提交？直接先写 redo 再写 binlog 不行吗？

**答题要点**：

- redo 与 binlog 是**两套独立系统**，若不协调，在"写完一个、没写另一个"时崩溃，会导致两者对同一事务的记录**不一致**。
- 先 redo commit 后崩（binlog 没写）→ 从库/恢复丢更新；先 binlog 后崩（redo 没 commit、被回滚）→ 从库多记录。
- **2PC**：prepare（写 redo）→ 写并 fsync binlog → commit；**崩溃时 redo=prepare 就查 binlog 是否完整**，完整则提交、否则回滚。

**追问链**：为何以 binlog 为准？→ binlog 一旦写成就传给从库，主库若回滚会主从不一致，所以"binlog 完整即视为提交"。

## 题 3：什么是 WAL？`innodb_flush_log_at_trx_commit` 三个值差别？

**答题要点**：

- WAL：提交前只保证 **redo 顺序落盘**，脏页延迟刷盘，崩溃用 redo 重做 → 顺序写换性能 + 不丢。
- `=1`：每次提交 write+fsync，**机器断电不丢**；`=0`：每秒刷，宕机丢约 1s；`=2`：提交 write 到 page cache、每秒 fsync，**进程崩不丢、断电丢约 1s**。

**追问链**：双一是什么、代价？→ `trx_commit=1 + sync_binlog=1`，最安全但每次提交两次 fsync、IOPS 高；靠 SSD + 组提交缓解，金融库必须双一。

## 题 4：binlog 三种格式选哪个？

**答题要点**：

- STATEMENT 记 SQL、体积小，但**不确定函数（rand/now/无序 limit）导致主从不一致**。
- ROW 记**前后镜像**、精确可重放、支持闪回，体积大。MIXED 自动切换。
- 生产推荐 **ROW**（复制一致性 + 数据恢复都靠它）。

**追问链**：ROW 会让大批量 UPDATE 产生巨量 binlog，怎么治？→ 分批提交、错峰，见 s3-3。

## 题 5：误删数据怎么用 binlog 找回？需要什么前提？

**答题要点**：

- 用 ROW binlog 生成**反向 SQL**（DELETE→INSERT、UPDATE 后镜像→前镜像）闪回（binlog2sql/MyFlash 思路）。
- 前提：**binlog=ROW、`binlog_expire_logs_seconds` 保留期够、双一保证已提交的都落盘了**。

**追问链**：为什么双一和闪回有关？→ 若非双一，崩溃时可能有"引擎认为提交但 binlog 没写全"的事务，闪回基线就不完整、对不上账。
