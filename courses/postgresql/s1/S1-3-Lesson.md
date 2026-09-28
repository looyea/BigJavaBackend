# 索引类型与查询优化

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：能跳出"什么列都建 B-tree"的惯性，按数据形态给 PostgreSQL 选对索引类型，并用执行计划验证选择是否正确。核心是**索引类型家族**：默认 **B-tree** 胜任等值/范围/排序；**GIN**（倒排）适合数组、`jsonb`、全文检索的"包含"查询；**GiST** 服务几何/范围/近似最近邻（配 PostGIS/pgvector）；**BRIN** 是块级稀疏索引，对时序或天然按某列物理排序的大表以极小体积换取裁剪收益；**部分索引**用 `WHERE` 谓词只索引子集（如仅 `status='PAID'`），既省空间又能承载精准唯一约束；**表达式索引**对函数/表达式结果建索引（如 `lower(email)`、`date_trunc('day',ts)`），让对应写法能走索引。读计划靠 **`EXPLAIN (ANALYZE, BUFFERS)`**：区分 Seq Scan / Index Scan / Bitmap Index+Heap Scan、Join 策略 Nested Loop / Hash / Merge、以及**估算 `rows` 与实际 `rows` 的偏差**——偏差大往往是统计过时或相关列未 `ANALYZE`。理解 MVCC：更新即产生新元组、旧版本成**死元组**，VACUUM/autovacuum 不及时会让表和索引**膨胀**、统计失真，进而让优化器**高估成本错选 Seq Scan**。识破"低选择性列硬建 B-tree""BRIN 用在随机分布列毫无裁剪""函数查询没建表达式索引退化为全扫""大表膨胀后计划突变"等坑。

## 一、按数据形态选索引类型

```sql
-- 目的：按列的真实形态选索引类型，而不是给每列套一个 B-tree
CREATE INDEX idx_orders_tags ON orders USING GIN (tags);            -- 说明：数组/@>/全文这类"包含"查询用 GIN 倒排索引
CREATE INDEX idx_orders_cfg  ON orders USING GIN (cfg jsonb_path_ops); -- 结果：jsonb_path_ops 比默认 ops 更小更快，代价是只支持 @> 含值查询
CREATE INDEX idx_events_ts   ON events USING BRIN (ts) (pages_per_range = 32); -- 说明：时序/按 ts 物理有序的大表用 BRIN，索引体积近乎可忽略
CREATE INDEX idx_users_email_low ON users (lower(email));           -- 结果：表达式索引, 让 WHERE lower(email)=? 能走索引而非退化为全表扫
CREATE UNIQUE INDEX idx_paid_one ON orders (id) WHERE status = 'PAID'; -- 说明：部分索引只覆盖已支付行, 体积小且可表达"局部唯一"约束
-- 反例：给只有 3 个取值、占比接近均匀的选择性极差的 status 建 B-tree ❌ 优化器仍宁走 Seq Scan, 索引白占空间还拖慢写入
```

## 二、读执行计划：估算 vs 实际

```text
图目的：EXPLAIN ANALYZE 里最该盯的三处信号
① 扫描方式: Seq Scan(全表) / Index Scan(逐行回表) / Bitmap Index Scan+Bitmap Heap Scan(乱序大结果集更优)
② Join 策略: Nested Loop(小外层友好) / Hash Join(等值大表) / Merge Join(已排序)
③ rows 估算 vs actual rows: 差一个数量级 → 统计过时或列相关性, 先 ANALYZE 再谈调优; buffers 看是否命中缓存
cost 是相对单位不是毫秒; "Est.(首行) Actual(总)" 只在 ANALYZE 下有真实值
```

## 三、MVCC 膨胀如何扭曲计划

```text
图目的：UPDATE 频繁的大表为什么计划会"突然变傻"
UPDATE 产生新元组版本、旧版本留作死元组(n_dead_tup) → 表/索引膨胀
autovacuum 未及时回收 → pg_class 统计(relpages/n_live_tup)严重偏离真实
优化器按虚高的表大小估成本 → 原本走 Index Scan 的查询改走 Seq Scan(计划突变)
观测: 查 pg_stat_user_tables 的 n_dead_tup / last_autovacuum / last_autoanalyze
手段: 调 autovacuum_vacuum_scale_factor、对热点表单独降阈值; 索引膨胀看 pg_stat_user_indexes
```

## 四、坑与底线

- **先测选择性再建索引**：等值列distinct少、占比高时 B-tree 无效，考虑部分索引或不建。
- **表达式/函数查询配表达式索引**：`WHERE lower(email)=?` 不建 `(lower(email))` 索引就是全表扫。
- **膨胀监控常态化**：`n_dead_tup`、`last_autovacuum` 上告警，别等计划突变才发现 autovacuum 跟不上。

## 五、关联课程

索引读到的行经 MVCC 快照可见性判定，机制承接 [MVCC 与 VACUUM 机制](./S1-1-Lesson.md)；PostGIS/pgvector 的空间与向量索引本质是 GiST/IVFFlat/HNSW，场景见 [扩展生态与选型（PostGIS/pgvector）](./S1-2-Lesson.md)；应用侧 MyBatis 拼出的 SQL 是否命中这些索引，见 [注入原理与预处理防御](../../web-defense/s1/S1-1-Lesson.md)。
