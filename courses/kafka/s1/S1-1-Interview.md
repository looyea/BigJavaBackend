# 分区、副本与 ISR 机制 · 面试题

## 题 1：Kafka 如何做到"既顺序又高吞吐"？

分区级顺序 + 分区级并行。单 Partition 内 append-only 严格有序；多 Partition 间并行读写。水平扩展靠加分区（加机器）。这是"有序性"和"并行度"的折中。

## 题 2：acks=all + min.insync.replicas=2 + RF=3 时最多容忍几节点故障？

容忍 **1 节点**故障。3 副本挂 1 → ISR=2 ≥ min.insync=2 → 仍可写。挂 2 → ISR=1 < 2 → 拒绝写入。若要容忍 2 挂 → RF=5, min.insync=3。

## 题 3：Kafka Leader 迁移（Preferred Leader Election）何时触发？

当 ISR 中最小 ID 的 Broker 不是当前 Leader 时（通常因故障切换后回来的原 Leader 变 Follower）。执行：
```bash
kafka-leader-election.sh --election-type preferred --topic X --partition 0
```
`auto.leader.rebalance.enable=true`（默认）每 5min 自动执行。

## 题 4：幂等 Producer 如何做到 exactly-once 写？

```java
// 目的：单分区单 Session 内去重
props.put("enable.idempotence", "true");   // 结果：PID 分配 + 每条消息带 SeqNum
props.put("acks", "all");
props.put("retries", Integer.MAX_VALUE);
props.put("max.in.flight.requests.per.connection", 5); // 说明：幂等下 ≤5 仍保序
// 输出：Broker 端缓存每个 PID+Partition 的最新 SeqNum → 重复/乱序直接丢弃
// 错误用法：跨 Partition 事务（需 transactional.id 实现跨分区 exactly-once）
```

## 题 5：Kafka 和 RocketMQ 存储模型的核心区别？

| 维度 | Kafka | RocketMQ |
|------|-------|----------|
| 文件组织 | 每 Partition 独立文件 | 所有 Topic 混合 CommitLog |
| 索引 | 每 Partition 自带 .index | 独立 ConsumeQueue |
| 随机写 | Partition 多时退化为随机写 | 始终顺序写（单文件） |
| 适用 | 分区少(≤几千) | Topic/Queue 极多(数万) |

## 题 6：Tiered Storage 解决什么问题？

传统 Kafka 热数据全在本地磁盘 → 保留期长（7天+）则磁盘成本爆炸。Tiered Storage（KIP-405）将冷 Segment 上传到 S3/GCS → 本地只保留最近 N 小时 → 存储成本降 90%+；Consumer 透明读取冷层（延迟高但不影响热路径）。
