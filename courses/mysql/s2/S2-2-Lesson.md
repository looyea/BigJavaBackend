# 锁机制与死锁排查

> 本节难度：★★★★★
> 本节重要性：★★★★★
> 学习产出：把 InnoDB 的**锁体系**理清——按粒度（全局/表/行）、按模式（共享 S / 独占 X）、按算法（**记录锁 Record、间隙锁 Gap、临次键锁 Next-Key**）三个维度；理解 InnoDB 行锁是**加在索引上**的，所以 **WHERE 没走索引会退化成锁住所有记录（近似锁全表）**；掌握 **MVCC 只在快照读不加锁，一旦当前读（UPDATE/DELETE/SELECT FOR UPDATE）就要加锁**；讲清 **MDL 元数据锁**导致的"一个 DDL 卡住全表、连接池被打爆"的经典事故，以及**在线 DDL / 影子表工具**的规避；最后落到**死锁**的产生四条件、`SHOW ENGINE INNODB STATUS` 里 `LATEST DETECTED DEADLOCK` 的读法，与"固定顺序、缩短事务、走索引"三板斧预防。这一节与 s2-1 的 MVCC 互为表里：s2-1 管"不加锁怎么读"，本节管"要写就得锁、锁多了怎么会死"。

## 一、锁的三个维度（★★★★☆）

```flow
按粒度：  全局锁(FTWRL，做全库逻辑备份) · 表级锁 · 行级锁(InnoDB)
表级锁：  表锁 · 元数据锁(MDL) · 意向锁(IS/IX，让表锁不必逐行探测) ·  AUTO-INC 锁
行级锁：  S 共享读锁(READ) / X 独占写锁(WRITE)；算法：Record / Gap / Next-Key
```

- **S/X 相容矩阵**：S 与 S 兼容，S 与 X、X 与 X 互斥。`LOCK IN SHARE MODE`（8.0 `FOR SHARE`）加 S，`FOR UPDATE`/`UPDATE`/`DELETE` 加 X。
- **意向锁**：事务要加行锁前先在表上加 IX/IS，好让"加表锁"时无需扫描每一行有没有行锁——O(1) 判断冲突。

## 二、行锁的三种算法：Record / Gap / Next-Key（★★★★★）

假设索引上有记录 `5, 10, 15, 20`（"单位区间"用 `(a,b)` 表示不含端点、`[a,b]` 含）：

| 锁 | 锁什么 | 例子 | 作用 |
| --- | --- | --- | --- |
| **Record Lock** 记录锁 | 单条索引记录 | 锁死 `10` | 拦住对这一行的并发写 |
| **Gap Lock** 间隙锁 | 两个记录**之间的间隙**（不含端点） | 锁 `(5,10)`、`(10,15)` | **只拦 INSERT**，不拦按间隙读，用于防幻读 |
| **Next-Key Lock** 临次键锁 | 间隙 + 端点记录的**左开右闭**区间 | `(5,10]` | RR 下当前读的**默认加锁单位**，防幻读 |

```sql
-- 例子目的：看 RR 下一条命中记录的 UPDATE 到底锁了多大范围
-- 索引 id 上有 5,10,15,20
BEGIN;
UPDATE t SET c=c+1 WHERE id=10;   -- 加 Next-Key (5,10] + 记录锁 10 + 右侧 Gap (10,15)（对唯一索引等值命中会优化为仅记录锁）
-- 影响：其他事务 INSERT id=8 或 id=12 会被间隙/临次键锁阻塞；UPDATE id=10 被记录锁阻塞
-- 正确使用结果：范围被锁住 → 别的插入/修改排队 → 当前读不会读到"新冒出的行"（防幻读）
-- 错误用法：以为只锁了 id=10 一行 → 其实锁了 (5,15) 这一片间隙，插入受阻却不知为何
```

> **唯一索引等值命中 → Next-Key 优化为 Record Lock**；**非唯一索引等值命中 → 锁该记录 Next-Key + 右边 Gap**（因为相同索引值可能有多条）。这些是死锁与"莫名插入被阻塞"的根源。

## 三、行锁加在索引上：不走索引 = 锁全表（★★★★★，高频事故）

InnoDB 行锁**本质是锁索引记录**。若 `UPDATE/DELETE` 的 `WHERE` **没用到索引**，引擎无法定位"该锁哪几条索引记录"，只能**沿着聚簇索引把所有记录都加上锁**——近似锁全表，并发瞬间串行化。

```sql
-- 例子目的：复现"WHERE 不走索引导致锁范围爆炸"
-- name 列无索引
BEGIN;
UPDATE t SET c=c+1 WHERE name='abc';   -- 走不了索引 → InnoDB 在聚簇索引全表扫描并对所有行加 Next-Key 锁（效果≈锁全表）→ 别的事务改任意行都阻塞
-- 修复：给 name 建索引，锁范围立即收缩到命中记录附近
-- 错误用法：生产大表跑一条 WHERE 无索引的 UPDATE → 大量行被锁 → 其他事务排队、连接堆积、超时雪崩
-- 正确使用结果：WHERE 命中索引 → 只锁相关记录/间隙，并发写互不干扰
```

## 四、MDL 元数据锁与在线 DDL（★★★★★，经典雪崩）

- 事务**访问一张表时自动加 MDL 读锁**（读写不互斥），**DDL 要加 MDL 写锁**（与所有读写互斥）。
- 事故链：一个**长事务**还在读写该表（持 MDL 读锁）→ 有人执行 `ALTER`（等 MDL 写锁）→ **排在 ALTER 之后的所有新查询**（要 MDL 读锁）也全被这个未完成 DDL 挡住 → **几秒内连接池打满、整库卡死**。

```sql
-- 例子目的：看 DDL 被长事务卡住并连锁阻塞后续查询
-- 会话A：BEGIN; SELECT ... FROM big_table;   -- 长事务持 MDL 读锁、迟迟不提交
-- 会话B：ALTER TABLE big_table ADD COLUMN x INT;  -- 要 MDL 写锁 → 阻塞在 A 之后
-- 会话C：SELECT * FROM big_table LIMIT 1;    -- 要 MDL 读锁，但必须排在 B 的写锁之后 → 也被卡住（雪崩）
-- 正确做法：DDL 前用 SHOW PROCESSLIST / information_schema.innodb_trx 找长事务先杀掉；用在线 DDL 或 pt-online-schema-change / gh-ost 影子表方式，避免长时间持写锁
-- 错误用法：业务高峰期直接 ALTER 大表 → MDL 写锁请求引发后续读写全线排队 → 服务不可用
```

> MySQL 8.0 的 **Online DDL（`ALGORITHM=INPLACE`/`INSTANT`）** 很多变更不重建表、只瞬间改元数据；但仍要注意"哪些操作需要 rebuild、是否全程阻塞写"。大表结构变更优先 **gh-ost / pt-osc** 的影子表 + 灰度切流。

## 五、死锁：产生、检测、排查（★★★★★）

死锁四条件（互斥/持有并等待/不可剥夺/循环等待）在数据库里表现为**交叉加锁**：

```sql
-- 例子目的：构造最经典的"两个事务反向更新两行"死锁
-- 会话A                                  会话B
BEGIN;                                   BEGIN;
UPDATE t SET c=c+1 WHERE id=1;           UPDATE t SET c=c+1 WHERE id=2;   -- A 持锁1、B 持锁2，互不干扰
UPDATE t SET c=c+1 WHERE id=2;           UPDATE t SET c=c+1 WHERE id=1;   -- A 等 2、B 等 1 → 循环等待 → 死锁
-- 结果：InnoDB 死锁检测发现环，代价小的一方(回滚行数少的)被回滚，报
--   ERROR 1213 (40001): Deadlock found when trying to get lock
-- 正确使用结果：应用捕获 1213 后整个事务重试（不是只重试最后一条 SQL）
-- 错误用法：catch 后只重跑那条 UPDATE → 事务已回滚，重跑状态错乱
```

**排查**：`SHOW ENGINE INNODB STATUS` 的 **`LATEST DETECTED DEADLOCK`** 段——会打印两个事务各自"持有哪把锁、在等哪把锁、执行的是什么 SQL"，据此定位交叉加锁的代码路径。

**预防三板斧**：

1. **固定加锁顺序**：所有事务按同一规则（如按主键升序）访问多行/多表，破坏循环等待。
2. **缩短事务**：把无关操作（RPC、发消息、复杂计算）移出事务，减少持锁时间。
3. **让 WHERE 走索引 + 合理索引**：锁范围越小，冲突概率越低（呼应 §三）。

> 参数：`innodb_lock_wait_timeout`（默认 50s，行锁等待超时）；死锁检测 `innodb_deadlock_detect=ON` 让 InnoDB 主动破环（高并发热点行更新时检测本身开销大，可评估改超时策略）。

## 六、动手题

1. 造 §五 死锁，用 `SHOW ENGINE INNODB STATUS` 找到 `LATEST DETECTED DEADLOCK`，画出两个事务的持锁/等锁关系。
2. 复现 §三：无索引列的 UPDATE 让另一会话改任意行都阻塞；加索引后复测。
3. 复现 §四 MDL 雪崩：长事务 + ALTER + 新查询三个会话，观察 `performance_schema.metadata_locks` 里的排队。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 一条 UPDATE 卡住、别的事务全等待 | WHERE 没走索引，行锁扩大成锁全表 |
| DDL 一执行整库连接暴涨 | 长事务持 MDL 读锁 → ALTER 写锁排队 → 后续读写全线阻塞 |
| 偶发 `ERROR 1213 Deadlock` | 多事务交叉更新同一批行，循环等待 |
| INSERT 被莫名阻塞（没撞主键） | 撞上别事务的 Gap/Next-Key 间隙锁 |
| 热点账户/秒杀更新性能骤降 | 大量事务争同一行 X 锁 + 死锁检测开销 |

## 八、关联技术栈

- **向前**：快照读 vs 当前读、ReadView ↔ s2-1；索引与回表 ↔ s1-2
- **后续**：两阶段提交里 binlog 与锁/崩溃恢复 ↔ s3-1；主从延迟下的"读到旧值" ↔ s3-2
- **框架**：`@Transactional` 事务边界过大拉长持锁时间 ↔ spring-core；乐观锁 version ↔ JPA/MyBatis
- **中间件**：高并发扣减前置 Redis 预扣、MQ 削峰 ↔ redis / rocketmq

## 九、本节小结

InnoDB 锁 = **粒度 × 模式 × 算法**。行锁**加在索引记录**上，算法有 **Record（锁记录）/ Gap（锁间隙只拦插入）/ Next-Key（左开右闭区间，RR 当前读默认，防幻读）**；唯一索引等值命中会优化成仅记录锁。**WHERE 不走索引 → 锁全部记录（≈锁全表）**，是并发杀手。**MDL** 让一个 DDL 被长事务卡住、连锁阻塞后续读写 → 用在线 DDL/gh-ost 规避。**死锁**源于交叉加锁的循环等待，`SHOW ENGINE INNODB STATUS` 看 `LATEST DETECTED DEADLOCK`，预防靠**固定加锁顺序 + 缩短事务 + 走索引缩小锁范围**，应用要**整事务重试**。下一节把三大日志 redo/undo/binlog 与两阶段提交串起来——理解"为什么提交要分两步"。
