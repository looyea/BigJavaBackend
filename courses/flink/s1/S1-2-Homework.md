# 水位线、状态后端与 exactly-once · 作业

## 作业 1：定位并修复"窗口不出结果"的空闲分区问题

- 目标：复现 watermark 被空闲分区卡住、窗口不触发的现象并解决。
- 任务：构造一个多分区输入，其中一个分区长时间无数据；观察基于 min 的 watermark 停滞、窗口不输出；给每个分区都设 watermark 生成，并加 `withIdleness(Duration.ofSeconds(30))` 修复，对比修复前后输出。
- 验收标准：修复后空闲分区不再拖累整体 watermark 推进、窗口按时触发；能贴出 watermark 推进日志对比；解释为什么"某个分区没数据"比"数据慢"更危险。
- 参考解法要点：watermark 粒度=并行子任务；单调/周期发布策略与 idleness 配合。

## 作业 2：为大状态选后端并度量增量 Checkpoint

- 目标：验证 RocksDB + 增量 Checkpoint 对大状态的收益。
- 任务：做一个 keyed 状态持续增长（如长周期去重）的作业，分别在 HashMap 后端与 `EmbeddedRocksDBStateBackend(true)` 下运行，观测堆内存占用、GC、Checkpoint 大小与耗时随状态增长的变化。
- 验收标准：能展示 HashMap 在状态变大后 Checkpoint 陡增/OOM 风险，RocksDB 增量模式下每次 Checkpoint 只上传变化 SST、大小增长平缓；给出选型结论。
- 参考解法要点：增量依赖 RocksDB 的不可变 SST；小状态低延迟场景 RocksDB 反而更慢，需权衡。

## 作业 3：搭一条端到端 exactly-once 的 Kafka→Kafka 管道

- 目标：把“引擎内 once”落实为“端到端 once”。
- 任务：从 Kafka（可重放，按 offset）读取，做窗口聚合，用 `KafkaSink` 设 `DeliveryGuarantee.EXACTLY_ONCE` 与独立 `transactionalIdPrefix` 写回；配置 Kafka `transaction.max.timeout.ms` ≥ Flink 最大 Checkpoint 间隔；注入 TaskManager 宕机重启，校验下游既不丢也不重（考虑消费端 `isolation.level=read_committed`）。
- 验收标准：故障恢复后端到端计数精确；说明若 Sink 换成 MySQL 普通 insert 会怎样、应如何改用幂等 upsert 达标。
- 参考解法要点：2PC 把 commit 绑定到 Checkpoint 完成；未提交事务对 read_committed 消费者不可见。
