# 分区、副本与 ISR 机制

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：理解 Kafka 日志分段存储、Partition/Replica/ISR 三者关系，能根据 acks 和 min.insync.replicas 权衡可靠性与吞吐。

## 一、存储结构

### 1.1 Topic → Partition → Segment

```text
Topic: order-events (3 Partitions)
├── Partition 0: replica on broker 0(Leader), 1(Follower), 2(Follower)
│   ├── 00000000000000000000.log  (segment, 默认 1GB)
│   ├── 00000000000000000000.index (offset → physical pos)
│   └── 00000000000000000000.timeindex (timestamp → offset)
├── Partition 1: ...
└── Partition 2: ...
```

```java
// 目的：Producer 发消息时按 key 哈希选 Partition
ProducerRecord<String, String> record =
    new ProducerRecord<>("order-events", orderId, json);  // key=orderId
// 结果：partition = hash(orderId) % numPartitions → 同一订单落同一分区
// 说明：同一分区内消息严格有序（offset 递增），跨分区不保证全局顺序
// 错误用法：不设 key → 轮询/粘性分区 → 同一业务的消息散到不同分区无法保序
```

### 1.2 顺序写 + 零拷贝

- **顺序写**：每个 Partition 的 `.log` 文件只追加（append-only），磁盘 I/O 顺序化。
- **零拷贝（sendfile）**：Consumer 拉消息时数据从 PageCache 直接到网卡，不经用户态。

## 二、副本与 ISR

### 2.1 角色定义

| 角色 | 说明 |
|------|------|
| Leader | Partition 的读写入口（每个 Broker 上约 1/3 Partition 是 Leader） |
| Follower | 从 Leader 拉（Fetch）数据同步副本 |
| ISR（In-Sync Replicas） | 与 Leader 保持同步的副本集合（含 Leader 自身） |
| OSR（Out-of-Sync） | 落后太多的 Follower（超 `replica.lag.time.max.ms=30s`） |

```yaml
# 目的：Broker 配置副本数与 ISR 超时
auto.create.topics.enable=false
num.partitions=3
default.replication.factor=3  # 结果：3 副本（1 Leader + 2 Follower）
replica.lag.time.max.ms=30000 # 说明：30s 未追上 Leader → 踢出 ISR
```

### 2.2 Leader 选举

- **首选选举（Preferred Leader）**：Controller 检测 Leader 挂 → 从 ISR 中选新 Leader。
- `unclean.leader.election.enable=false`（默认）：不允许 OSR 当 Leader → 宁可短暂不可用也不丢数据。

## 三、acks 与 min.insync.replicas

### 3.1 Producer acks 配置

| acks | 含义 | 可靠性 | 吞吐 |
|------|------|--------|------|
| 0 | 发完即走不等 ACK | 最低 | 最高 |
| 1 | Leader 写入即 ACK | 中 | 中 |
| all/-1 | ISR 全部确认 | 最高 | 最低 |

```java
// 目的：金融级可靠配置
props.put("acks", "all");           // 结果：ISR 全部写入才返回 ACK
props.put("retries", Integer.MAX_VALUE);  // 输出：可重试异常无限重试
props.put("enable.idempotence", "true");  // 说明：幂等 Producer（PID+SeqNum）去重
// 错误用法：acks=all 但 min.insync.replicas=1 → ISR 缩到只剩 Leader → 等价 acks=1
```

### 3.2 min.insync.replicas

```yaml
# Broker / Topic 级配置
min.insync.replicas=2  # 结果：ISR < 2 时 Producer 收到 NotEnoughReplicasException
```

**组合**：`acks=all` + `replication.factor=3` + `min.insync.replicas=2` → 最多容忍 1 副本故障仍保证写入。

## 四、Consumer 拉取与位移

```java
// 目的：Consumer 手动提交位移（at-least-once）
KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
consumer.subscribe(List.of("order-events"));
while (true) {
    var records = consumer.poll(Duration.ofMillis(100));  // 输出：从 Leader 拉一批
    records.forEach(r -> process(r));                      // 结果：本地处理
    consumer.commitSync();  // 说明：处理完才提交 offset，宕机则重拉（重复消费）
}
// 错误用法：commitSync 在 process 之前 → 宕机丢消息（at-most-once）
```

## 五、分区数选择

- 分区数 ≥ Consumer 实例数 → 每实例至少 1 个分区。
- 分区过多 → Leader 选举慢、文件句柄多、端到端延迟增。
- 经验：单 Broker 建议 ≤ 4000 Partition。

## 六、关联技术

- KRaft 模式（3.3+）：去 ZooKeeper 自管理元数据
- Tiered Storage（KIP-405）：冷数据下沉对象存储
- MirrorMaker 2：跨 DC 复制
- Schema Registry + Avro 序列化
