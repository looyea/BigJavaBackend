# 状态存储、精确一次与与 Flink 对比（关联）

> 本节难度：★★★★☆
> 重要程度：★★★☆☆
> 学习产出：能讲清 Kafka Streams 状态存储（State Store）的类型（KeyValue / Window / Session）、本地 RocksDB 与 changelog 的关系、Interactive Queries 就近读状态；掌握三种处理语义 at-least-once、以及基于 Kafka 事务的 effectively-once(EOS) 的实现原理与代价；能用 Processor API 写自定义有状态算子；并能在"库 vs 引擎"的维度上把 KS 与 Flink 在状态规模、EOS、再平衡、适用边界上做选型论证。

## 一、状态存储：类型与就近查询

```text
图目的：DSL 的 groupByKey/join/window 背后都是这些 store 落地
KeyValueStore：KTable/聚合的全量最新值（RocksDB 后端，可持久）
WindowStore：滚动/滑动窗口按时间分桶，过期窗口清
SessionStore：按会话 gap 动态合并
本地 RocksDB 提供随机读写；写同时进 compacted changelog 备份，支撑恢复与 standby
Interactive Queries：把某实例上的 store 当可查询状态服务，低延迟就近读聚合结果
```

```java
// 目的：用 Processor API 写一个有状态去重算子（伪代码）
builder.addStateOperator(dedup, Stores.newKeyValueStore("seen-ids", Serdes.String()));
// process(record): 若 store.get(id)!=null → 已见过，丢弃；否则 put(id) 并 forward
// 反例：只靠内存 HashSet 去重、不接 store ❌ 实例重启/迁移即丢，无 changelog 无法恢复
// 反例：去重键不设 TTL/清理 ❌ KeyValueStore 无界增长，最终吃满本地盘
```

## 二、处理语义与 EOS：库式精确一次怎么做

```text
图目的：KS 的 once 完全长在 Kafka 事务之上，边界是"读→处理→写"都在 Kafka 内
at-least-once：默认，故障重放可能重复处理（下游需幂等）
effectively-once(EOS)：processing.guarantee=eos_v2，用 Kafka 事务把"消费位移 + 状态 changelog + 产出"绑定提交
关键：消费端 read_committed 只读已提交事务；一次 commit 与 Checkpoint 式状态快照对齐
局限：只覆盖 Kafka 进/Kafka 出，外部副作用（写第三方 API/DB 非幂等）不受事务保护
```

```java
// 目的：开启 EOS 并说明其成立边界
p.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, "eos_v2");        // 结果：位移+changelog+输出在同一事务提交
p.put(StreamsConfig.NUM_STREAM_THREADS_CONFIG, 4);                 // 说明：多线程处理不同任务，事务需协调
// 反例：拓扑里 join 外部 HTTP 富化且非幂等 ❌ 事务回滚补不回外部副作用，EOS 名不副实
// 反例：下游消费者用 read_uncommitted ❌ 会读到最终被中止的脏事务数据
```

## 三、与 Flink 的正面对比

```text
图目的：把两节选型落到"状态/语义/运维"三条硬轴
状态：KS 本地 store 受单机 + rebalance 迁移约束；Flink 分布式 RocksDB + Checkpoint 撑更大状态
EOS：KS 仅 Kafka↔Kafka 事务内 once；Flink 端到端 once 覆盖更广外部系统（2PC/幂等 Sink）
再平衡：KS 随应用实例增减触发 rebalance、状态迁移；Flink rescale 靠 KeyGroup 重分布
选型：轻量、贴应用、Kafka 为中心→KS；大状态、复杂窗口/CEP、流批一体、跨外部系统 once→Flink
```

## 四、什么时候"库"就够了、什么时候必须"引擎"

```text
图目的：用约束是否被突破来决定升级
KS 够用：以 Kafka 为输入输出、状态可放单机、语义需求 Kafka 事务内可满足、团队拒绝多养集群
需 Flink：状态超单机、需跨外部系统端到端 once、复杂事件处理/大窗口/流批一体、要平台化共享算力
```

## 五、关联课程

KS 的 DSL/KStream/KTable 基础见 [DSL 拓扑与 KStream/KTable](S1-1-Lesson.md)；EOS 依赖的 Kafka 事务、位移与压缩主题见 [分区、副本与 ISR 机制](../../kafka/s1/S1-1-Lesson.md) 与 [消费组与再平衡](../../kafka/s1/S1-2-Lesson.md)；Flink 侧状态后端与端到端 once 见 [水位线、状态后端与 exactly-once](../../flink/s1/S1-2-Lesson.md)，整体选型见 [与 Kafka Streams 选型（关联）](../../flink/s1/S1-4-Lesson.md)。
