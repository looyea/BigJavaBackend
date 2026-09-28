# 水位线、状态后端与 exactly-once · 面试题

## 题 1：水位线到底是什么？为什么说它是"估计"不是"精确时间"？

- Watermark 是"我声明事件时间大概率已推进到 T，晚于 T 的更早数据视为迟到"的下界估计，通常= 已见最大事件时间 - 允许乱序度。
- 它是估计，因为无法预知未来是否还有更早事件时间的数据到达，所以才有迟到与 allowedLateness。
- 加分：能说明算子对多上游取 min 推进，整体进度受最慢分区决定，这是理解空闲分区卡住的前提。

## 题 2：一个分区没数据，为什么比一个分区数据慢更致命？

- 没数据的分区不再产生新 watermark，基于 min 的整体 watermark 停滞，所有等待它的窗口都不触发。
- 数据慢只是推进慢，仍会前进；完全静默则把事件时间"冻住"，结果长时间不输出。
- 加分：给出解法——`withIdleness` 标记空闲分区使其不参与 min，或用单调发布策略，体现生产排障经验。

## 题 3：HashMap 和 RocksDB 状态后端怎么选？

- 状态小、要极低每条延迟：HashMap 堆内，访问快但受 JVM 堆与 GC 限制。
- 状态大（TB 级）、要增量 Checkpoint：RocksDB 堆外可 spill SSD，容量高但每条要序列化/磁盘 IO。
- 加分：能讲增量 Checkpoint 靠 RocksDB 不可变 SST 只传变化文件，大状态下比全量快照省得多。

## 题 4：Flink 的 Checkpoint 是怎么做到不阻塞数据的一致性快照的？

- 类 Chandy-Lamport 异步屏障：JobManager 注入 Barrier，Barrier 随数据流向下游，算子收齐所有上游 Barrier（对齐）后对当前状态做快照存分布式存储。
- 快照是异步上传，不长时间冻结处理；对齐保证状态切分"恰好一次"。
- 加分：能对比对齐 vs 非对齐 Checkpoint 在反压下的延迟权衡，并区分 Savepoint 的手动可移植用途。

## 题 5：开了 Checkpoint 就等于端到端 exactly-once 吗？

- 不等于。Checkpoint 只保证引擎内状态"恰好一次应用"；端到端还看 Source 可重放、Sink 事务/幂等。
- Source 需可按 offset 回溯，Sink 需 2PC 事务或业务幂等 upsert，缺一即可能重复产出或丢数。
- 加分：给 Kafka 事务 Sink 的具体约束（transactionalId 独立、Kafka 事务超时 ≥ 最大 Checkpoint 间隔、消费端 read_committed）。

## 题 6：2PC Sink 和幂等写入，两种 exactly-once 路线怎么选？

- 2PC 把外部提交绑定到 Checkpoint，精确但对下游事务能力有要求、且延迟受 Checkpoint 间隔影响（未提交数据不可见）。
- 幂等 upsert 靠业务唯一键让"重复写"收敛为同一结果，实现简单、无跨系统事务，适合可去重的目标（如按主键写库）。
- 加分：能指出幂等要求"同一条重放结果一致、可乱序覆盖需带版本"，并说明选型的轴是下游能力与一致性强度。
