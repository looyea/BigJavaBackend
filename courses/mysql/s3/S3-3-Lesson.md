# 慢查询治理与 SQL 优化实战

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：建立慢查询治理的**完整闭环**——用**慢日志**（`slow_query_log` / `long_query_time` / `log_queries_not_using_indexes`）+ `pt-query-digest` 找到 TOP 慢 SQL；用**正确姿势读 EXPLAIN**（type / key / rows / filtered / Extra，配合 `ANALYZE TABLE` 修统计）定位慢因；掌握三大高频套路的优化：**深分页**（`LIMIT 大offset` 的"扫描后丢弃"代价 → **延迟关联**与**书签续页**）、**索引失效治理**（呼应 s1-2 逐条复盘 + 排序/分组引发的 `filesort`、`Using temporary`）、**大批量写**（分批提交、`INSERT ... ON DUPLICATE KEY UPDATE`、避免巨事务连带 undo/binlog 膨胀与主从延迟，呼应 s2-2/s3-2）。落点在电商订单列表翻页、对账批量导入等真实场景。

## 一、慢日志：治理的入口（★★★★☆）

优化不能凭感觉，第一手证据是**慢查询日志**——它记录每条执行超过阈值的 SQL 及其耗时、扫描行数。

```sql
-- 例子目的：开启并配置慢日志，让"哪条 SQL 慢、慢在哪"变成可量化的数据
SET GLOBAL slow_query_log = 1;                  -- 打开慢日志开关（正确：线上常开，开销可忽略）
SET GLOBAL long_query_time = 1;                 -- 超过 1 秒记一条（生产常用 0.5~1s；错误：设成 10 会漏掉大量"亚秒但高频"的慢 SQL）
SET GLOBAL log_queries_not_using_indexes = 1;   -- 未走索引的也记（小表噪音多，可配合 min_examined_row_limit 过滤）
-- 正确使用结果：slow log 汇聚出 TOP SQL；再用 pt-query-digest 按总耗时排序：
--   耗时占比最高的一条往往是"订单列表 ORDER BY create_time DESC LIMIT 500000,20"这类深分页
-- 错误用法：只开 general log 不开慢日志 → 日志爆量不敢用，真正的慢 SQL 反而没有聚合统计
```

> 治理闭环：**慢日志 → pt-query-digest 聚类排名 → EXPLAIN 定位 → 改写/加索引 → 回归验证**，并纳入巡检例行（新上线 SQL 先过 explain 审核）。

## 二、EXPLAIN 正确姿势与统计信息（★★★★☆）

```sql
-- 例子目的：读执行计划定位慢因，并处理"计划突变"这一隐蔽坑
EXPLAIN SELECT id, order_no FROM orders
 WHERE user_id = 1001 AND status = 'PAID'
 ORDER BY create_time DESC LIMIT 20;   -- 看四列：type(是否 range/ref 以上)、key(实际用的索引)、rows(预估扫描)、Extra(Using filesort?)
ANALYZE TABLE orders;                  -- 统计信息失真时重新采样（正确：计划突变、rows 估得离谱先想到它）
-- 正确使用结果：若 key=idx_user 且 Extra 无 filesort（存在 (user_id,status,create_time) 联合索引），此 SQL 即最优形态
-- 错误用法：看到 rows 大就加索引 → 低区分度列(status 只有几个值)加了也白加，反而拖累写入
```

```flow
一条慢 SQL 的典型成因链（先看扫多少行，再看排序/回表）
解析优化器选索引 → 定位起点 → 沿索引/全表扫描 rows 行 → 回表取列 → 排序(filesort)/临时表(temporary) → 丢弃 offset 行取 LIMIT
     ↑ 选错索引(统计失真)   ↑ 扫描过大(失效/低区分度)   ↑ 未覆盖(回表放大)   ↑ 无有序索引      ↑ 深分页白扫
```

## 三、深分页：`LIMIT 500000, 20` 为什么慢、怎么治（★★★★★，高频）

InnoDB 的 `LIMIT offset, n` 必须**真正取到第 offset+n 行**再丢掉前 offset 行——offset 越大，白扫白回表的行越多。

```sql
-- 例子目的：两种深分页标准优化（延迟关联 / 书签续页）
-- ① 延迟关联：先在覆盖索引里翻完 offset，只回表 20 行
SELECT o.id, o.order_no, o.amount
  FROM orders o
  JOIN (SELECT id FROM orders WHERE shop_id = 7 ORDER BY id LIMIT 500000, 20) t  -- 子查询只走主键索引、不回表（Using index）
    ON o.id = t.id;                                        -- 外层仅对 20 个主键回表，扫描代价从 50 万行降到 20 行
-- 正确使用结果：耗时从秒级降到毫秒级；适用于"页码可跳"的后台场景
-- ② 书签续页（无限下拉首选）：记住上页末 id，直接定位
SELECT id, order_no FROM orders WHERE shop_id = 7 AND id > 543210 ORDER BY id LIMIT 20;
-- 正确使用结果：每页恒定成本；错误用法：C 端列表暴露可跳页的深 OFFSET → 爬虫翻到十万页把 DB 拖垮（必须限最大页或强制书签式）
```

> 产品侧取舍：搜索引擎式"只给前 100 页"（百度/淘宝做法）本质就是拒绝深 OFFSET——技术优化之外，**约束入口**同样重要。

## 四、索引失效治理：逐条复盘（★★★★☆）

s1-2 的失效场景在慢日志里会以固定面孔反复出现，治理手段是**改写 SQL 适配索引**而非硬加索引：

```sql
-- 例子目的：把三类高频失效写法改写成可走索引的等价形式
SELECT * FROM orders WHERE DATE(create_time) = '2026-09-27';          -- 错误用法：函数包裹列 → idx_create_time 失效，全表扫
SELECT * FROM orders WHERE create_time >= '2026-09-27'
   AND create_time <  '2026-09-28';                                    -- 正确改写：改区间比较，走 range（正确使用结果：rows 从千万降到当日单量）
SELECT * FROM orders WHERE order_no = 1234567890;                     -- 错误用法：order_no 是 VARCHAR 却传数字 → 隐式转换等于列上套函数，索引失效
SELECT * FROM orders WHERE order_no = '1234567890';                   -- 正确改写：类型对齐（Java 侧同理，String 字段勿传 Long）
SELECT * FROM orders WHERE user_id = 1001 OR channel_id = 3;          -- 错误用法：OR 两侧不同索引 → 常退化为全表；改写：
SELECT * FROM orders WHERE user_id = 1001 UNION SELECT * FROM orders WHERE channel_id = 3;  -- 各自走索引再合并（正确使用结果：两段 range/ref）
-- 治理套路：低区分度列不单独建索引；联合索引把等值列放前、范围列放后；OR 改 UNION；函数列改区间；类型对齐；前导 % 改全文索引/ES
```

## 五、排序与分组：filesort / Using temporary（★★★★☆）

- `Extra: Using filesort` 不等于"在文件里排"——先在 `sort_buffer_size` 内排，超限才临时文件；**消除它的正解是让索引天然有序**（联合索引顺序与 `WHERE 等值 + ORDER BY` 对齐）。
- `Using temporary` 多因 `GROUP BY` 与索引顺序不匹配：如 `GROUP BY shop_id ORDER BY SUM(amount)` 无法靠一个索引兼得，大结果集应**预聚合**（汇总表/物化，定时任务算好）。
- 判别口径：`EXPLAIN` 里 `key` 用上了但仍 filesort → 检查 ORDER BY 列是否在联合索引中、方向是否混合（8.0 可用**降序索引** `(a ASC, b DESC)` 解决混合排序）。

## 六、大批量写：分批与幂等（★★★★★，事故高发）

一条 `DELETE 5000 万行` 的"大事务"会同时引爆：**undo 膨胀、锁持有过久（s2-2）、binlog 巨事件、主从延迟（s3-2）、甚至回滚比执行还久**。

```sql
-- 例子目的：归档删除历史订单的安全写法（分批 + 幂等）
DELETE FROM orders_archive
 WHERE create_time < '2024-01-01'
 ORDER BY id
 LIMIT 1000;               -- 每批只删 1000 行（正确：批间 sleep，锁与 binlog 事件都被切碎；错误：不加 LIMIT 一把梭 → 巨事务）
-- 重复执行直到影响行数为 0（正确使用结果：全程无长事务、从库延迟平稳、可随时中断续跑）
INSERT INTO daily_stat (day, shop_id, amt) VALUES ('2026-09-27', 7, 12000)
 ON DUPLICATE KEY UPDATE amt = VALUES(amt);   -- 幂等 upsert：重跑/补数不报错不翻倍（错误用法：普通 INSERT 重跑 → 主键冲突 ERROR 1062，任务中断）
-- 更快形态：超大批量导入走"影子表套路"——建空新表灌数 → RENAME TABLE 原子互换（秒级切换，不锁原表）
```

> 经验阈值：**单事务改动行数控在万级以内**、批量 INSERT 每批 500~1000 行（`rewriteBatchedStatements=true` 让 JDBC 真正合批，否则 MyBatis 批处理只是假批）。

## 七、动手题

1. 构造 500 万行表，实测 `LIMIT 4999980,20` 与延迟关联/书签版的耗时差（预期两个数量级）。
2. 打开慢日志 + `log_queries_not_using_indexes`，跑一段业务流量后用 pt-query-digest 输出 TOP5 并逐条 EXPLAIN 归因。
3. 写一个分批 DELETE 归档脚本（含断点续跑），在从库观察 `Seconds_Behind_Source` 全程不飙升。

## 八、常见线上问题

| 现象 | 根因 | 治理 |
| --- | --- | --- |
| 列表页越翻越慢、第 N 页超时 | 深 OFFSET 扫描后丢弃 | 延迟关联 / 书签续页 / 限制最大页 |
| 昨天飞快的 SQL 今天全表扫 | 统计失真致计划突变 | `ANALYZE TABLE`、必要时 `FORCE INDEX` |
| 加了索引还是慢 | 低区分度列 / 失效写法没改 | 先改写法（区间、类型对齐、UNION）再谈索引 |
| 大 DELETE 期间从库延迟暴涨 | 巨事务 binlog 事件 | 分批 + 批间间歇 |
| 批处理重跑报 1062 | 导入不幂等 | ON DUPLICATE / INSERT IGNORE / 影子表 |
| ORDER BY 大结果集偶发磁盘临时表 | sort_buffer 超限 filesort | 索引给序 / 预聚合 / 调 sort_buffer |

## 九、关联技术栈

- **向前**：索引结构与 EXPLAIN 列解读 ↔ s1-2；锁与事务大小 ↔ s2-2；binlog 事件与主从延迟 ↔ s3-1/s3-2
- **横向**：读多翻页场景最终迁 ES/搜索引擎、Redis 缓存列表首页 ↔ redis s2-1/s2-3；分库分表后跨片分页更难 ↔ 中间件
- **工程**：SQL 上线前 explain 审核纳入 CI、慢日志周报进巡检——治理是**机制**不是一次性优化

## 十、本节小结

慢查询治理是一条流水线：**慢日志发现 → EXPLAIN 归因（type/key/rows/filtered/Extra，统计失真先 ANALYZE）→ 按套路改写 → 回归**。三大高频套路：**深分页**用延迟关联（覆盖索引翻 offset、只回表一页）或书签续页，产品侧限制跳页深度；**索引失效**以改写应战——函数包裹改区间、隐式转换对齐类型、OR 改 UNION，低区分度列不硬建索引；**大批量写**拆小事务（LIMIT 分批 + 幂等 upsert + 影子表互换），护住锁、undo、binlog 与从库延迟。优化之外更要建**机制**：SQL 上线审核与慢日志巡检常态化。
