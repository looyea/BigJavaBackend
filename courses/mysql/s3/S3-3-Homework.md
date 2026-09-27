# 作业题 · 慢查询治理与 SQL 优化实战

> 作业不判分，做完对照参考答案自查。建议本地 MySQL 8.0 + 一张 500 万行以上的 orders 表（脚本造数即可）。

## 作业 1：慢日志 + pt-query-digest 抓 TOP SQL（必做）

开启 `slow_query_log=1`、`long_query_time=0.5`、`log_queries_not_using_indexes=1`，跑一段混合流量（含一条深分页 SQL），用 pt-query-digest 输出按总耗时排序的 TOP5。

注释说明：为什么按"总耗时"而非"单次最慢"排序；`log_queries_not_using_indexes` 在小表上为什么噪音多。

## 作业 2：深分页优化对比实测（必做）

同一张表分别执行并计时：

```sql
-- 例子目的：实测两种分页写法的量级差距
SELECT * FROM orders ORDER BY id LIMIT 4999980, 20;                          -- 基线：深 OFFSET（预期秒级，扫描 500 万行回表）
SELECT o.* FROM orders o
  JOIN (SELECT id FROM orders ORDER BY id LIMIT 4999980, 20) t ON o.id = t.id;  -- 延迟关联（预期毫秒级：子查询 Using index 不回表）
SELECT * FROM orders WHERE id > 4999980 ORDER BY id LIMIT 20;                -- 书签续页（预期恒定成本，但只能前后翻不能跳页）
```

注释贴出三条的实际耗时与 EXPLAIN 的 key/Extra 差异。

**参考答案要点**：延迟关联快在子查询只扫覆盖索引；书签版连 offset 扫描都没有，但产品形态受限（不可跳页）。

## 作业 3：索引失效改写清单（必做）

找出 3 条失效 SQL（函数包裹、隐式转换、OR 退化），先 EXPLAIN 证明 `type=ALL`，再改写成走索引版本并对比 rows。

注释记录每条的"失效机理 → 改写手段 → 验证结果"。

## 作业 4：分批删除归档脚本（选做）

写脚本删除 `create_time < '2024-01-01'` 的历史行：`DELETE ... ORDER BY id LIMIT 1000` 循环 + 批间 sleep，从库全程监控 `Seconds_Behind_Source` 不飙升；中途 kill 脚本再重启验证可续跑。

**参考答案要点**：巨事务一次性删除会让 binlog 出巨型事件、从库单事务回放数十秒、回滚比执行还久；分批天然可断点续跑（按时间条件幂等）。

## 作业 5：计划突变复盘（选做）

构造统计失真场景（大批删/导入后不 ANALYZE），观察同一 SQL 的 EXPLAIN 从 index 变 ALL；执行 `ANALYZE TABLE` 后恢复。

注释说明：优化器依据什么选索引、"计划突变"线上应如何兜底（FORCE INDEX + 告警 + 定期 ANALYZE 巡检）。
