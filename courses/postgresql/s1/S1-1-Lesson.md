# MVCC 与 VACUUM 机制

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：掌握 PostgreSQL 多版本并发控制的实现细节、元组可见性判断规则、表膨胀成因，以及 autovacuum 调优策略。

## 一、PostgreSQL MVCC 实现原理

### 1.1 与 MySQL MVCC 的根本差异

MySQL InnoDB 用 undo log + ReadView 实现多版本；PostgreSQL 把所有版本存在**同一张表**中——每行是一个物理元组（Tuple），不同事务版本共存于堆表页中。

```text
目的：对比 PG 与 MySQL 的多版本存储策略
PG：堆表内多版本（UPDATE = INSERT 新元组 + 标记旧元组 dead）→ 表膨胀由 VACUUM 回收
MySQL：B+树只保留最新版本 + undo log 链保存旧版本 → 回滚段膨胀由 purge 清理
```

### 1.2 元组头与事务快照

每个数据页内元组头部（HeapTupleHeader）包含：

| 字段 | 作用 |
|------|------|
| xmin | 创建该版本的事务 ID |
| xmax | 删除/更新该版本的事务 ID（0 表示未删） |
| cid | 命令序号（同一事务内多条语句区分） |
| ctid | 自身物理位置（页号+行偏移） |

```sql
-- 目的：查看表的元组存储信息——xmin/xmax/ctid
-- 错误用法: 以为 SELECT 只看到"当前值"，不知道底下有多少死元组
-- 反例: 频繁 UPDATE 一张表后不 VACUUM → 查询性能持续下降
SELECT xmin, xmax, ctid, id, name FROM demo_table WHERE id = 1;
-- 结果：能看到同一 id=1 的多行（不同 ctid），xmin 不同即不同版本
```

### 1.3 可见性判断规则

事务快照（Snapshot）决定某元组对当前事务是否可见：
1. `xmin` 事务已提交且在快照之前 → 可能可见。
2. `xmax = 0` → 未被删除/更新，可见。
3. `xmax` 事务未提交或提交在快照之后 → 仍可见（旧版本）。
4. 否则 → 不可见（对当前事务是"死元组"）。

## 二、表膨胀与 VACUUM

### 2.1 膨胀成因

- **死元组堆积**：UPDATE/DELETE 后旧版本不可见但占空间，无 VACUUM 则永不移除。
- **索引膨胀**：索引条目指向已死 ctid，即使 heap 被 HOT 优化也有残余。
- **长事务/未结束预 prepared transaction**：阻止 xmin horizon 推进，VACUUM 无法清理。

```sql
-- 目的：检测表膨胀率——pg_stat_user_tables
-- 错误用法: 只看 n_dead_tup 绝对值不看比例 → 小表少量死元组也触发 VACUUM 浪费 IO
-- 反例: autovacuum 被关闭后长期不手动 VACUUM → 表大小膨胀 10 倍查询全表扫描
SELECT relname, n_live_tup, n_dead_tup,
       ROUND(n_dead_tup * 100.0 / GREATEST(n_live_tup, 1), 2) AS dead_pct,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 10;
```

### 2.2 VACUUM 工作原理

```flow
目的：展示 VACUUM 的三阶段回收流程
Phase 1：扫描堆页 → 标记死元组的 Line Pointer 为未使用 → 更新 FSM（Free Space Map）
Phase 2：清理索引中指向已回收位置的条目
Phase 3：截断表尾部连续空页归还 OS（需 AccessExclusiveLock）
```

### 2.3 autovacuum 关键参数

```sql
-- 目的：调优 autovacuum 以应对高频 UPDATE 表
-- 错误用法: 全局默认阈值（50 + 10% × 行数）对亿级大表太迟钝
-- 反例: 不调 vacuum_cost_delay → autovacuum 抢走过多 IO 影响在线查询
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.02,     -- 结果：死元组比例 >2% 就触发（默认 20%）
    autovacuum_vacuum_cost_delay = 2,           -- 结果：每轮休眠 2ms 限制 IO 占用
    autovacuum_vacuum_cost_limit = 1000         -- 说明：成本预算调高以加快大表清理
);
```

| 参数 | 默认值 | 建议（高写入表） | 说明 |
|------|--------|------------------|------|
| vacuum_scale_factor | 0.2 (20%) | 0.02 (2%) | 触发阈值比例 |
| vacuum_threshold | 50 | 1000 | 最小死元组数 |
| cost_delay | 20ms | 2~5ms | 单轮休眠 |
| naptime | 60s | 30s | 巡检间隔 |

## 三、事务 ID 回卷与 Freeze

### 3.1 问题本质

PostgreSQL 事务 ID（XID）是 32 位无符号整数，约 21 亿后回卷。MVCC 用"当前 XID - tuple.xmin < 2^31"判断新旧，若长期不 freeze，老元组可能被误判为"来自未来"导致数据不可见。

```sql
-- 目的：检查事务 ID 年龄——离回卷还剩多少事务
-- 错误用法: 等告警才处理 → 数据库拒绝写入
SELECT datname, age(datfrozenxid) AS xid_age FROM pg_database ORDER BY xid_age DESC;
-- 结果：age 接近 20 亿时必须立即 VACUUM FREEZE
-- 说明：PG 默认在 age > 15 亿（autovacuum_freeze_max_age）时强制触发
```

### 3.2 VACUUM FREEZE

- 把老元组的 xmin 标记为"已冻结"（ FrozenTransactionId=2 ），此后不再参与可见性计算。
- 大表 FREEZE 代价极高，建议按分区滚动执行。

## 四、HOT 优化（Heap-Only Tuple）

- UPDATE 时若**未修改索引列**且**页内有可用空间**，新元组不生成索引条目，仅在页内建立版本链。
- 效果：索引不膨胀、VACUUM 更快。
- 调优：`fillfactor = 80`（默认 100）预留页内空间，提高 HOT 命中率。

```sql
-- 目的：设置 fillfactor 提高 HOT 更新比例
-- 错误用法: 所有表都设 fillfactor=70 → 浪费空间，顺序扫描变慢
ALTER TABLE orders SET (fillfactor = 85);  -- 结果：每页预留 15% 空间供 HOT 更新使用
```
