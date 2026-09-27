# 事务隔离与 MVCC

> 本节难度：★★★★★
> 本节重要性：★★★★★
> 学习产出：把 ACID 里的 **I（隔离性）** 讲透——四种隔离级别分别治哪种并发异常（脏读/不可重复读/幻读）；重点是 **MVCC 多版本并发控制**：每行藏着的 `trx_id`（创建事务版本）+ `roll_ptr`（指向 undo log 版本链），配合事务的 **ReadView（m_ids / min_trx_id / max_trx_id / create_trx_id）**做可见性判断，实现"**快照读不加锁也能读到一致数据**"。搞清 **RC 每条 SELECT 生成新 ReadView、RR 只在事务首次 SELECT 生成一次** 的差别；以及 RR 到底怎么防幻读——**快照读靠 MVCC、当前读靠 next-key lock**，两者都不是万能，经典"先查后改"更新丢失要靠加锁或乐观锁兜底。这是财务对账、订单扣减一致性的地基。

## 一、并发异常与隔离级别（★★★★☆）

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
| --- | --- | --- | --- |
| 读未提交 RU | ✗会 | ✗会 | ✗会 |
| 读已提交 RC | ✓防 | ✗会 | ✗会 |
| 可重复读 RR（MySQL 默认） | ✓防 | ✓防 | 基本防（见下） |
| 串行化 | ✓防 | ✓防 | ✓防（但并发差） |

- **脏读**：读到别事务**未提交**的数据（它可能回滚）。
- **不可重复读**：同事务两次读**同一行**，值变了（被人 UPDATE 并提交）。
- **幻读**：同事务两次读**同一范围**，行数变了（被人 INSERT 并提交，冒出"幻影"行）。

```sql
-- 例子目的：设置/查看隔离级别（InnoDB 默认 RR）
SELECT @@transaction_isolation;                          -- 查看当前会话隔离级别（正确读取方式；错误：MySQL 5 写 @@tx_isolation，8.0 已改名，照抄报 Unknown）
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;  -- 把当前会话改为 RC（影响：本会话之后事务按 RC 语义，每条 SELECT 重新生成 ReadView → 能看到别事务已提交的更新，即"可重复读"被破坏）
-- 正确使用结果：RC 下同一事务两次 SELECT 同一行可能不同（不可重复读）；RR 下两次一致
-- 错误用法：全局改隔离级别却不评估业务→金融对账若误用 RC，同一报表两次快照金额不一致
```

## 二、MVCC 的两大件：隐藏列 + undo 版本链（★★★★★）

InnoDB 每行除了你的列，还有隐藏列：

- **`DB_TRX_ID`**：最近一次修改该行的事务版本号（全局递增的事务 ID）。
- **`DB_ROLL_PTR`**：回滚指针，指向 **undo log** 里该行的上一个版本。

同一行被多次修改，就靠 `roll_ptr` 串成一条**版本链**：

```flow
当前行(trx=80) ──roll_ptr──▶ undo版本(trx=60) ──roll_ptr──▶ undo版本(trx=40) ──▶ ...
                            （一条链存一行数据的历代版本，MVCC 沿链找"对我可见的那一版"）
```

> undo log 一物两用：**回滚**（事务撤销要改回去）+ **MVCC 多版本**（快照读沿版本链回溯）。这是它与 redo log 的根本分工（redo 管崩溃恢复，见 s3-1）。

## 三、ReadView：可见性判断的规则（★★★★★）

事务做快照读时生成一个 **ReadView**，记录"此刻还没提交的那些事务 ID"，据此判断版本链上哪个版本对我可见：

- `m_ids`：生成快照时**活跃（未提交）的事务 ID 集合**。
- `min_trx_id` = m_ids 最小值；`max_trx_id` = 系统将分配的下一个 ID。
- 对版本链上某版本的 `trx_id` 判断：
  1. `trx_id == create_id`（自己改的）→ **可见**。
  2. `trx_id < min_trx_id` → 生成快照前就已提交 → **可见**。
  3. `trx_id >= max_trx_id` → 快照之后才开启的事务 → **不可见**。
  4. `min ≤ trx_id < max` 且在 `m_ids` 里 → 当时未提交 → **不可见**；不在 m_ids → 已提交 → **可见**。
  - 沿版本链一直往旧找，直到碰到第一个可见版本；都不可见则读不到（当作不存在）。

```sql
-- 例子目的：RR 下两个事务交错，理解"快照读看到的是 ReadView 时刻的世界"
-- 会话A                                  会话B
BEGIN;                                   BEGIN;
SELECT balance FROM acct WHERE id=1;     -- ① A 首次快照读，生成 ReadView，看到 balance=100
                                         UPDATE acct SET balance=0 WHERE id=1;  -- ② B 改成 0（尚未提交）
                                         COMMIT;                                -- ③ B 提交
SELECT balance FROM acct WHERE id=1;     -- ④ A 再读，仍是 100——RR 复用①的 ReadView，②③的 trx_id 对 A 不可见
-- 正确使用结果：A 整个事务两次读一致（可重复读），因为它始终认①那张快照
-- 错误用法：期望 A ④能读到 0 → 那是 RC 行为（每条 SELECT 重建 ReadView 才会看见新提交）
```

## 四、RC vs RR 的唯一差别：ReadView 生成时机（★★★★★）

- **RC**：事务中**每条 SELECT 都生成新的 ReadView** → 总能看见"别人已提交"的最新版本 → 不可重复读。
- **RR**：**只在事务第一次快照读时生成一次 ReadView**，之后复用 → 整个事务看到的是同一时刻的世界 → 可重复读。

> 一句话记牢：**隔离级别的差别，本质就是 ReadView 生成频率的差别**。

## 五、RR 到底防住幻读没有？（★★★★★，高频追问）

分两种读：

- **快照读**（普通 `SELECT`）：靠 MVCC + ReadView，同一范围两次读结果一致 → **防住了幻读**。
- **当前读**（`SELECT ... FOR UPDATE` / `LOCK IN SHARE MODE`、`UPDATE`、`DELETE`）：读的是**最新版本并加锁**，RR 下用 **next-key lock（记录锁 + 间隙锁）**锁住范围不让别人 INSERT → 也防幻读。

**但两者混合会破功**：A 快照读看到范围里没有某行 → B INSERT 并提交 → A 若转而做一条**当前读的 UPDATE**命中了新行并成功 → 此时 A 再快照读就能看到那行（因为它现在是 A 自己事务"改过"的、create_id 匹配）。所以 **RR 的幻读防护不是 100%**，需要强一致时用 `SELECT ... FOR UPDATE` 全程当前读，或走串行化。

```sql
-- 例子目的：RR 下"先查后改"经典更新丢失，MVCC 救不了
-- 会话A                                  会话B
SELECT stock FROM goods WHERE id=1 FOR UPDATE;   -- B 也想扣库存
-- 正确：A 用当前读 + 行锁把该行锁住，B 的 FOR UPDATE 会阻塞到 A 提交 → 串行，避免都按旧值算
-- 错误用法：A/B 都用普通 SELECT 读 stock=10，各自 -1 后 UPDATE stock=9 → 两次扣减只减了 1（更新丢失）
-- 修复：UPDATE goods SET stock=stock-1 WHERE id=1 AND stock>=1  (把判断下推到带行锁的单条 UPDATE，原子扣减)
```

## 六、动手题

1. 开两个会话在 RR 下复现"§三"表格：A 两次 SELECT 之间让 B 改并提交，验证 A 读到同一值；再切 RC 验证读到新值。
2. 复现"§五"混合读破幻读：A 快照读→B 插入提交→A 当前读 UPDATE 命中新行→A 再快照读，观察"幻影"出现。
3. 用"先查后改"错误写法造更新丢失（扣库存），再用单条 `UPDATE ... SET x=x-1 WHERE ...` 修复并并发压测。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 报表两次快照金额对不上 | 误用 RC，事务内读到别事务新提交 |
| 并发扣减超卖 / 余额少扣 | "先查后改"更新丢失，未用原子 UPDATE 或 `FOR UPDATE` |
| RR 下仍偶发多出一行 | 快照读与当前读混用，MVCC 防不住该场景幻读 |
| 长事务导致 undo 暴涨、版本链超长读得慢 | 有事务长时间不提交，老 ReadView 钉住 undo 无法回收 |

## 八、关联技术栈

- **向前**：undo/redo 分工 ↔ s3-1；next-key/间隙锁细节 ↔ s2-2
- **横向**：事务传播与 `@Transactional` ↔ spring-core/spring-mvc；乐观锁 version 字段 ↔ java-basics/JPA
- **中间件**：分布式事务隔离与最终一致 ↔ seata；缓存与库一致性 ↔ redis s2-2

## 九、本节小结

隔离性靠 **MVCC**：每行有 `trx_id + roll_ptr` 串成 undo **版本链**，快照读用 **ReadView**（m_ids/min/max/create_id）沿链找第一个可见版本，于是**不加锁也能读到一致快照**。RC 与 RR 的差别只是 **ReadView 生成时机**（每条 SELECT vs 仅首次）。RR 防幻读是**快照读靠 MVCC、当前读靠 next-key lock**，但混用会破功——强一致要么全程当前读要么串行化。**"先查后改"的更新丢失 MVCC 管不了，得靠带行锁的原子 UPDATE 或乐观锁。** 下一节锁机制与死锁排查——当前读加的是什么锁、死锁怎么查怎么防。
