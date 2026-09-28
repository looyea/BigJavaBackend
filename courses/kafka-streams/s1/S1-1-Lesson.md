# DSL 拓扑与 KStream/KTable

> 本节难度：★★★★☆
> 本节重要性：★★★☆☆
> 学习产出：能讲清 Kafka Streams 作为"嵌入应用的流处理库"的运行形态与拓扑（SourceProcessor→中间 Processor→Sink 的 DAG）；建立 KStream（事件流，每条是独立记录）与 KTable（变更日志/物化视图，按 key 保留最新值）这对核心抽象及其相互转换（`toStream/toTable/groupByKey`）；用 DSL 的 map/filter/`selectKey`/`groupByKey`/`aggregate`/`join` 表达常见处理，理解本地状态 store 与 changelog topic 的关系，并识破"该用 KTable 却用 KStream 导致重复累加""无 key 的 join/聚合触发全分区 shuffle 或 reprocess"等错误。

## 一、运行形态：应用进程里的流处理

```text
图目的：KS 不是集群，而是随应用跑的库
StreamsBuilder 构建拓扑(DAG) → KafkaStreams 实例在应用进程内启动多线程处理
输入/输出都是 Kafka topic；中间状态用本地 State Store(RocksDB) + changelog topic 备份
扩缩容=加/减应用实例，触发 rebalance 重新分配分区，无需独立引擎
```

## 二、KStream vs KTable：两种"流"的语义

```text
图目的：同样是 Kafka topic，语义取决于"每条代表事件还是某 key 的最新状态"
KStream：每条记录是一个独立事实(insert-only 事件流)，"支付成功""页面浏览"
KTable：  每条记录是某 key 的当前值(变更日志/物化视图)，"用户地址""商品库存最新值"
关键：KTable 就是"按 key 取最新"的流；同一条 topic 用不同 deserializer/方法可当流或表看
```

```java
// 目的：同一 topic 以流或表两种语义消费，并按需互转
KStream<String, Click> clicks = builder.stream("clicks",
        Serialized.with(new StringKeySerde(), new ClickSerde()));   // 结果：事件流，每条独立
KTable<String, Integer> counts = clicks.groupByKey()               // 说明：按 key 分组做计数得到"表"
        .aggregate(() -> 0, (k, v, agg) -> agg + 1, Materialized.with(...));
KStream<String, Integer> asStream = counts.toStream();            // 结果：表变化再当作流下发
// 反例：对"每次点击都 +1"的语义用 KTable 的 update 直接覆盖 ❌ 表只留最新，丢失逐事件累加
// 反例：需要"每个 key 最新库存"却当 append 流处理 ❌ 下游拿到一堆历史版本，应建 KTable
```

## 三、DSL 常用算子与 selectKey

```java
// 目的：用 DSL 表达"过滤→改 key→窗口聚合"的拓扑
stream.filter((k,v) -> v.getAmount() > 0)                          // 无状态过滤
      .selectKey((k,v) -> v.getUserId())                           // 结果：重设 key，决定后续分区与聚合维度
      .groupByKey()
      .window(SlidingWindows.of(Time.minutes(10).every(Time.minutes(1))))
      .aggregate(() -> 0.0, (k,v,agg) -> agg + v.getAmount(),
                 Materialized.as("user-spend-store"));             // 说明：命名本地 store 供查询/恢复
// 反例：不 selectKey 就按订单号 group 聚合"用户消费" ❌ 维度错，应按 userId 作 key
// 反例：聚合不指定 Materialized/存储位置，大状态无边界 ❌ 需设 store 与保留/清理策略
```

- `mapValues` 只改 value 不动 key、不触发重分区；改 key 用 `selectKey`/`map` 会触发 repartition（内部多一个 `*-repartition` topic）。

## 四、join 与状态/changelog

```text
图目的：连接靠本地 store 存另一侧状态，语义分表表/流表/流流
KTable-KTable join：两侧最新值连接，本地 store 存对侧
KStream-KTable join（典型"富化"）：事件流去查表的最新值，最常用（如订单流补用户画像）
KStream-KStream join：两侧都要开窗缓存近期事件，状态随窗口保留期增长
State Store 是本地 RocksDB；为故障恢复，KS 把它备份到 compacted changelog topic
```

```java
// 目的：流表 join 做维表富化（订单流补充用户等级）
KStream<String,Order> orders = builder.stream("orders");           // 事件流
KTable<String,User> users = builder.table("user-profile");         // 结果：按 userId 的最新用户画像
orders.join(users, (o,u) -> new Enriched(o, u.getLevel()),          // 说明：按 key join，用最新画像富化
        JoinWindows.of(Time.days(7)), Joined.with(...));            // 反例陷阱：流流/流表窗口与保留要匹配数据延迟
```

## 五、关联课程

KS 的处理器 API、状态存储与 EOS、以及与 Flink 的选型见 [状态存储、精确一次与与 Flink 对比（关联）](S1-2-Lesson.md)；作为其输入输出的 Kafka 分区/顺序与压缩主题原理见 [分区、副本与 ISR 机制](../../kafka/s1/S1-1-Lesson.md)；与独立引擎 Flink 的窗口/事件时间对比见 [与 Kafka Streams 选型（关联）](../../flink/s1/S1-4-Lesson.md)。
