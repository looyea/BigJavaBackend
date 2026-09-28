# DSL 拓扑与 KStream/KTable · 作业

## 作业 1：把点击流实时累加成"每用户点击计数表"

- 目标：建立 KStream→KTable 的聚合心智。
- 任务：从 `clicks` topic 读事件流，`selectKey` 到 userId，`groupByKey().aggregate()` 累加成计数 KTable，输出到 `user-click-count`（compact）topic；解释每一步是否触发 repartition。
- 验收标准：同一 userId 计数持续累加而非覆盖；输出 topic 为压缩类型只留最新值；能指出 `selectKey` 引入了内部重分区。
- 参考解法要点：聚合产 KTable 语义（按 key 最新），误用 mapValues 只会逐条改值无法累加。

## 作业 2：用流表 join 做订单富化

- 目标：实践最常用的 KStream-KTable join。
- 任务：`orders`(KStream) 与 `user-profile`(KTable，按 userId) 做 join，把用户等级补进订单事件输出 `orders-enriched`；再改成"用 KStream-KStream join 关联支付事件与下单事件"，对比两者状态增长差异。
- 验收标准：流表 join 用对侧最新值、状态可控；流流 join 需窗口且随保留期增长；说明为何维表富化优先流表 join。
- 参考解法要点：join key 必须一致（都按 userId/orderId）；流流保留期要匹配真实事件最大间隔。

## 作业 3：设计带命名 store 的窗口聚合与本地查询

- 目标：让状态可查询、可恢复、有边界。
- 任务：实现"每用户近 10 分钟滑动消费额"聚合，用 `Materialized.as("user-spend-store")` 命名本地 store；通过 Interactive Queries 从外部按 key 读当前窗口值；配置合理的 store 保留/清理避免无界增长。
- 验收标准：store 有明确名称与保留策略；重启能从 changelog 恢复；外部可用只读接口查询最新聚合值；解释 changelog topic 的压缩作用。
- 参考解法要点：本地 RocksDB + compacted changelog 是恢复基础；命名 store 是 Interactive Queries 前提。
