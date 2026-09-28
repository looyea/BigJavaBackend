# 索引类型与查询优化 · 面试题

## 题 1：PostgreSQL 除了 B-tree 还有哪些索引类型，各解决什么问题？

- GIN 倒排：数组、`jsonb`、全文检索的"包含"查询。
- GiST：几何/范围/近似最近邻，PostGIS 空间检索默认访问方法。
- BRIN：块级稀疏索引，对时序或按列物理有序的大表以极小体积裁剪。
- 加分：还有 Hash（等值）、部分索引、表达式索引，选错类型等于白建。

## 题 2：一张几十 GB 的日志表按时间查询很慢，你会怎么建索引？为什么不是 B-tree？

- 时间列与物理写入顺序高度相关，用 BRIN：每块记录 min/max，裁剪整块，索引体积近乎可忽略。
- B-tree 在大表上体积巨大、维护成本高，而时序场景 BRIN 就能把范围查询裁到极少块。
- 加分：提到 `pages_per_range` 调粒度、若还要按非有序列过滤则配合分区或另建索引。

## 题 3：`WHERE lower(email)=?` 建了 `email` 的 B-tree 为什么没走索引？

- 谓词对列施加了函数，普通 `email` 索引匹配不上表达式，优化器只能全表扫。
- 改建表达式索引 `(lower(email))`，让索引存的正是函数结果。
- 加分：也可统一在写入侧规范化大小写避免函数，或说明部分索引/大小写不敏感 collation 的取舍。

## 题 4：怎么读 `EXPLAIN ANALYZE`？估算和实际行数差很多说明什么？

- 看扫描方式（Seq/Index/Bitmap）、Join 策略（Nested Loop/Hash/Merge）、`rows` 估算 vs `actual rows`、`BUFFERS` 命中。
- 估算与实际差一个数量级：统计过时或列相关性未采集，先 `ANALYZE` 再评估计划。
- 加分：强调 cost 是相对单位不是毫秒，`ANALYZE` 才有真实 `actual time`。

## 题 5：什么是部分索引和表达式索引，各自典型用途？

- 部分索引带 `WHERE` 谓词，只索引满足条件的行，如仅 `status='PAID'`，体积小、可做局部唯一约束。
- 表达式索引对函数/表达式结果建索引，让相应函数谓词能走索引。
- 加分：组合例子（部分+表达式，如 `WHERE deleted_at IS NULL` 上建 `(lower(name))`），说明热数据子集索引的收益。

## 题 6：MVCC 下频繁更新的表，为什么查询计划会"突然变差"？怎么处理？

- UPDATE 产生新元组、旧版本成死元组，autovacuum 跟不上→表/索引膨胀、统计失真，优化器高估成本可能从 Index Scan 改走 Seq Scan。
- 处置：观察 `n_dead_tup`/`last_autovacuum`，`VACUUM ANALYZE` 刷新，长期靠下调热点表 `autovacuum_vacuum_scale_factor`、设 `fillfactor` 预留空间。
- 加分：能联系覆盖索引/索引膨胀（`pg_stat_user_indexes`）与"计划突变"故障复盘。
