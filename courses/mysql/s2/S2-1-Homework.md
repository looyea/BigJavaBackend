# 作业题 · 事务隔离与 MVCC

> 作业不判分，做完对照参考答案自查。全部在 MySQL 8.0 InnoDB 上，用两个会话（两个终端窗口）验证。

## 作业 1：RC vs RR 的 ReadView 时机（必做）

建 `acct(id, balance)` 插入 `balance=100`。两个会话：

```sql
-- 例子目的：对比 RR 与 RC 下"A 事务两次读之间 B 改了并提交"的结果
-- 会话A                                  -- 会话B
BEGIN;
SELECT balance FROM acct WHERE id=1;      -- 记下值
                                         UPDATE acct SET balance=0 WHERE id=1;
                                         COMMIT;
SELECT balance FROM acct WHERE id=1;      -- RR 仍 100；把 A 会话改 RC 后重跑 → 第二次读到 0
COMMIT;
```

注释记录 RR 与 RC 下第二次读的差异，并解释"ReadView 生成时机"如何造成它。

## 作业 2：更新丢失复现与修复（必做）

建 `goods(id, stock)` 插入 `stock=10`。两会话都用普通 `SELECT stock` 读旧值、各自算 `stock-1` 再 `UPDATE stock=9`，验证两次扣减只减 1。

然后用单条原子写 `UPDATE goods SET stock=stock-1 WHERE id=1 AND stock>=1` 修复，并发跑 20 次扣减验证库存正确减少 20、且不出现负库存。注释说明为什么普通读-改-写会丢、原子 UPDATE 为什么安全（下推判断 + 行锁）。

## 作业 3：FOR UPDATE 当前读串行化（必做）

把作业 2 的扣减改成事务内先 `SELECT stock FROM goods WHERE id=1 FOR UPDATE` 再判断再更新，两会话并发执行，观察后到者**阻塞**直到前者提交。

注释解释 `FOR UPDATE` 与快照读的锁差异。

## 作业 4：长事务钉住 undo（选做）

开一个事务只 `SELECT` 一次不提交，另一会话对同一行连续 UPDATE 多次；用 `SHOW ENGINE INNODB STATUS` 观察事务列表与 undo 历史长度增长。

注释说明"老 ReadView 未释放 → undo 版本链无法回收 → 快照读沿链回溯越来越慢"。

## 作业 5：混用破幻读演示（选做）

RR 下：A 快照读某范围（无目标行）→ B INSERT 一行并提交 → A 对该行做 `UPDATE`（当前读）命中成功 → A 再快照读同一范围，观察"幻影"出现。

**参考答案要点**：一旦该行被 A 当前读写入、`trx_id` 变成 A 自己，就落入 ReadView 规则①可见——证明 RR 幻读防护在快照读/当前读混用时不成立。
