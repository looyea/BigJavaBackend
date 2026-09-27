# 面试题：MVCC 与 VACUUM 机制

## 高频面试题

### Q1：PostgreSQL 的 UPDATE 操作底层做了什么？

**答题要点**：
- 标记旧元组 xmax = 当前事务 ID（逻辑删除），在表内插入新版本元组（xmin = 当前事务 ID）
- 索引同步更新（非 HOT 时所有索引都新增一条指向新 ctid 的条目）
- 旧元组成为"死元组"，占空间但不可见
- WAL 记录两条：旧元组 xmax 变更 + 新元组完整内容

**追问方向**：为什么 PG 不在原地修改而选择"删+插"？（答：MVCC 要求旧版本对其他事务仍可见；原地修改会破坏快照隔离）

### Q2：autovacuum 跟不上写入速度怎么办？

**答题要点**：
- 降低该表的 scale_factor（如 0.02）让触发更灵敏
- 提高 cost_limit 减少 throttle 等待
- 减小 naptime 增加巡检频率
- 增加 autovacuum_max_workers（默认 3）
- 业务低峰手动 VACUUM 辅助
- 根本方案：检查是否有长事务钉住 xmin horizon → 杀掉空闲事务

**追问方向**：如何发现"空闲事务"长时间未提交？（答：`SELECT pid, state, xact_start FROM pg_stat_activity WHERE state = 'idle in transaction' AND now() - xact_start > interval '10 min'`）

### Q3：VACUUM 与 VACUUM FULL 的区别？

**答题要点**：
- 普通 VACUUM：标记死元组空间为可复用，不缩表文件；加 ShareUpdateExclusiveLock 不阻塞读写
- VACUUM FULL：重写整张表，真正缩小文件归还 OS；需要 AccessExclusiveLock 阻塞所有访问
- 日常运维用 autovacuum 即可；FULL 仅在膨胀极端严重时作为最后手段
- PG 14+ 的 `VACUUM (PROCESS_TOAST, PARALLEL 4)` 可加速普通 VACUUM

**追问方向**：如果不能停写，大表膨胀怎么办？（答：pg_repack 在线重建表，不需要 ACCESS EXCLUSIVE 锁）

### Q4：什么是 xmin horizon？为什么它阻止清理？

**答题要点**：
- xmin horizon = 当前所有活跃事务/复制槽/prepared transaction 中最老的快照 xmin
- VACUUM 只能清理"对所有事务都不可见"的死元组：即 xmax < xmin_horizon
- 长事务/废弃复制槽/未清理 prepared transaction 都会钉住 horizon 不前进
- 结果：死元组无法回收 → 表持续膨胀 → 查询变慢

**追问方向**：pg_replication_slots 有一个 abandoned slot 怎么处理？（答：确认下游已废弃后 `SELECT pg_drop_replication_slot('slot_name')`）

### Q5：PostgreSQL 的隔离级别与 MySQL 有何异同？

**答题要点**：
- PG 四种：Read Uncommitted（实际等同 RC）、Read Committed、Repeatable Read（实现为 Snapshot Isolation）、Serializable（SSI）
- MySQL 三种常用：RC、RR（Gap Lock 实现真可重复读）、Serializable
- PG 的 RR 是快照隔离：不加 Next-Key Lock，但可能写偏斜（write skew）
- PG 的 Serializable 基于 SSI 检测读写危险结构，冲突则回滚

**追问方向**：PG 的 RR 会不会出现幻读？（答：快照内不会；但并发写可能导致序列化异常，SSI 级别才会拒绝）

### Q6：如何判断 HOT 是否生效？

**答题要点**：
- `pg_stat_user_tables` 中 `num_tup_hot_upd / num_tup_upd` 即 HOT 比例
- 目标：高频更新表应 > 90%
- HOT 失败原因：1）UPDATE 修改了索引列；2）同页无空间（fillfactor 太高）
- 提高方案：从索引中移除被频繁更新的列；设置 fillfactor 80~90

**追问方向**：为什么 HOT 能减轻索引膨胀？（答：非 HOT 每次 UPDATE 所有索引都新增条目；HOT 只在 heap 链上挂新元组，索引不动）

### Q7：VACUUM FREEZE 什么时候必须做？怎么做对业务影响最小？

**答题要点**：
- 强制触发：age(datfrozenxid) > autovacuum_freeze_max_age（默认 15 亿）
- 手动方案：低峰执行 `VACUUM FREEZE` 或按表 `VACUUM (FREEZE, VERBOSE) table_name`
- 分区表逐分区滚动 FREEZE，避免一次锁全表
- PG 14+ 支持 `VACUUM (BUFFER_USAGE_LIMIT, 10MB)` 限制 IO 冲击

**追问方向**：FREEZE 代价为什么比普通 VACUUM 大？（答：需要扫描所有页判断哪些元组可冻结；普通 VACUUM 只看 FSM 有死元组的页）
