# B+ 树索引与执行计划

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：理解 InnoDB 为什么用 **B+ 树**（矮胖、叶子双向链表、磁盘 I/O 少）而不是哈希/二叉/B 树/跳表；分清**聚簇索引（叶子存整行）与二级索引（叶子存索引列 + 主键）**，由此推出**回表**、**覆盖索引**、**主键选择要短且递增**；掌握**最左前缀**、索引失效的典型场景，并能读懂 `EXPLAIN` 的 `type / key / rows / filtered / Extra`——尤其是 `Using filesort`、`Using temporary`、`index_condition_pushdown` 这些性能信号。落点在电商订单查询、金融流水检索的真实取舍。

## 一、为什么是 B+ 树（★★★★☆）

一个 3 亿行的表若做全表扫描就是灾难；索引的本质是**用一份有序、矮胖的辅助结构，把"扫描 N 行"变成"定位 O(log N) 个磁盘页"**。

```flow
B+ 树：非叶子节点只存"键 + 子页指针"(不存数据) → 一页能放更多键 → 树更矮
      叶子节点存数据、且用双向链表串起来 → 范围查询顺着链表扫，无需回到根
      3~4 层就能支撑千万级行(每页 16KB、每层数百分支) → 主键点查约 3~4 次页访问
```

对比：哈希等值 O(1) 但**不支持范围/排序**；二叉/红黑树太高、I/O 多；B 树非叶子也存数据 → 更胖更浅的 B+ 胜出；跳表是内存结构（Redis 用），磁盘页不如 B+ 省 I/O。

## 二、聚簇索引 vs 二级索引，回表与覆盖（★★★★★）

- **聚簇索引**：叶子节点存**整行记录**，InnoDB 表就是一个按主键组织的 B+ 树。**没有主键**则选第一个非空唯一索引，再没有就隐式生成。
- **二级（辅助）索引**：叶子存**索引列的值 + 对应行的主键**，不含整行。

**回表**：走二级索引找到主键后，**再拿主键回到聚簇索引取整行**——两次 B+ 树查找。

```sql
-- 例子目的：用一张电商订单表演示"回表"与"覆盖索引"的差别
CREATE TABLE t_order (
  id          BIGINT PRIMARY KEY,            -- 聚簇索引：叶子存整行
  user_id     BIGINT   NOT NULL,
  status      TINYINT  NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  create_time DATETIME NOT NULL,
  KEY idx_user_status (user_id, status)      -- 二级索引：叶子存 (user_id,status,id)
) ENGINE=InnoDB;

-- 情况①：需要 col 未在索引里 → 命中二级索引后仍要"回表"取整行
SELECT * FROM t_order WHERE user_id = 1001 AND status = 2;   -- 走 idx_user_status 定位 id，再逐条回聚簇索引取整行（Extra 无 Using index，有回表 I/O）

-- 情况②：查询列全在索引里 → 覆盖索引，无需回表
SELECT id, user_id, status FROM t_order WHERE user_id = 1001 AND status = 2; -- 二级索引叶子已含这三列，直接从索引返回（Extra: Using index = 覆盖索引，省掉回表，明显更快）
-- 正确使用结果：②比①少一整轮回表磁盘 I/O；高频报表/列表查询应把常用列"覆盖"进联合索引
-- 错误用法：为省事对每个查询都 SELECT * → 永远无法命中覆盖索引、被迫回表；大宽表尤其致命
```

> **主键要短**：每个二级索引叶子都额外存主键，主键越长、所有二级索引越臃肿。**主键要递增**：随机主键（如 UUID）插入会让 B+ 树频繁**页分裂**、写放大、碎片多 → 电商订单更宜用"趋势递增"的雪花 ID 而非无序 UUID。

## 三、联合索引与最左前缀（★★★★★）

`idx(a,b,c)` 是一棵**先按 a、再按 b、再按 c** 排序的树。查询必须**从最左列开始、连续**才能用到：

```sql
-- 例子目的：判定 idx(user_id,status,amount) 在各种 WHERE 下能否走索引
WHERE user_id=? AND status=? AND amount>?  -- ✅ 结果：三列全用（范围列 amount 之后不再排序，但三列都参与过滤）
WHERE user_id=? AND status=?               -- ✅ 结果：用到最左两列
WHERE user_id=?                            -- ✅ 结果：只用最左一列
WHERE status=? AND amount>?                -- ❌ 错误用法：缺最左 user_id → 结果用不上该索引（优化器可能改用 index skip scan，但别指望）
WHERE user_id=? AND amount>?               -- ⚠️ 结果：只用到 user_id 一列；中间的 status 缺失，amount 无法作为索引排序条件继续用（可 ICP 过滤，但扫的行多）
-- 正确使用结果：条件顺序由优化器重排，真正决定的是"是否覆盖最左连续前缀"
-- 错误用法：以为建了 (a,b,c) 就能单查 c；或范围条件放中间导致后续列失效（应把等值列放前、范围列放最后）
```

## 四、索引失效的高频场景（★★★★★，呼应 s1-1）

```sql
-- 例子目的：逐一复现"索引明明建了却不走"的元凶
WHERE amount + 100 > 500;                  -- ❌ 错误用法：索引列上做运算 → 结果无法用索引（改写为 amount > 400）
WHERE user_id = '1001';                     -- ❌ 错误用法：隐式类型转换（列是 BIGINT 却传字符串）→ 相当于对列套函数，索引失效
WHERE create_time >= '2026-01-01';          -- ✅ 结果：走索引；但对比下一行
WHERE DATE(create_time) = '2026-01-01';     -- ❌ 错误用法：列外包函数 → 失效（改区间：>= 当天 且 < 次日）
WHERE name LIKE '%abc';                     -- ❌ 错误用法：前导 % 无法用 B+ 排序（LIKE 'abc%' 才行）
WHERE status != 1;                          -- ⚠️ 结果：选择性差或需扫大量行时，优化器直接全表扫描更划算
OR 连接非索引列                              -- ❌ 错误用法：OR 两侧有一个没索引 → 结果整体退化为全表扫
-- 正确使用结果：让条件"裸列 + 等值/范围 + 类型匹配"，索引才生效
-- 错误用法：想当然给失效列"再加个索引"，实为写法问题；先用 EXPLAIN 确认 key=NULL 再改 SQL
```

## 五、读懂 EXPLAIN（★★★★☆，实战刚需）

```sql
-- 例子目的：用 EXPLAIN 看一条订单查询到底怎么走
EXPLAIN SELECT id, amount FROM t_order
 WHERE user_id = 1001 AND status = 2        -- 等值两列命中 idx_user_status 最左前缀（预期 type=ref、key=idx_user_status、rows ≈ 该用户单量）
 ORDER BY amount DESC LIMIT 20;             -- amount 不在索引序里 → 预期 Extra: Using filesort（需额外排序）
-- 正确使用结果：先看 key 是否非 NULL、rows 量级、Extra 有无 filesort/temporary，三项齐了才能判断"这条 SQL 优不优"
-- 错误用法：只盯 key 非空就宣布优化完成 → 慢因常藏在 Extra 的 filesort/temporary 与 rows 白扫量里
```

| 字段 | 含义 | 危险信号 |
| --- | --- | --- |
| `type` | 访问类型，从好到差：`system>const>eq_ref>ref>range>index>ALL` | 出现 **ALL（全表扫描）**、`index`（扫全索引）要警惕 |
| `key` | 实际用到的索引 | **NULL = 没走索引** |
| `rows` | 预估扫描行数 | 远大于返回行数 = 白扫 |
| `filtered` | 过滤后剩余百分比 | 越低说明条件越没帮上筛选 |
| `Extra` | 附加信息 | `Using filesort`（额外排序）、`Using temporary`（临时表）是慢因；`Using index`=覆盖索引（好）；`Using index condition`=ICP（好） |

> `ORDER BY ... LIMIT` 若能沿索引顺序取数就免排序；否则出现 **Using filesort**——大结果集排序会落盘，是深分页慢查询元凶之一（见 s3-3）。

## 六、动手题

1. 建 `t_order` 并插入 10 万行，分别 `EXPLAIN` 走覆盖索引与 `SELECT *` 回表两条 SQL，对比 `rows` 与 `Extra`。
2. 造 `WHERE DATE(create_time)=...` 失效场景，改成区间写法，用 `EXPLAIN` 确认 `key` 从 NULL 变回索引。
3. 用 UUID 主键 vs 递增 BIGINT 主键各灌 50 万行，比较插入耗时与 `SHOW TABLE STATUS` 的碎片。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 建了索引却不走 | 列上运算 / 隐式转换 / 函数包裹 / 前导 % / 缺最左列 |
| 二级索引查询慢 | 大量回表，改覆盖索引或减少 SELECT 列 |
| 插入越来越慢、表膨胀 | 随机主键（UUID）导致页分裂，改趋势递增主键 |
| `ORDER BY` 大结果集很慢 | Using filesort 落盘，借索引顺序或先缩小驱动集 |

## 八、关联技术栈

- **向前**：InnoDB 体系/缓冲池 ↔ s1-1；深分页与慢查询治理 ↔ s3-3
- **横向**：MVCC 读与索引关系 ↔ s2-1；索引变更的在线 DDL ↔ s2-2
- **分布式**：分库分表后单表索引导航 ↔ shardingsphere；雪花 ID ↔ 分布式 ID 专题

## 九、本节小结

InnoDB 索引就是**一棵矮胖的 B+ 树**：聚簇索引叶子存整行、二级索引叶子存"列值 + 主键"，所以走二级索引取非索引列必然**回表**——把高频列纳入**覆盖索引**可省掉这轮 I/O。**联合索引吃最左连续前缀、范围列要放最后**；**列上运算/隐式转换/函数包裹/前导 % 会让索引失效**。`EXPLAIN` 里重点盯 `type=ALL`、`key=NULL`、`rows` 虚高、`Using filesort/temporary`。主键**短且递增**既省空间又避免页分裂。下一节事务隔离与 MVCC——理解"快照读"如何不加锁也能看到一致数据。
