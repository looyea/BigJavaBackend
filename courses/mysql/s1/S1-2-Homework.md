# 作业题 · B+ 树索引与执行计划

> 作业不判分，做完对照参考答案自查。全部在 MySQL 8.0 InnoDB 上验证。

## 作业 1：回表 vs 覆盖索引（必做）

建课程里的 `t_order`，插入 10 万行。分别执行并 `EXPLAIN`：

```sql
-- 例子目的：对比同条件下 SELECT * 回表 与 覆盖索引
EXPLAIN SELECT * FROM t_order WHERE user_id=1001 AND status=2;                 -- 预期 key=idx_user_status、Extra 无 Using index（回表）
EXPLAIN SELECT id, user_id, status FROM t_order WHERE user_id=1001 AND status=2; -- 预期 Extra: Using index（覆盖索引，免回表）
```

注释记录两条 `Extra` 的差异，并解释为什么第二条不回表（查询列全在二级索引叶子里）。

## 作业 2：索引失效现场复现与修复（必做）

对 `idx(create_time)` 分别 `EXPLAIN` 下面两条，观察 `key`：

```sql
EXPLAIN SELECT * FROM t_order WHERE DATE(create_time)='2026-01-01';  -- 预期 key=NULL，函数包裹失效
EXPLAIN SELECT * FROM t_order WHERE create_time >= '2026-01-01' AND create_time < '2026-01-02'; -- 预期 key=idx_create_time
```

注释写出"为什么函数让索引失效"以及区间写法的等价性。

## 作业 3：最左前缀验证（必做）

建 `idx(user_id,status,amount)`，用 `EXPLAIN` 验证 `WHERE user_id=? AND amount>?` 只用到部分索引列，再对照 `WHERE user_id=? AND status=? AND amount>?` 三列全用。

注释总结"等值列放前、范围列放最后"的排布原则。

## 作业 4：主键有序性对写入的影响（选做）

建两张同结构表，一张 `id BIGINT AUTO_INCREMENT`，一张 `id CHAR(36)` 存 UUID，各批量插入 30 万行，记录耗时；用 `SHOW TABLE STATUS` 看 `Data_free` 差异。

注释解释 UUID 随机写导致的页分裂与碎片。

## 作业 5：读懂一次慢查询的 EXPLAIN（选做）

对 `SELECT ... ORDER BY amount DESC LIMIT 20` 观察 `Extra` 是否 `Using filesort`，尝试加 `idx(user_id,status,amount)` 让排序沿索引完成，比较前后。

**参考答案要点**：能让 `ORDER BY` 沿索引顺序取数即消除 filesort；否则额外排序随结果集增大会落盘。
