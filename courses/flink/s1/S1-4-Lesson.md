# 与 Kafka Streams 选型（关联）

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：能从"独立集群引擎 vs 嵌入应用的库"这一根本分野出发，对比 Flink 与 Kafka Streams 在部署形态、状态规模与存储、精确一次语义、窗口/事件时间能力、运维与成本上的取舍；给出"何时选库不选引擎、何时必须上引擎"的决策轴，并为一个具体场景（如"微服务内做轻量实时聚合"或"全公司统一实时数仓"）做出选型论证。

## 一、最本质的差异：引擎 vs 库

```text
图目的：一切取舍都源于这个架构分野
Flink：独立分布式集群（JobManager+TaskManager），作业提交到集群跑，是"流处理引擎"
Kafka Streams：一个 Java 库，随应用进程运行，用普通 Deployment/容器横向扩实例即可，无需独立集群
含义：Flink 能力强但要多运维一套集群；KS 轻量易用但能力/规模受"嵌在应用里"约束
```

## 二、能力对照表

```text
图目的：按维度给出选型依据（不是谁更强，而是谁更合适）
状态规模：Flink 靠 RocksDB 撑 TB 级大状态；KS 状态存本地 RocksDB，受单机磁盘/内存限制
精确一次：Flink 端到端 once（Checkpoint+2PC）；KS EOS（基于 Kafka 事务，处理保证幂等/once）
事件时间/乱序：Flink watermark 体系成熟、窗口类型丰富；KS 也有事件时间与窗口但相对轻量
生态/算子：Flink 有 CEP、SQL、批、ML、丰富连接器；KS 聚焦 Kafka 上下游的流处理
延迟/吞吐：KS 依赖 Kafka 往返，超低延迟与超大状态非其主场；Flink 面向高吞吐大状态
```

## 三、什么时候选 Kafka Streams

```java
// 目的：把 KS 定位为"应用自带的轻量流处理"，而非平台级引擎
// 场景：某微服务只需消费自己的 topic 做无状态/小状态的实时转换、过滤、聚合到 Kafka
// 选型理由：不愿为几个算子单独维护 Flink 集群；用现有 CI/CD 把 KS 应用当普通服务扩缩容即可
Properties p = new Properties();
p.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2); // 结果：EOS 依赖 Kafka 事务
// 反例：需要跨天大窗口、TB 级 join 状态却用 KS ❌ 本地状态盘吃紧、rebalance 风暴、恢复慢
// 反例：要做复杂 CEP/流式数仓多表关联 + OLAP 回流 ❌ 生态与算力更适合 Flink
```

## 四、什么时候必须上 Flink

```text
图目的：这些信号出现，说明"库"扛不住，要"引擎"
统一实时数仓/多源多目标 CDC 管道、大状态 join、复杂事件处理、流批一体
需要独立扩缩容、精细资源与容错控制、跨团队共享一个计算平台
已有 HDFS/S3、YARN/K8s 平台化运维能力，能承担集群成本
```

## 五、选型决策轴（不是非此即彼）

```text
图目的：用几个问题快速定位
状态会超过单机可承受？要复杂窗口/CEP/批？要平台化共享？→ 倾向 Flink
只是应用内轻量转换、团队已有 Kafka、拒绝再养一套集群？→ 倾向 Kafka Streams
两者可共存：应用用 KS 做局部实时，平台用 Flink 做统一管道，别用工具边界绑架架构
```

## 六、关联课程

KS 的 DSL/KTable 细节与本地状态见 [DSL 拓扑与 KStream/KTable](../../kafka-streams/s1/S1-1-Lesson.md)；KS 的 EOS 与状态存储深入见 [状态存储、精确一次与与 Flink 对比（关联）](../../kafka-streams/s1/S1-2-Lesson.md)；Flink 侧的 exactly-once 与状态后端见 [水位线、状态后端与 exactly-once](S1-2-Lesson.md)。
