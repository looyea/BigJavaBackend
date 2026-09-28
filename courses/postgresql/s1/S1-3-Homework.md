# 索引类型与查询优化 · 作业

### 作业 1：为一组不同形态的列选对索引类型

- 目标：摆脱"逢列建 B-tree"，按数据形态选 GIN/BRIN/表达式/部分索引。
- 任务：给一张含 `tags text[]`、`cfg jsonb`、`ts timestamptz`（按时间有序大表）、`email`（查询用 `lower(email)=?`）、`status`（低选择性）的表，分别建合适索引；对 `status='PAID'` 的子集建部分唯一索引。用 `EXPLAIN ANALYZE` 逐条验证走索引，并构造一个"给 status 单建 B-tree 却仍 Seq Scan"的反例。
- 验收标准：数组/JSONB 走 GIN、时序走 BRIN、函数谓词走表达式索引、子集唯一走部分索引；能解释为何 status 全量 B-tree 无效。
- 参考解法要点：GIN 用 `jsonb_path_ops`、BRIN 调 `pages_per_range`、表达式索引与谓词函数一致、部分索引带 `WHERE`。

### 作业 2：读懂一份计划并纠正错误估算

- 目标：会用 `EXPLAIN (ANALYZE, BUFFERS)` 定位扫描方式、Join 策略与估算偏差。
- 任务：找一条变慢的查询，打印计划，识别 Seq Scan / Index Scan / Bitmap Scan 与 Nested Loop / Hash / Merge Join；记录估算 `rows` 与实际 `rows` 的差距，执行 `ANALYZE` 后对比计划是否改变。
- 验收标准：能说清当前扫描为何低效；`ANALYZE` 前后行数偏差明显收敛、计划随之优化；区分 cost（相对单位）与 actual time（毫秒）。
- 参考解法要点：行数严重偏离→统计或相关性；大结果集乱序→Bitmap Scan 更优；cost 不等于耗时。

### 作业 3：膨胀对计划的冲击与 VACUUM 处置

- 目标：观察 MVCC 死元组膨胀如何让计划"变傻"，并给出治理闭环。
- 任务：对一张热点表做大批量 UPDATE，周期查询 `pg_stat_user_tables` 的 `n_dead_tup`、`last_autovacuum`、`last_autoanalyze`，观察 `EXPLAIN` 计划从 Index Scan 漂向 Seq Scan；随后手动 `VACUUM ANALYZE` 或下调 `autovacuum_vacuum_scale_factor`，复测计划恢复。
- 验收标准：能展示膨胀前后计划突变、死元组计数变化，以及回收后统计与计划恢复的过程。
- 参考解法要点：`fillfactor` 预留空间缓解热更新膨胀；索引膨胀查 `pg_stat_user_indexes`；长期靠合理的 autovacuum 参数而非一次性手动。
