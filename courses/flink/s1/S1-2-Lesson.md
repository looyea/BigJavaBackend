# 水位线、状态后端与 exactly-once

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能讲清水位线（Watermark）如何作为"事件时间进度"的估计在多分区下取 min 推进、空闲分区为何会卡住窗口及其对策；区分状态后端（HashMap 堆内 vs RocksDB 堆外）的取舍与增量 Checkpoint；理解 Flink 端到端 exactly-once 的两块基石——Chandy-Lamport 快照式 Checkpoint 与两阶段提交（2PC）Sink，并识破"Source 不可重放/Sink 非幂等却宣称 exactly-once""水位线设在单分区导致整体停滞"等事故。

## 一、水位线：谁在推进、为什么卡住

```text
图目的：水位线是"我认为了不起于这个事件时间"的下界声明
每个并行 Source/分区各自生成 watermark = 观察到的最大事件时间 - 允许乱序度
算子收到多个上游的 watermark 时取 min 向前推进 → 整体进度=最慢分区的进度
窗口在 watermark ≥ 窗口结束 时才触发计算
空闲分区：某 Kafka 分区长时间无数据，不再推进 watermark → 取 min 后全链路卡住、窗口不出结果
```

```java
// 目的：给多分区流设定乱序容忍，并处理空闲分区
WatermarkStrategy.<EventLog>forBoundedOutOfOrderness(Duration.ofSeconds(5))   // 结果：各分区按自身最大时间-5s 推进
    .withTimestampAssigner((e, ts) -> e.getOccurTime())
    .withIdleness(Duration.ofSeconds(30));                                     // 说明：30s 无数据则标记空闲，不再拖住 min
// 反例：只在一个分区生成 watermark，其余分区不打 ❌ 取 min 永远停在无戳分区，窗口全部不触发
// 反例：乱序度设 0 追求"绝对准时" ❌ 真实网络必有乱序，微小迟到即被丢弃，统计偏低
```

- 对策要点：所有分区都要产 watermark；用 `withIdleness` 或单调流策略避免空闲拖累；水位线粒度=并行子任务。

## 二、状态后端：状态放哪，决定容量与恢复

```text
图目的：状态存储位置是"快而小"还是"大而稳"的取舍
HashMapStateBackend：状态放 JVM 堆内，快、容量受内存限制，适合小状态/低延迟
EmbeddedRocksDBStateBackend：状态放堆外 RocksDB（可 SSD），能撑超大状态、支持增量 Checkpoint
Checkpoint 时把状态快照持久化到分布式存储（HDFS/S3），故障时从此恢复
```

```java
// 目的：为超大 keyed state 选 RocksDB + 增量 Checkpoint
env.setStateBackend(new EmbeddedRocksDBStateBackend(true));   // 结果：true 开启增量 checkpoint，只传变化的 SST 文件
cfg.setCheckpointStorage("hdfs://.../chk");                   // 说明：快照落分布式存储，独立于本地盘
// 反例：TB 级窗口状态用 HashMap 后端 ❌ 堆内存溢出、频繁 Full GC、Checkpoint 巨大且慢
// 反例：小状态高频作业强上 RocksDB ❌ 序列化/磁盘 IO 反而增加每条处理延迟
```

## 三、Checkpoint：一致性快照怎么来

```text
图目的：Flink 用类 Chandy-Lamport 异步屏障快照，不阻塞数据处理
JobManager 向 Source 注入 Barrier，Barrier 随数据流向下游流动
算子收到所有上游 Barrier（对齐）后，把当前状态做一次快照存到 Checkpoint 存储
Barrier 对齐=各输入通道等齐再快照，保证"恰好一次"的状态切分（非对齐模式换低延迟有代价）
```

- Checkpoint 间隔、超时、最小间隔、失败容忍次数共同决定"恢复点新鲜度"与运行开销。
- Savepoint 是手动触发的、用于版本升级/迁移的可移植快照。

## 四、端到端 exactly-once：2PC Sink

```text
图目的：引擎内 once ≠ 端到端 once，取决于 Source 可重放 + Sink 事务
引擎内：Checkpoint 保证状态"恰好一次应用"（故障重放同一段）
Source 侧：需可重放（Kafka 按 offset 回溯）才能重来不丢不重
Sink 侧：外部系统要幂等，或用两阶段提交把 Sink 写入与 Checkpoint 绑定
```

```java
// 目的：Kafka 事务型 Sink 实现端到端 exactly-once
KafkaSink<String> sink = KafkaSink.<String>builder()
    .setDeliveryGuarantee(DeliveryGuarantee.EXACTLY_ONCE)   // 结果：Checkpoint 完成才 commit 事务
    .setTransactionalIdPrefix("flink-")                      // 说明：每并行子任务独立事务 ID
    .setKafkaProducerConfig(props).build();
// 反例：Sink 到 MySQL 用普通 insert 却开 EXACTLY_ONCE ❌ 无事务/幂等键，故障重放即重复写入
// 反例：Kafka 事务 max.timeout.ms < Flink 最大 Checkpoint 间隔 ❌ 事务超时被中止，产出丢失或重复
```

- 幂等替代：给业务唯一键做 upsert，也能达到"效果上的 exactly-once"，比 2PC 更简单。

## 五、关联课程

窗口/迟到与水位线的关系起点见 [流处理模型、窗口与事件时间](S1-1-Lesson.md)；把变更日志经 Kafka 中转落湖仓的事务写入见 [CDC、数据管道与流批一体](S1-3-Lesson.md)；事务型 Sink 依赖的 Kafka 幂等/事务与位移管理见 [分区、副本与 ISR 机制](../../kafka/s1/S1-1-Lesson.md)；与库式 exactly-once 的对比见 [与 Kafka Streams 选型（关联）](S1-4-Lesson.md)。
