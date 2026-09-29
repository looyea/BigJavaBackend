# 事务消息与最终一致性

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：掌握 RocketMQ 半消息+回查机制的完整流程，能在订单场景落地最终一致性方案。

## 一、为什么需要事务消息

分布式场景下本地事务与远程消息发送需原子：
- 先写 DB 再发消息 → 消息发失败 DB 已提交 → 下游收不到。
- 先发消息再写 DB → DB 失败但消息已投递 → 下游执行了无效操作。

RocketMQ **事务消息** = 两阶段提交 + 回查，将"本地事务执行"与"消息投递"解耦为最终一致。

## 二、半消息与两阶段流程

```text
Producer                    Broker                     Consumer
   │--- 1.发送半消息(Half) --->│                          │
   │<-- 2.OK ----------------|                          │
   │--- 3.执行本地事务 ------->│                          │
   │   (commit 或 rollback)   │                          │
   │--- 4.CommitMessage ----->│-- 5.投递到真实队列 ----->│
   │                          │   (或 DeleteHalf)        │
```

**半消息（Half Message）**：写入内部 Topic `RMQTRANS_HALF`，对 Consumer 不可见。Commit 后复制到真实 Topic；Rollback 则删除。

### 2.1 回查机制

若 Producer 在步骤 3-4 之间宕机，Broker 等待 `transactionCheckInterval`（默认 60s）后向 Producer Group 发回查请求：

```java
// 目的：实现回查接口——Broker 询问"这笔半消息对应的本地事务完成了吗"
public class OrderCheckListener implements RocketMQTransCheckListener {
    @Override
    public LocalTransactionState checkLocalTransaction(MessageExt msg) {
        String orderId = msg.getKeys();  // 说明：从 Key 中取业务主键
        // 输出：查 DB 确认订单是否存在
        Order order = orderRepo.findById(orderId).orElse(null);
        if (order != null) {
            return LocalTransactionState.COMMIT_MESSAGE;   // 结果：本地事务成功→投递
        } else {
            return LocalTransactionState.ROLLBACK_MESSAGE; // 删除半消息
        }
    }
}
// 错误用法：回查方法抛异常或超时 → Broker 视为 UNKNOW → 下一轮再查（最多 15 次）
```

## 三、完整代码示例（电商下单）

```java
// 目的：下单成功后通知库存扣减（最终一致性）
TransactionMQProducer producer = new TransactionMQProducer("tx_producer_group");
producer.setNamesrvAddr("localhost:9876");
producer.setTransactionCheckListener(new OrderCheckListener());  // 注册回查

// 发送半消息
Message msg = new Message("StockDeductTopic", "TAG_DEDUCT",
    order.getId(),  // Key = 订单号，用于回查定位
    JSON.toJSONBytes(orderItem));

orderProducer.sendMessageInTransaction(msg, new LocalTransactionExecuter() {
    @Override
    public LocalTransactionState execute(Message m, Object arg) {
        // 步骤 3：执行本地事务
        orderService.createOrder(order);  // 结果：DB 插入订单
        return LocalTransactionState.COMMIT_MESSAGE;  // 输出：提交→消息可见
        // 错误用法：这里 return ROLLBACK 但实际 DB 已写入 → 消息被删→库存未扣→数据不一致
    }
}, null);
producer.shutdown();
```

## 四、回查频率与上限

| 参数 | 默认 | 说明 |
|------|------|------|
| transactionCheckInterval | 60s | 第一次回查延迟 |
| transactionCheckMax | 15 | 最大回查次数 |
| 超过上限 | 丢弃 | Broker 认为事务失败，删除半消息 |

## 五、最终一致性保障链路

```text
下单(本地事务) → 事务消息 → 库存扣减 Consumer
                                    ↓ 失败？
                              RocketMQ 自动重试消费(梯度延迟 10 级)
                                    ↓ 仍失败
                              死信队列 DLQ → 人工介入
```

```java
// 目的：Consumer 端幂等处理（消息可能重复投递）
consumer.registerMessageListener((MessageListenerConcurrently) (msgs, ctx) -> {
    for (MessageExt msg : msgs) {
        String orderId = msg.getKeys();
        // 说明：先查是否已处理（Redis / DB 去重表）
        if (idempotentService.isDuplicate(orderId)) {
            continue;  // 结果：跳过重复消息
        }
        stockService.deduct(orderId);  // 输出：正常扣减
        idempotentService.mark(orderId);  // 标记已处理
    }
    return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
});
```

## 六、关联技术

- RocketMQ 5.x 事务消息基于 TimerWheel + Pop 模型改造
- Seata AT + MQ 混合场景
- 本地消息表（Outbox）模式对比
- 幂等表设计：`biz_id + type UNIQUE`
