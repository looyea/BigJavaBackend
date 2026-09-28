# DSL 拓扑与 KStream/KTable · 面试题

## 题 1：KStream 和 KTable 有什么区别？同一个 topic 能既是流又是表吗？

- KStream 每条是独立事件（insert-only，不覆盖）；KTable 按 key 保留最新值（变更日志/物化视图，可覆盖）。
- 同一个 topic 用 `stream()` 当事件流、用 `table()` 当"每 key 最新状态"，语义取决于处理方式与是否压缩。
- 加分：能说出 KTable 底层对应 compacted topic，"最新值"靠 key 覆盖得到。

## 题 2：map 和 mapValues 什么时候触发重分区(repartition)？

- mapValues 只改 value、不动 key，不触发重分区；map/selectKey 改了 key 会触发 repartition（KS 内部新建 `*-repartition` topic 再消费）。
- 重分区有网络与 topic 成本，能不改 key 就不改。
- 加分：解释 repartition 存在的必要性——key 变了数据归属分区就得重新 shuffle 才能按新 key 聚合。

## 题 3：要做"订单流补充用户画像"，用哪种 join？为什么？

- 用 KStream-KTable join：事件流按 key 去查 KTable 的最新画像值，是最典型的维表富化。
- 状态只在对侧表（最新值），可控且低延迟；若用 KStream-KStream 则要两侧开窗缓存近期事件，状态随保留期膨胀。
- 加分：点出 join key 必须一致，且流流 join 的窗口保留期要匹配两类事件的真实最大时间间隔。

## 题 4：KTable-KTable join 和 KStream-KTable join 的语义差别？

- KTable-KTable 是"两张最新值表"的连接，一侧更新会重算受影响 key 的结果，结果仍是表（最新视图）。
- KStream-KTable 是每条事件去查表当前值，输出是流（事件驱动）。
- 加分：能说明 GlobalKTable（全分区复制到每实例）适合小维表按非 key 字段关联，体现对表分布的理解。

## 题 5：KS 的本地状态存在哪，故障怎么恢复，扩缩容怎么做？

- 状态用本地 RocksDB State Store，持续备份到压缩的 changelog topic；实例重启从本地 store + changelog 重建。
- 扩缩容通过增/减应用实例触发 rebalance，重新分配 Kafka 分区与对应任务；standby 任务可加速迁移恢复。
- 加分：把 changelog 压缩、standby、rebalance 串成一条"可用性/恢复时间"的权衡链。

## 题 6：为什么"聚合维度"选错会让结果整体不对？怎么用 DSL 避免？

- KS 的分区与聚合都以 key 为准，groupBy 的 key 决定谁被归到一起累加，维度错则统计口径错。
- 若原始 key 不是目标维度，先 `selectKey` 到正确字段再 groupBy/aggregate。
- 加分：能结合 `Materialized` 给命名 store + 保留策略，说明"聚合既要对、又不能状态无界"是生产两要素。
