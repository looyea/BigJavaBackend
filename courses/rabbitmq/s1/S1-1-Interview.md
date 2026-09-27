# Exchange 类型与消息投递保证 · 面试题

## 题 1：RabbitMQ 如何做到消息不丢？

三层保障：
1. **生产端**：Confirm 机制——Broker 未 ACK 则重发。
2. **Broker 端**：Exchange/Queue/Message 三者都持久化 + Quorum Queue 多副本。
3. **消费端**：手动 ACK + nack(requeue=false) → DLX 兜底。

## 题 2：Direct vs Topic vs Fanout 性能差异？

- Fanout 最快：无 routingKey 匹配逻辑，直接广播到绑定列表。
- Direct 次之：精确哈希查找。
- Topic 最慢：需遍历 pattern 做通配匹配（RabbitMQ 内部用 trie 优化但仍最复杂）。

## 题 3：requeue=true 导致消息死循环怎么解决？

```java
// 目的：限制重试次数后进死信
// 方案 1：header 中记录重试次数
int retryCount = getRetryCount(headers);  // 说明：从消息 header 取
if (retryCount >= 3) {
    channel.basicNack(tag, false, false);  // 结果：不再 requeue → 进 DLX
} else {
    msg.setHeader("x-retry-count", retryCount + 1);
    channel.basicNack(tag, false, true);   // 输出：requeue 重试
}
// 方案 2：Spring AMQP RetryTemplate + DeadLetterRecoverer（推荐）
```

## 题 4：RabbitMQ 与 Kafka 的核心选型差异？

| 维度 | RabbitMQ | Kafka |
|------|----------|-------|
| 模型 | 推（Broker 推给 Consumer） | 拉（Consumer pull） |
| 路由 | Exchange 灵活路由 | 按 Partition（key 哈希） |
| 消息存储 | 消费即删 | 顺序日志保留（可回放） |
| 吞吐 | 万级 | 十万~百万级 |
| 适用 | 复杂路由 / 低延迟 / 任务分发 | 高吞吐 / 日志流 / 事件溯源 |

## 题 5：Quorum Queue 相比镜像队列的优势？

- 镜像队列：基于 GM 协议（RabbitMQ 自研），全量同步 → 性能差、网络分区脑裂。
- Quorum Queue（3.10+）：基于 Raft，多数写确认、独立 leader → 更好的网络分区处理 + 性能。
- 限制：不支持 global prefetch、消息数受限（适合可靠性而非极致吞吐）。

## 题 6：如何实现优先级队列？

```java
// 目的：x-max-priority 声明优先级队列
Map<String, Object> args = Map.of("x-max-priority", 10);
channel.queueDeclare("task_queue", true, false, false, args);
// 结果：消息发送时设置 priority 0-10，高优先级先被消费
AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
    .priority(8).build();  // 说明：VIP 用户任务 priority=8
channel.basicPublish("", "task_queue", props, body);
// 错误用法：priority > x-max-priority → 按 max 处理
```
