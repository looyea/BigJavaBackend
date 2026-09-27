# 消费组与再平衡 · 面试题

## 题 1：Consumer Group Rebalance 期间的"双重消费"如何避免？

Eager 协议下全部 revoked → 若位移未提交 → 新 owner 从旧 offset 开始 → 双重消费。

```java
// 目的：在 onPartitionsRevoked 中同步提交位移
public void onPartitionsRevoked(Collection<TopicPartition> parts) {
    consumer.commitSync(currentOffsets);  // 结果：确保已处理位移持久化
}
// 输出：新 owner 从已提交的 offset 开始，不重复
```

Cooperative 下只回收变动分区 → 影响范围更小。

## 题 2：Kafka 为什么选择 Client-Side Assignor 而不是 Broker-Side？

1. **灵活性**：Client 可自定义分配策略（如按区域、按权重）。
2. **扩展性**：Broker 不参与计算 → Coordinator 负载轻。
3. **升级友好**：新 Assignor 算法不需 Broker 升级。

## 题 3：静态成员协议解决什么问题？

场景：Kubernetes Pod 重启 → 短暂离线 → 触发 Rebalance → 所有分区重新分配。

```java
// 目的：避免重启触发无谓 rebalance
props.put("group.instance.id", "consumer-" + podIndex);  // 结果：固定身份
props.put("session.timeout.ms", 180000);  // 说明：3min 内回来 → 分区不变
// 输出：Pod 重启后原分区直接恢复，跳过 Rebalance
```

## 题 4：Consumer Lag 如何计算与监控？

```bash
# 目的：CLI 查看各组 lag
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group billing-service
# 输出表格：
# TOPIC | PARTITION | CURRENT-OFFSET | LOG-END-OFFSET | LAG
# order | 0         | 5000           | 5200           | 200
# 说明：LAG = LOG-END-OFFSET - CURRENT-OFFSET（未消费条数）
```

监控：`consumergroup_max_lag` → Burrow / Kafka Advisor → Grafana 告警。

## 题 5：auto.offset.reset 的三个选项分别在什么时机生效？

| 值 | 效果 | 生效时机 |
|----|------|----------|
| earliest | 从最早可用 offset 消费 | 组内无已提交位移时（新 Group / offset 被删） |
| latest（默认）| 从最新（末尾）开始 | 同上 |
| error | 抛 NoOffsetForPartitionException | 同上 |

```java
// 目的：首次启动的流处理应用回溯历史
props.put("auto.offset.reset", "earliest");  // 结果：新组消费全部历史消息
// 错误用法：线上用 latest → 部署时已有消息未消费即被跳过 → 数据丢失
```

## 题 6：如何平滑地将 Consumer Group 迁移到新 Topic 分区数？

1. 增加分区：`kafka-topics.sh --alter --partitions 12`（只增不减）。
2. 若用 Cooperative + Sticky → 仅新分区触发增量分配。
3. 位移：旧分区 offset 不变；新分区 offset=0 → 从 earliest/latest 取决于配置。
4. 注意：增加分区后按 Key 哈希的分区归属可能变化 → 之前依赖 Key 顺序的场景需评估影响。
