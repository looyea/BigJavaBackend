# 顺序、幂等、堆积与重试死信 · 面试题

## 题 1：如何保证 RocketMQ 顺序消费的同时不过度牺牲吞吐？

分区有序：按业务 Key 哈希到固定 Queue，Queue 间并行。假设 1000 个 orderId 哈希到 8 个 Queue，则最大并行度=8，每个 Queue 内串行。兼顾了"同一订单有序"和"不同订单并行"。

## 题 2：顺序消费模式下一条毒消息怎么处理？

```java
// 目的：避免毒消息无限阻塞 Queue
consumer.registerMessageListener((MessageListenerOrderly) (msgs, ctx) -> {
    try {
        process(msgs);
        return ConsumeOrderlyStatus.SUCCESS;
    } catch (Exception e) {
        ctx.setSuspendCurrentQueueTimeMillis(5000);  // 结果：暂停 5s 后重试本条
        return ConsumeOrderlyStatus.SUSPEND_CURRENT_QUEUE_A_MOMENT;
    }
});
// 说明：设 maxReconsumeTimes=3 后毒消息仍进 DLQ——但 Queue 后续消息恢复消费
```

## 题 3：Redis SETNX 做幂等有什么坑？

1. **过期时间**：设太短→消息在 TTL 后重投则重复执行；设太长→Redis 内存膨胀。
2. **非事务**：SETNX 成功但后续业务执行前宕机→消息被丢（标记已处理但实际未执行）。
3. **Redis 故障恢复**：主从切换丢数据→标记丢失→重复消费。

最佳实践：Redis 快速拦截 + DB 唯一键兜底。

## 题 4：消息堆积后能直接跳过（SKIP）吗？

不能盲目跳过。需区分：
- 幂等操作（如"加积分"）→ 可跳过。
- 非幂等（如"扣库存"）→ 跳过后库存不一致。

安全方案：跳过后转存到离线表（Hive/HDFS）→ 定时批处理补偿。

## 题 5：Producer 端如何避免消息重复发送？

```java
// 目的：利用消息 Key 实现 Producer 端去重（Broker 侧可选）
msg.setKey(orderId);  // 说明：同一 orderId 的消息 Key 固定
// RocketMQ 本身不做 Producer 去重——若超时重试会重发
// 方案：使用"精确一次"事务消息 + Consumer 幂等
// 错误用法：设 retryTimesWhenSendFailed=0 → 网络抖动直接丢消息
```

## 题 6：DLQ 运维最佳实践？

1. **监控**：DLQ 有消息即告警（阈值=1），代表消费逻辑或上游数据异常。
2. **分析**：按 msgId 查原始消息内容 + 消费失败原因日志。
3. **修复**：修 Bug 或数据后从控制台重投回原 Topic。
4. **归档**：超过保留期（如 30 天）自动清理。
5. **SLA**：金融场景 DLQ 消息必须当天清零，否则影响对账。
