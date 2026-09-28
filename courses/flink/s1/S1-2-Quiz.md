# 水位线、状态后端与 exactly-once · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. 一个多输入算子的水位线由什么决定？（6分）

- A. 各上游 watermark 的最大值
- B. 各上游 watermark 的最小值
- C. 第一个到达的 watermark
- D. 系统当前时间
> 答案：B
> 解析：算子取所有输入通道 watermark 的 min 向前推进，整体进度受最慢分区约束，这是窗口触发时机的依据。

### 2. 某 Kafka 分区长时间无数据导致窗口迟迟不输出，最可能的原因是？（6分）

- A. 状态后端太慢
- B. 空闲分区不再推进 watermark，取 min 后全链路停滞
- C. 并行度太低
- D. Checkpoint 失败
> 答案：B
> 解析：无数据分区不产新 watermark，min 被它拖住；用 withIdleness 标记空闲或单调策略解决。

### 3. 处理"TB 级超大状态"应优先选哪种状态后端？（6分）

- A. HashMapStateBackend
- B. EmbeddedRocksDBStateBackend
- C. 内存 Map
- D. 磁盘文本文件
> 答案：B
> 解析：RocksDB 堆外可 spill 到 SSD、支持超大状态与增量 Checkpoint；HashMap 受 JVM 堆限制。

### 4. RocksDB 后端开启"增量 Checkpoint"的收益是？（6分）

- A. 提高每条处理吞吐
- B. 每次只上传变化的 SST 文件，快照更小更快
- C. 消除乱序
- D. 免去窗口计算
> 答案：B
> 解析：大状态全量快照昂贵，增量只传新增/变化的 SST，降低 Checkpoint 存储与时间开销。

### 5. Flink Checkpoint 采用的是哪类一致性快照思想？（6分）

- A. 两阶段锁
- B. 类 Chandy-Lamport 异步屏障快照（Barrier 随流对齐）
- C. 全量加锁冻结
- D. MVCC 版本
> 答案：B
> 解析：注入 Barrier，算子收齐所有上游 Barrier（对齐）后对当前状态快照，不长时间阻塞数据处理。

### 6. 端到端 exactly-once 除了引擎内 Checkpoint，还要求？（6分）

- A. Source 可重放 + Sink 事务/幂等
- B. 只要并行度=1
- C. 关闭水位线
- D. 用 HashMap 后端
> 答案：A
> 解析：Source 要能按 offset 重放不丢不重，Sink 要 2PC 事务或幂等 upsert，才把"引擎内 once"变成端到端 once。

### 7. Kafka 事务型 Sink 与 Flink 协同的关键约束是？（6分）

- A. Kafka 的 transaction.max.timeout.ms 必须 ≥ Flink 最大 Checkpoint 间隔
- B. 必须关闭 Checkpoint
- C. Sink 并行度必须等于 Source
- D. 水位线必须为 0
> 答案：A
> 解析：事务在 Checkpoint 完成时 commit，若 Kafka 事务超时上限小于 Checkpoint 间隔，事务被中止导致丢/重。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. 关于水位线，下列说法正确的有？（多选）（9分）

- A. watermark 是"事件时间下界"的估计，非精确当前时间
- B. 允许乱序度越大，迟到丢弃越少但结果延迟越高
- C. 空闲分区会阻碍基于 min 的水位线推进
- D. 水位线一到就代表不会再有更大事件时间的数据
> 答案：A、B、C
> 解析：D 错，watermark 只是声明"大概率不再有更早的"，仍可能有更晚到的迟到数据，故需 allowedLateness/侧输出。

### 9. 以下哪些是"宣称却达不到端到端 exactly-once"的真实原因？（多选）（9分）

- A. Source 不可重放（如某些无回溯能力的源）
- B. Sink 非幂等且无事务，故障重放重复写
- C. 只开了 Checkpoint 就以为端到端 once
- D. 并行度过高
> 答案：A、B、C
> 解析：端到端 once 三要素是 Source 可重放、引擎内 Checkpoint、Sink 事务/幂等，缺任一都不成立；D 无关。

## 三、简答题（共 40 分）

### 10. 简答题：一个大状态、事件乱序、结果写入 Kafka 的实时聚合作业，请说明如何设水位线（含空闲分区处理）、选状态后端、并保证端到端 exactly-once。（40分）

> 参考答案：
- 要点1：用 forBoundedOutOfOrderness 定乱序度、各分区都产 watermark，配 withIdleness 防空闲分区拖住 min 推进。（12分）
- 要点2：大状态选 EmbeddedRocksDBStateBackend 并开启增量 Checkpoint，快照落 HDFS/S3。（10分）
- 要点3：引擎内靠 Barrier 对齐的 Checkpoint 保证状态恰好一次应用。（8分）
- 要点4：Kafka 事务 Sink 用 EXACTLY_ONCE、独立 transactionalId，且 Kafka 事务超时 ≥ 最大 Checkpoint 间隔；或退而用幂等 upsert。（10分）
