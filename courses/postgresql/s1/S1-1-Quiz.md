# 小测验：MVCC 与 VACUUM 机制

### 1. PostgreSQL 的 MVCC 多版本数据存储在哪里？（10分）
- A. 独立的 undo log 段
- B. 同一张堆表的多个物理元组
- C. Redo log 中
- D. 单独的 history 表
> 答案：B
> 解析：PG 的 UPDATE 是在同一张表插入新元组并标记旧元组为 dead，所有版本共存于堆表中。

### 2. 元组头中 xmax 字段的含义是？（10分）
- A. 创建该元组的事务 ID
- B. 删除或更新该元组的事务 ID
- C. 元组的物理地址
- D. 元组的版本计数
> 答案：B
> 解析：xmax 记录哪个事务删除/更新了该元组；xmax=0 表示该版本仍是最新的、未被覆盖。

### 3. 以下哪种情况会阻止 VACUUM 清理死元组？（10分）
- A. 表上有 B-tree 索引
- B. 存在长时间未结束的事务持有老快照
- C. 表大小超过 10GB
- D. 开启了 WAL 归档
> 答案：B
> 解析：只要有一个活跃事务的快照能看到该死元组，VACUUM 就不能清理它——xmin horizon 被老事务钉住。

### 4. HOT（Heap-Only Tuple）优化的触发条件是？（多选，10分）
- A. UPDATE 未修改任何索引列
- B. 当前页面有可用空间
- C. 表必须有主键
- D. 事务隔离级别为 READ COMMITTED
> 答案：A、B
> 解析：HOT 要求：1）不修改索引列；2）同页有空间放新元组。与主键和隔离级别无关。

### 5. PostgreSQL 事务 ID 回卷的风险是什么？（10分）
- A. 数据库性能下降
- B. 老元组被误判为"来自未来"导致数据不可见
- C. 磁盘空间耗尽
- D. 连接数超限
> 答案：B
> 解析：XID 32 位循环使用，若不 freeze 老元组，比较逻辑可能判定其为"未来的事务"，导致所有查询看不到这些行。

### 6. autovacuum_vacuum_scale_factor 默认 0.2 的含义是？（10分）
- A. autovacuum 使用 20% 的 CPU
- B. 死元组达到表行数的 20% 时触发 vacuum
- C. vacuum 耗时不超过总时间的 20%
- D. 每次 vacuum 只处理 20% 的死元组
> 答案：B
> 解析：scale_factor=0.2 意味着当 n_dead_tup > 0.2 × n_live_tup 时触发（还有固定 threshold=50 的兜底）。

### 7. 判断："VACUUM FULL 与普通 VACUUM 效果相同，只是速度更快。"（5分）
- A. 正确
- B. 错误
> 答案：B
> 解析：VACUUM FULL 重建整张表（需要 AccessExclusiveLock），能真正缩小表文件并释放空间给 OS；普通 VACUUM 仅标记空间可复用但不归还 OS。

### 8. 以下哪些命令可以查看表膨胀情况？（多选，10分）
- A. SELECT * FROM pg_stat_user_tables
- B. SELECT * FROM pgstattuple('table_name')
- C. SELECT * FROM pg_locks
- D. VACUUM VERBOSE table_name
> 答案：A、B、D
> 解析：pg_locks 查看锁等待，与膨胀无直接关系。pg_stat_user_tables 看死元组数，pgstattuple 精确看空洞率。

### 9. 简答题：PostgreSQL 的 MVCC 与 MySQL InnoDB 的 MVCC 在实现上有何核心区别？各自带来的运维挑战是什么？（15分）
> 参考答案：
> - PG 多版本存在堆表内（UPDATE=INSERT+标记旧行），表会膨胀需要 VACUUM 回收
> - MySQL 当前版本在 B+树中，旧版本在 undo log 链中，需要 purge 线程清理
> - PG 运维挑战：autovacuum 调优、XID 回卷防护、表/索引膨胀监控
> - MySQL 运维挑战：长事务撑大 undo/purge lag、回滚段空间管理、ReadView 在 RR 下的间隙锁

### 10. 简答题：fillfactor 参数如何影响 HOT 更新比例？给出你的调优策略。（10分）
> 参考答案：
> - fillfactor=100（默认）：顺序插入填满页面，后续 UPDATE 无同页空间可放新元组 → HOT 失败
> - 降低 fillfactor（如 85）：预留 15% 空间给 HOT → 减少索引膨胀、加速 vacuum
> - 调优策略：高频 UPDATE 且索引列不变的表设 80~90；纯 INSERT 表保持 100 不浪费空间
> - 注意：fillfactor 对顺序扫描有负面影响（同样数据量占更多页），非更新热表不要盲目降低
