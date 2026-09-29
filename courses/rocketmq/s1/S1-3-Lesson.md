# 顺序、幂等、堆积与重试死信

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：能实现全局/分区有序消息、设计幂等消费方案、处理消息堆积告警并合理设计 DLQ 运维流程。

## 一、顺序消息

### 1.1 分区有序（局部有序）

```java
// 目的：同一订单的操作（创建→支付→发货）按序投递到同一 Queue
Message msg = new Message("OrderTopic", tag, orderId, body);
producer.send(msg, new MessageQueueSelector() {
    @Override
    public MessageQueue select(List<MessageQueue> mqs, Message m, Object arg) {
        int index = Math.abs(arg.hashCode()) % mqs.size();  // 说明：按 orderId 哈希
        return mqs.get(index);  // 结果：同一订单始终路由到同一 Queue → 分区内 FIFO
    }
}, orderId);  // 输出：传入 orderId 作为路由 key
// 错误用法：Queue 数变更（扩缩容）→ 哈希取模结果变化 → 原顺序被打破
```

### 1.2 全局有序

单 Queue Topic（`readQueueNums=writeQueueNums=1`）+ 单 Producer 串行发送 → 全局 FIFO。吞吐极低，极少使用。

### 1.3 Consumer 端顺序保证

```java
// 目的：顺序消费必须用 MessageListenerOrderly
consumer.registerMessageListener((MessageListenerOrderly) (msgs, ctx) -> {
    // 说明：同一 Queue 内 msgs 按 offset 顺序回调，加锁保证单线程消费
    for (MessageExt msg : msgs) {
        process(msg);  // 结果：串行处理，天然有序
    }
    return ConsumeOrderlyStatus.SUCCESS;
});
// 错误用法：用 MessageListenerConcurrently → 多线程消费 → 顺序无法保证
```

## 二、消费幂等

### 2.1 为什么必须做幂等

RocketMQ 保证 **At Least Once**：网络超时 / Consumer 重启 / Rebalance 都会导致重复投递。

### 2.2 去重方案

```java
// 目的：DB 唯一键去重——最可靠
// 说明：idempotent_record 表：biz_id VARCHAR UNIQUE, type VARCHAR, create_time
public boolean consumeWithIdempotent(String orderId, Runnable action) {
    try {
        jdbc.update("INSERT INTO idempotent_record(biz_id,type) VALUES(?,?)",
            orderId, "STOCK_DEDUCT");  // 结果：首次成功插入
        action.run();                  // 输出：执行业务逻辑
        return true;
    } catch (DuplicateKeyException e) {
        log.info("重复消息，跳过: orderId={}", orderId);  // 结果：已处理过，幂等跳过
        return false;
    }
}
// 错误用法：先 SELECT 判断再 INSERT → 并发窗口 → 两条同时进入 SELECT 都为空 → 重复执行
```

## 三、消息堆积处理

### 3.1 监控阈值

```java
// 目的：定时检查 Consumer Group 的积压量
ConsumeStats stats = admin.examineConsumeStats(consumerGroup);  // 说明：调用 AdminTool API
// 输出：diffTotal = brokerOffset - consumerOffset（每条 Queue 的未消费数之和）
long backlog = stats.computeTotalBacklog();
if (backlog > 100_000) {
    alertService.fire("MQ堆积告警", group, backlog);  // 结果：触发 PagerDuty/钉钉
}
// 错误用法：堆积百万条才告警 → 消化时间过长 → 业务雪崩
```

### 3.2 紧急预案

1. **扩 Consumer 实例**（前提：Queue 数 ≥ 实例数）。
2. **扩 Queue + 扩实例**：Broker 增加 Queue → 重启 Consumer 自动 Rebalance。
3. **跳过非关键消息**：Consumer 逻辑改为 `msg.age > 30min → ACK 跳过 + 异步落 HDFS 补处理`。

## 四、重试与死信队列（DLQ）

### 4.1 重试梯度

消费失败返回 `RECONSUME_LATER` → Broker 将消息投递到 `%RETRY%group` Topic，延迟等级递增：

| 次数 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11+ |
|------|---|---|---|---|---|---|---|---|---|----|----|
| 延迟 | 1s | 5s | 10s | 30s | 1m | 2m | 3m | 4m | 5m | 6m | 7m+ |

### 4.2 死信队列

```java
// 目的：超过 maxReconsumeTimes 的消息进入 %DLQ%group_topic
// 说明：Consumer 不再自动消费 DLQ，需人工或定时任务处理
consumer.setMaxReconsumeTimes(5);  // 结果：重试 5 次后不再投 %RETRY%，转 %DLQ%
// 错误用法：maxReconsumeTimes=Integer.MAX → 永远重试 → 毒消息堵塞正常消费
```

运维操作：从 DLQ Topic 重新消费或控制台单条重投。

## 五、关联技术

- `ConsumeThreadMin/Max`：并行消费线程数
- Pop 模式（5.x）：无状态消费，不再绑定 Queue
- 定时消息（delayLevel）实现延迟重试
- RocketMQ Dashboard 堆积大盘
