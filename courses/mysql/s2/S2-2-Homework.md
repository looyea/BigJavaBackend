# 作业题 · 锁机制与死锁排查

> 作业不判分，做完对照参考答案自查。全部在 MySQL 8.0 InnoDB（RR）上，用两个会话验证。

## 作业 1：间隙锁阻塞插入（必做）

表 `t(id PK, c)`，id 有 5,10,15,20。会话 A：

```sql
-- 例子目的：观察非唯一/范围当前读锁住间隙、阻塞别的事务 INSERT
BEGIN;
SELECT * FROM t WHERE id = 10 FOR UPDATE;   -- 非唯一当前读：锁记录 10 的 Next-Key (5,10] + 右侧 Gap (10,15)
-- 会话B：INSERT INTO t VALUES(12, 'x');   -- 预期被阻塞（落在 (10,15) 间隙）；id=18 不在间隙内不被阻塞
COMMIT;
```

注释记录哪些插入被挡、哪些不挡，画出被锁的间隙范围。

## 作业 2：WHERE 不走索引 → 锁范围爆炸（必做）

给 `t` 加一个无索引列 `name`。会话 A 执行 `UPDATE t SET c=c+1 WHERE name='abc';`（不提交），会话 B 尝试改**另一行**，观察被阻塞。

给 `name` 建索引后重跑，验证锁范围收缩、B 不再被无谓阻塞。注释解释"行锁加在索引上、没索引就锁全部记录"。

## 作业 3：死锁复现与日志解读（必做）

按课程 §五 两会话反向更新 id=1、id=2 造死锁，触发 `ERROR 1213`。执行 `SHOW ENGINE INNODB STATUS\G`，找到 `LATEST DETECTED DEADLOCK` 段。

注释写出：两个事务各持有什么锁、在等什么锁、InnoDB 选择回滚了哪一个、代价判断依据。

## 作业 4：MDL 雪崩复现（选做）

会话 A `BEGIN; SELECT * FROM big_table;` 不提交；会话 B `ALTER TABLE big_table ADD COLUMN x INT;`；会话 C `SELECT * FROM big_table LIMIT 1;` 观察 C 被卡。查 `performance_schema.metadata_locks` 看排队。

**参考答案要点**：A 持 MDL 读锁 → B 等写锁 → C 的读锁排在 B 之后 → 全线阻塞；处理是先杀长事务、DDL 用在线/影子表方式。

## 作业 5：死锁预防改造（选做）

把作业 3 的两段更新改成"都按 id 升序访问"（A、B 都先 update id=1 再 id=2），并发跑，验证不再死锁。

注释说明"固定加锁顺序"如何破坏死锁四条件里的"循环等待"。
