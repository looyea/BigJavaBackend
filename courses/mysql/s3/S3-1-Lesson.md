# binlog、redo、undo 与两阶段提交

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：把 InnoDB 的**三大日志**分工彻底讲清——**redo log**（InnoDB 引擎层、物理、循环写、保证**崩溃恢复/持久性 D**）、**undo log**（引擎层、逻辑、保证**原子性 A + 给 MVCC 供版本链**，呼应 s2-1）、**binlog**（Server 层、逻辑、追加写、保证**归档与主从复制**，呼应 s3-2）。理解 **WAL（Write-Ahead Logging）预写日志**为什么让"乱序写磁盘"既快又安全；`flushLog=innodb_flush_log_at_trx_commit` 与 `sync_binlog` 的 **"双一参数"** 为什么是金融级不丢数据的底线；以及 **redo 和 binlog 是两套独立系统，为什么必须两阶段提交（prepare→写 binlog→commit）** 才能保证两者一致——少这一步，崩溃后要么丢更新要么主从数据打架。这是电商/金融"钱货两清、账实一致"最底层的保障。

## 一、三大日志一张表（★★★★☆）

| 维度 | redo log | undo log | binlog |
| --- | --- | --- | --- |
| 所属层 | InnoDB **引擎层** | InnoDB 引擎层 | **Server 层** |
| 类型 | **物理**（某页做了什么改动） | **逻辑**（反向操作，insert↔delete） | **逻辑**（语句/行变更，statement/row/mixed） |
| 写入方式 | **循环写**（固定大小，覆盖） | 段式，可回收 | **追加写**（不覆盖，可多份归档） |
| 用途 | **崩溃恢复**（断电后重做到最新） | **回滚 + MVCC 版本链** | **主从复制 + 数据恢复/归档** |
| 保证 | 持久性 D | 原子性 A | 复制/备份 |

> 记忆锚：**redo 向前滚（重做）、undo 向后滚（撤销）、binlog 给外面用（从库回放、备份恢复）。**

## 二、WAL：为什么先写日志再写数据页（★★★★★）

随机写磁盘慢，顺序写日志快。**WAL（Write-Ahead Logging）**规定：**事务提交前，只要把 redo log 顺序落盘即可**，真正的数据页（缓冲池里变脏的页）**稍后由后台线程慢慢刷盘**。

```flow
更新流程：改缓冲池页(内存,快) → 同时写 redo(内存 log buffer) → 提交时 redo 落盘(顺序,快)
                        脏页之后由 checkpoint 择机刷盘(慢,可乱序、可合并)
崩溃时：数据页可能还没刷 → 用 redo log 把"已提交但没落盘的改动"重做回来 → 不丢
```

- **没有 WAL**：每次改一行就要把整页随机刷盘 → 极慢。
- **有了 WAL**：顺序写日志 + 崩溃重做 → 又快又不丢（**组提交**进一步把多次 fsync 合并）。

## 三、redo 的三个落盘时机 & "双一"参数（★★★★★，面试+合规刚需）

redo 从 log buffer 到磁盘经历 **write（写到 page cache）+ fsync（刷到磁盘）**，由两个参数控制：

`innodb_flush_log_at_trx_commit`：
- `=1`：**每次提交**都 write+fsync 到 redo → 最安全，机器断电不丢（**金融要求**）。
- `=0`：每秒由后台线程刷，提交不管 → 宕机丢约 1s。
- `=2`：每次提交 write 到 OS page cache、每秒 fsync → mysqld 进程崩不丢、**机器断电丢约 1s**。

`sync_binlog`：
- `=1`：**每次提交** fsync binlog（"双一"的另一个一）。
- `=0`：交给 OS 决定；`=N`：攒 N 事务刷一次。

```sql
-- 例子目的：设置"双一"，金融级不丢数据的底线配置（呼应 s1-1）
SET GLOBAL innodb_flush_log_at_trx_commit = 1;   -- redo 每次提交 fsync（正确：ACID 持久性最强，机器断电不丢已提交事务；错误：设 0/2 换性能→宕机丢约 1 秒事务，金融不可接受）
SET GLOBAL sync_binlog = 1;                       -- binlog 每次提交 fsync（正确：redo 与 binlog 都不丢、主从一致；错误：设为 0/N 提高吞吐→崩溃可能 redo 有、binlog 无，从库丢更新）
-- 正确使用结果："双一"下已提交事务绝不丢失，是电商支付/银行记账的默认底线
-- 错误用法：为了跑分把双一改成 2 + 1000，性能上去了但违反"提交即持久"，故障时账不平
-- 取舍：非核心日志类库可放宽换吞吐；核心资金库必须双一 + SSD + 组提交优化
```

## 四、binlog：三种格式与追加写（★★★★☆）

- **STATEMENT**：记"原始 SQL"（如 `UPDATE ... WHERE ...`）→ 省空间，但**可能主从不一致**（`NOW()`、`LIMIT` 无序等）。
- **ROW**（推荐/默认）：记"每行改成什么"（前后镜像）→ 绝对一致、体积大；**主从复制与数据恢复都靠它**。
- **MIXED**：引擎自动在 statement/row 间切换。

```sql
-- 例子目的：查看/设置 binlog 格式与位置（DBA 与 CDC 都常用）
SHOW VARIABLES LIKE 'binlog_format';        -- 期望 ROW（正确：复制/回档精确一致；错误：STATEMENT 下含不确定函数会让从库算出不同结果）
SHOW MASTER STATUS;                          -- 看当前 binlog 文件名与 position（作用：搭建主从、闪回定位、gh-ost 追增量都从这里开始）
-- 正确使用结果：ROW 格式 + position 可作为"恢复到某时刻"的精确锚点
-- 错误用法：以为 binlog 能当崩溃恢复用 → 崩溃恢复靠 redo；binlog 是 Server 层给复制/归档用的
```

## 五、为什么必须两阶段提交（★★★★★，全节核心）

**问题**：redo（引擎层）和 binlog（Server 层）是**两套独立日志**。如果各写各的、随便一个先提交，崩溃时机不同会导致**两者记录的事务集合不一致**：

- 先写 redo 标 commit、还没写 binlog 就崩 → **引擎有此改动、binlog 没有** → 从库/用 binlog 恢复的库**丢了这条更新**。
- 先写 binlog、redo 没 commit 就崩 → **binlog 有、引擎回滚了** → 从库**多出一条主库没有的记录**。

**两阶段提交（2PC）**让两份日志达成一致，`binlog` 作为"提交与否的裁决标准"：

```flow
1. prepare：InnoDB 把 redo 标记为 prepare 状态（此时 redo 已落盘，但事务未提交）
2. 写 binlog：Server 层把这次事务的 binlog 写入并 fsync（sync_binlog 生效点）
3. commit：拿到 binlog 成功后，InnoDB 把 redo 的 prepare 改为 commit
崩溃判定：redo 是 commit → 提交；redo 是 prepare → 看它对应的 binlog 是否完整——
          binlog 完整(有 commit 标志) → 提交；binlog 不完整 → 回滚。
-- 为什么以 binlog 为准：binlog 一旦写成功就会传给从库，若主库回滚就主从不一致；故"binlog 完整即提交"
```

> **一句话**：两阶段提交用 `prepare/commit` 标志 + "崩溃时以 binlog 完整性裁决"，**保证 redo 和 binlog 对同一事务的最终状态判断一致**——这是 MySQL 主从与备份恢复不出幻数据的根基。

## 六、undo 与原子性、MVCC（呼应 s2-1）

事务每改一行前，先把**旧值写 undo**；回滚时沿 undo 撤销（原子性 A）；快照读时沿 undo **版本链**回溯可见版本（MVCC）。**长事务**会让老的 undo 无法回收 → undo 表空间暴涨、版本链过长拖慢读（呼应 s2-1、s2-2 缩短事务）。

## 七、动手题

1. `SET GLOBAL binlog_format` 在 ROW/STATEMENT 下各执行一条带 `LIMIT` 无 `ORDER BY` 的 UPDATE，观察从库/回档结果是否一致，理解 ROW 的价值。
2. 用 `mysqlbinlog --base64-output=decode-rows -v` 解析一段 ROW binlog，看到前后镜像。
3. 把双一改成就 2/1000，结合压测记录吞吐差异，再说明为何金融库不能这么换。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 主从数据不一致 / 从库丢更新 | `sync_binlog`/`innodb_flush_log_at_trx_commit` 非双一，崩溃时 redo 与 binlog 错位 |
| binlog 撑爆磁盘、复制延迟大 | ROW 格式 + 大批量 UPDATE 产生巨量前后镜像（见 s3-3 分批） |
| 闪回误删数据困难 | 靠 ROW binlog 生成反向 SQL 回滚，需提前开启 + 保留期够 |
| undo 表空间暴涨 | 长事务/大事务钉住旧版本无法回收 |
| 崩溃重启后数据"回来了" | 正是 redo 崩溃恢复在工作（WAL 的功劳） |

## 九、关联技术栈

- **向前**：MVCC 与 undo 版本链 ↔ s2-1；缩短事务 ↔ s2-2；缓冲池 ↔ s1-1
- **后续**：binlog 是主从复制与 CDC 的载体 ↔ s3-2；大批量写的 binlog 压力 ↔ s3-3
- **中间件**：Canal/gh-ost 订阅 binlog ↔ 缓存一致性(redis s2-2)、在线 DDL
- **合规**：双一参数、备份与恢复演练 ↔ 构建运维 / 数据安全

## 十、本节小结

三大日志各司其职：**redo（引擎/物理/循环/WAL 崩溃恢复，保 D）、undo（引擎/逻辑/回滚+MVCC，保 A）、binlog（Server/逻辑/追加/复制归档）**。WAL 用"顺序写日志 + 崩溃重做"换来又快又持久。**双一**（`innodb_flush_log_at_trx_commit=1` + `sync_binlog=1`）是提交即落盘、机器断电不丢数据的金融底线。**redo 和 binlog 是两套系统，必须两阶段提交（prepare→写 binlog→commit），崩溃时以 binlog 完整性裁决**，才能保证引擎与主从不出现"丢了/多了"的错位。下一节主从复制、高可用与备份——binlog 如何在从库回放、MGR/半同步如何选、冷热备份怎么恢复。
