# 分片算法与跨库查询改写

> 本节难度：★★★★★
> 本节重要性：★★★★★
> 学习产出：掌握 ShardingSphere 标准/复合/Hint 分片算法与归并引擎，能解释跨库分页、ORDER BY、聚合的改写代价并规避广播查询。

## 一、分片算法全景

```text
图目的：一条 SQL 进来后如何被路由——分片键决定算法，算法决定命中库表数。
精准分片（= / IN 分片键）→ 只打 1~k 个分片；    范围分片（BETWEEN）→ 可能打穿多个分片；
无分片键查询 → 广播全部表（最贵的反例，容量规划必须先消灭它）。
标准分片：single/range/hint 三类接口；复合分片：多列共同决定（如 user_id+order_id 取模一致）；
Hint 分片：不进 SQL 解析，调用方塞 HintManager 指定库表 —— 适配强制路由/异地多单元。
结果：算法选型第一原则 = 90% 查询的 WHERE 必带分片键，否则分库意义崩塌。
```

## 二、配置：以内联算法为例

```yaml
# 目的：订单表按 user_id 取模分 4 库、按月份范围分 12 表（基因法思路见下文）
rules:
  - !SHARDING
    tables:
      t_order:
        databaseStrategy:
          standard:
            shardingColumn: user_id           # 说明：主分片键选"最高频查询维度"
            shardingAlgorithmName: order-mod  # 结果：user_id % 4 决定库
        tableStrategy:
          standard:
            shardingColumn: create_time
            shardingAlgorithmName: order-month # 输出：按月建表 202601..202612
    shardingAlgorithms:
      order-mod:
        type: MOD
        props: { sharding-count: 4 }
      order-month:
        type: FORMAT_DATE                       # 说明：yyyyMM 模式匹配物理表后缀
        props: { pattern: "yyyyMM" }
# 错误用法：分片键选 order_id 而列表页永远按 user_id 查 → 每次列表查询广播 48 张表 → 分库成了摆设
```

**基因法**：下单时把 `user_id` 的低位嵌进 `order_id` 尾部（`order_id = seq << 4 | user_id % 4`），使"按订单查"与"按用户查"路由同一分片——跨维度查询代价从广播降到单片，是电商订单库的标配设计。

## 三、改写与归并引擎：SQL 进去以后

```text
图目的：一条跨库 SQL 的三段旅程——解析→改写→归并。
解析：SQL 抽象成语法树，找到分片键值 → 路由结果 [ds0.t_order_202601, ds2.t_order_202603];
改写：t_order → 真实表名；SELECT 列表补归并不需要列（COUNT/ORDER BY 列）；LIMIT 先不换算（见分页）;
归并：多结果集按类型合并 —— 行序归并(ORDER BY)、内存归并(GROUP BY/聚合)、聚合归并(topN)。
结果：中间件"帮你写了跨库的 SQL"，但每一段都在偷性能预算——必须理解归并是内存操作。
```

## 四、跨库分页的深坑

```java
// 目的：看清 ORDER BY 全局分页的真实代价
// SQL: SELECT * FROM t_order ORDER BY create_time LIMIT 10000, 10   （4 个分片）
// 改写后每片执行: LIMIT 0, 10010  → 各拉回 10010 行 → 归并排序取第 10001~10010 行
// 结果：网络与内存放大 (10000+10)×4 ≈ 4 万行只为 10 行输出 —— offset 越深越爆炸
// 错误用法：分库后仍给运营后台开放任意深翻页（LIMIT 100000,n）→ 网关线程池被大结果集拖死
// 正解：游标式分页 WHERE (create_time,id) > (?,?) LIMIT 10 —— 每片只取 10 行，代价恒定
```

## 五、哪些 SQL 不该指望中间件

| 场景 | 行为 | 对策 |
|------|------|------|
| 无分片键等值 | 广播全部表 | 冗余索引表 / Hint 强制路由 |
| 跨库 JOIN | 广播后本地拼或报错 | 绑定表（同分片键）、冗余字段 |
| 分布式事务写多库 | XA/BASe 代价陡增 | 一库一事务设计分片键 |
| ORDER BY+LIMIT 深页 | 归并放大 | 游标分页 |
| COUNT(DISTINCT) 大基数 | 内存归并 | 近似算法/预聚合 |

- **绑定表**：`t_order` 与 `t_order_item` 同按 `order_id` 分片且分片数一致 → JOIN 不笛卡尔展开（说明：路由到同片才能本地 JOIN）。
- **广播表**：字典/汇率小表全库各一份 → JOIN 走本地（反例：把大表设广播 = 存储×分片数翻倍）。

## 六、关联技术

- 与 dist-data 的理论层互补：此处是"路由与归并的组件实战"。
- 下一小节：分布式主键（雪花时钟回拨）、读写分离规则与影子库压测、在线弹性扩容迁移。
