# 流处理模型、窗口与事件时间

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能讲清 Flink "统一流处理模型 + 算子 DAG + KeyedStream" 的执行结构，区分 DataStream 有状态/无状态算子；掌握窗口（滚动/滑动/会话/全局）的划分语义与触发/清理时机；建立"事件时间 vs 处理时间 vs 摄入时间"三时钟概念，理解乱序、迟到数据与窗口的关系（水位线留到下节），并能为"每 5 分钟统计各商品点击量""会话超时聚合"选对窗口类型与时间语义。

## 一、一切皆流：Flink 的执行模型

```text
图目的：把批看成流的特例，用一套 DAG 模型统一处理
Source → Transformation(算子链) → Sink，构成有向无环图
无状态算子：map/filter/flatMap，逐条独立处理，不占状态
有状态算子：keyBy 后按 key 维护 State（计数、缓存、窗口缓冲区）
并行度：每个算子拆成多个 subtask 分布到 TaskManager，keyBy 触发网络 shuffle
```

```java
// 目的：点击日志按商品每 5 分钟计数——典型的 keyBy + 滚动窗口
DataStream<EventLog> src = env.addSource(new KafkaSource<>());      // 说明：从 Kafka 读事件流
src.keyBy(e -> e.getItemId())                                      // 结果：按商品分区，状态按 key 隔离
   .window(TumblingEventTimeWindows.of(Time.minutes(5)))           // 说明：事件时间下的 5 分钟滚动窗口
   .aggregate(new CountAgg(), new WindowResultFunction());         // 目的：增量聚合，避免缓存全部元素
// 反例：不 keyBy 直接 window ❌ 所有数据进同一算子实例，并行度失效、单点热点
// 反例：用 ProcessWindow 缓存全量元素做简单计数 ❌ 状态爆炸，应优先 reduce/aggregate 增量聚合
```

## 二、窗口四兄弟：怎么切时间

```text
图目的：按"是否重叠、如何界定边界"区分窗口
滚动 Tumbling：固定大小、不重叠，每 5 分钟一段（最常见统计口径）
滑动 Sliding：固定大小、可重叠/有间隔，size=10min slide=5min → 每 5min 输出近 10min
会话 Session：无固定长度，按活动间隙(gap)划分，两次事件间隔超 gap 即关窗
全局 Global：所有元素同一窗口，必须配自定义 Trigger，极少直接用
```

- 窗口的"分配 + 触发(Trigger) + 销毁(Evictor/allowedLateness)"三段决定何时算、算几次、何时清。

## 三、三个时钟：为什么必须用事件时间

```text
图目的：结果要不要随重放/延迟稳定，取决于用哪个时间戳
处理时间 ProcessingTime：算子本机墙上时钟，吞吐最高但结果不可重现（乱序、重放会错）
事件时间 EventTime：数据自带的发生时间，配合水位线得到确定、可重放的结果（生产首选）
摄入时间 IngestionTime：进入 Source 时打的戳，折中方案，灵活性差
电商/金融对账、补数重跑都要求"同样输入同样结果"→ 事件时间是硬约束
```

```java
// 目的：声明事件时间语义并从记录里抽时间戳
env.setStreamTimeCharacteristic(TimeCharacteristic.EventTime);          // 结果：全图按事件时间驱动窗口
assigner = new BoundedStreamTimestampAssigner();                        // 说明：从 e.getOccurTime() 取事件时间戳
src.assignTimestampsAndWatermarks(assigner);                            // 目的：为每条数据打戳并生成水位线
// 反例：用处理时间做"按小时对账" ❌ 重跑历史数据时窗口划分与原始不同，对账结果漂移
// 反例：事件时间语义下却不生成 watermark ❌ 窗口永远等不到"事件时间到达"，结果不输出（衔接下节）
```

## 四、乱序与迟到：窗口为什么不能立即算

```text
图目的：事件乱序到达，"当前事件时间"无法一眼确定
乱序(Orderedness)：后发生的先到、先发生的后到（网络/分区导致）
水位线 Watermark：一种"事件时间进度"估计，≈ 已见到的最大事件时间 - 允许乱序度
迟到数据：晚于 watermark 才到的元素，默认丢弃；可用 allowedLateness 延迟关窗 + sideOutput 兜底
```

- 本节只建立"为什么需要水位线"，`Watermark` 生成策略与多分区推进留到 [水位线、状态后端与 exactly-once](S1-2-Lesson.md)。

## 五、关联课程

有状态算子的容错与 RocksDB 状态后端见 [水位线、状态后端与 exactly-once](S1-2-Lesson.md)；窗口聚合结果落湖仓/OLAP 的管道见 [CDC、数据管道与流批一体](S1-3-Lesson.md)；与库式流处理（Kafka Streams）的选型差异见 [与 Kafka Streams 选型（关联）](S1-4-Lesson.md)。
