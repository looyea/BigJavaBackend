# 消费组与再平衡

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：掌握 Consumer Group 协作机制、Cooperative 增量再平衡流程、位移提交策略与精确一次消费语义。

## 一、Consumer Group 基础

```text
Topic: order-events (6 Partitions)
Consumer Group "billing-service":
├── Consumer-1 → P0, P1
├── Consumer-2 → P2, P3
└── Consumer-3 → P4, P5
```

- **一个 Partition 只能被组内一个 Consumer 消费**（保证顺序）。
- 组内 Consumer 数 > 分区数 → 多余 Consumer 空闲。
- 不同 Group 各自独立消费全量消息（发布-订阅）。

```java
// 目的：配置 Consumer Group
props.put("group.id", "billing-service");  // 说明：同组共享位移，异组独立
props.put("auto.offset.reset", "earliest"); // 结果：新组第一次消费从头开始
// 错误用法：group.id 为空 → 随机 UUID → 每次都是新组 → 重复消费全量
```

## 二、Rebalance（再平衡）

### 2.1 触发条件

1. 组内 Consumer 加入/退出（含宕机超 `session.timeout.ms`）。
2. 订阅的 Topic 分区数变化。
3. 订阅的 Topic 列表变化（pattern 订阅）。

### 2.2 Eager 协议 vs Cooperative 协议

| 维度 | Eager（旧） | Cooperative（新） |
|------|------------|-----------------|
| 策略 | Stop-Then-Rebalance：先放弃全部分区 → 重新分配 | Incremental：保留当前分配，仅迁移变动分区 |
| 停顿 | 全部 Consumer 暂停消费 | 仅涉及的分区短暂暂停 |
| 配置 | 默认 | `partition.assignment.strategy=CooperativeStickyAssignor` |

```java
// 目的：使用 Cooperative 协议减少再平衡抖动
props.put(ConsumerConfig.PARTITION_ASSIGNMENT_STRATEGY_CONFIG,
    CooperativeStickyAssignor.class.getName());  // 结果：再平衡只影响变动分区
// 说明：Consumer 需处理 ConsumerRebalanceListener.onPartitionRevoked 回调
consumer.subscribe(topics, new ConsumerRebalanceListener() {
    @Override
    public void onPartitionsRevoked(Collection<TopicPartition> parts) {
        consumer.commitSync();  // 输出：被回收前提交位移，防止重复消费
    }
    @Override
    public void onPartitionsAssigned(Collection<TopicPartition> parts) {
        // 结果：新分配的分区开始 poll
    }
});
```

## 三、位移提交（Offset Commit）

### 3.1 提交方式对比

| 方式 | 配置/代码 | 语义 | 风险 |
|------|----------|------|------|
| 自动提交 | `enable.auto.commit=true`（默认 5s） | at-most-once / at-least-once | 可能重复或丢失 |
| 同步手动 | `commitSync()` after process | at-least-once | 异常前宕机→重消 |
| 异步手动 | `commitAsync()` | at-least-once | 回调失败不重试→可能重消 |

```java
// 目的：精确处理——处理完一批再同步提交
while (true) {
    var records = consumer.poll(Duration.ofMillis(500));  // 输出：拉一批
    for (var r : records) { process(r); }                  // 结果：业务处理
    consumer.commitSync();  // 说明：全部成功才提交 → 宕机重拉未提交部分
}
// 错误用法：commitAsync 后立即 consumer.close() → 回调未完成位移丢失
```

### 3.2 __consumer_offsets

位移存储在内部 Topic `__consumer_offsets`（50 分区、三副本），key = `(group, topic, partition)` → value = offset + metadata。

## 四、精确一次语义（EOS）

```java
// 目的：Kafka Streams / 事务 Producer 实现 read-process-write 原子
props.put("transactional.id", "order-processor");  // 结果：启用事务
consumer = new KafkaConsumer<>(props);
producer = new KafkaProducer<>(props);
producer.initTransactions();

while (true) {
    var records = consumer.poll(Duration.ofMillis(500));
    producer.beginTransaction();                    // 说明：开启事务
    for (var r : records) {
        producer.send(new ProducerRecord<>("result-topic", transform(r)));
    }
    producer.sendOffsetsToTransaction(offsets, consumer.groupMetadata());  // 输出：位移与消息原子写
    producer.commitTransaction();                   // 结果：同时提交消费位移 + 生产消息
}
// 错误用法：只 producer.commitTransaction() 不 sendOffsetsToTransaction → 消费位移未推进
```

## 五、max.poll.records 与 poll 超时

```yaml
# 目的：防止单次 poll 太多处理超时被踢出组
max.poll.records: 500                 # 说明：每次最多拉 500 条
max.poll.interval.ms: 300000          # 结果：两次 poll 间隔 > 5min → Broker 认为消费者死亡 → 触发 rebalance
session.timeout.ms: 45000             # 输出：心跳超时 → 踢出组
```

```java
// 错误用法：处理 500 条需 6min > max.poll.interval.ms → 被踢出 → 不断 rebalance → 消费卡死
// 修复：减少 max.poll.records 或提高 max.poll.interval.ms 或优化处理逻辑
```

## 六、关联技术

- Kafka Streams Exactly-Once（KIP-429）
- Consumer Lag 监控：`kafka-consumer-groups.sh --describe`
- 静态成员协议（`group.instance.id`）：减少重启触发 rebalance
- 外部位移存储（数据库 / Redis）：跨引擎统一位移
