# 可靠性语义、幂等与消息不丢不重

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：能把 Kafka 的"消息不丢不重"拆成**生产端 acks、broker 副本、消费端提交时机**三段链路的乘积，并理解端到端语义的现实取舍。生产端 `acks=0`（不等待，吞吐最高但 leader 挂就丢）、`acks=1`（leader 落盘即确认，leader 崩溃且未同步给 follower 则丢）、`acks=all/-1`（等 **ISR** 全部确认）——但 `-1` 只有在 broker 侧 **`min.insync.replicas>=2` 且 `replication.factor>=3`** 时才真正防丢：否则 ISR 缩到 1 时 `all` 形同虚设，或 broker 直接抛 `NotEnoughReplicasException` 拒写（宁可暂时不可用也不丢数据）；`unclean.leader.election.enable=false` 禁止落后太多的非 ISR 副本上位当 leader，用可用性换数据不丢。**幂等 Producer**（`enable.idempotence=true`，新版默认开）给每个 partition 的消息带 producer 单调 **sequence**，broker 据此去重，专门解决**重试导致的分区内重复**（把 network 重试产生的 at-least-once 收敛成分区内 exactly-once），约束是 `acks=all`、`retries` 大、`max.in.flight.requests<=5`。跨分区、"消费-处理-生产"原子的 **exactly-once（EOS）** 要靠**事务**（`transactional.id` + read-process-write）。消费端"不丢"靠 `enable.auto.commit=false` 的**先处理再手动提交 offset**；一旦处理失败就不提交、让消息重投，而重投必然带来重复，于是**消费幂等**（业务唯一键/去重表/`upsert`）是兜底。工业常态取舍：与其追高成本的全链路 EOS，不如 **生产幂等/至少一次 + 消费幂等** 逼近 effectively-once。识破"只设 `acks=-1` 不管 `min.insync.replicas`""auto.commit 处理前提交→处理失败消息永久丢""以为幂等 Producer 能跨分区去重""消费不幂等遇重投重复扣款/重复发货"等坑——金融支付事件、电商订单状态流、电力告警链路尤其致命。

## 一、acks 与副本：不丢的地基

```java
// 目的：生产端把"不丢"配齐——acks=all + 幂等 + 足够重试, 且与 broker 侧 min.insync 呼应
props.put(ProducerConfig.ACKS_CONFIG, "all");              // 说明：等 ISR 全部确认; 只有配 min.insync.replicas>=2 才真防丢
props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true); // 结果：为分区消息加 sequence, broker 去重, 消除"重试导致的重复"
props.put(ProducerConfig.RETRIES_CONFIG, Integer.MAX_VALUE); // 说明：幂等下无限重试, 单次网络抖动不再直接丢消息
props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5); // 说明：幂等允许<=5(靠 sequence 保序去重), 兼顾吞吐
// 反例：acks=all 但 broker 端 min.insync.replicas=1 且 RF=1 ❌ ISR 只剩 leader, leader 崩即丢, "all"名不副实 ❌
```

## 二、幂等 Producer vs 事务（EOS）

```text
图目的：幂等与事务各解决哪一层"不重", 边界要划清
幂等 Producer: 单 partition 内, 靠 (PID+sequence) 去重重试副本 → 分区内 exactly-once, 跨分区不保证
事务 Transaction: 跨多分区"生产原子" + read-process-write 消费位点一并提交 → 端到端 EOS(需 transactional.id)
代价: 事务引入协调开销与延迟, 吞吐下降; 幂等近乎免费, 默认就该开
误区: 幂等 Producer 不能替你去重"业务层面的重复消息", 那只靠消费幂等
```

## 三、消费端提交与不丢

```java
// 目的：消费端"先处理再提交", 并用业务幂等兜住重投带来的重复
while (true) {
    ConsumerRecords<String, String> rs = consumer.poll(Duration.ofMillis(100)); // 说明：enable.auto.commit=false, 手动控提交时机
    for (ConsumerRecord<String, String> r : rs) {
        boolean done = handleIdempotent(r);          // 结果：按业务唯一键去重/upsert, 重复消息不再二次扣款
        if (!done) throw new IllegalStateException("处理失败, 不提交 offset 以便重投"); // 反例：处理前就 commit ❌ 崩了这条永远丢 ❌
    }
    consumer.commitSync();                            // 说明：整批处理成功后再提交 → 至少一次(at-least-once)
}
```

## 四、端到端取舍与底线

- **不丢三件套一起设**：`acks=all` + `RF>=3` + `min.insync.replicas>=2` + `unclean leader election=false`，缺一都有丢窗口。
- **不重靠幂等闭环**：生产开幂等消除重试重复，消费用业务唯一键兜底 at-least-once 的重投；只配一半必然出问题。
- **EOS 按需不上头**：跨分区原子/精确一次才用事务，普通业务用"幂等生产+幂等消费"更划算。

## 五、关联课程

`acks=all` 依赖的 ISR、leader 选举机制承接 [分区、副本与 ISR 机制](./S1-1-Lesson.md)；消费端手动提交与再平衡时"重复消费"的根因见 [消费组与再平衡](./S1-2-Lesson.md)；消费幂等的去重键设计（幂等表/`upsert`）与 [幂等键设计与分布式去重](../../idempotent/s1/S1-3-Lesson.md) 一脉相承。
