# Exchange 类型与消息投递保证

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：区分四种 Exchange 路由模型，掌握 confirm/ack 双端保障机制与死信/延迟消息设计。

## 一、Exchange 四种类型

```text
Producer → Exchange --(Binding + RoutingKey)--> Queue(s) → Consumer
```

| 类型 | 路由规则 | 典型场景 |
|------|----------|----------|
| Direct | routingKey 精确匹配 binding key | 按级别分发日志 |
| Fanout | 广播到所有绑定 Queue | 通知推送 |
| Topic | routingKey 与 pattern 匹配（`*` 单词 `#` 多层） | 事件总线 |
| Headers | 按消息 header 键值对匹配（不用 routingKey） | 复杂条件路由 |

```java
// 目的：Topic Exchange 示例——按 order.created / order.paid / user.login 分流
channel.exchangeDeclare("event_bus", "topic", true);  // 结果：持久化 Exchange
channel.queueBind("order_queue", "event_bus", "order.*");    // 说明：匹配 order.created, order.paid
channel.queueBind("audit_queue", "event_bus", "#");          // 输出：匹配所有事件（# 任意层级）
// 错误用法：routingKey 不匹配任何 binding → 消息直接丢弃（无 mandatory 时）
```

## 二、Producer 端保障：Confirm 机制

### 2.1 同步 Confirm

```java
// 目的：开启 confirm 模式，确保消息到达 Exchange 并路由到 Queue
channel.confirmSelect();  // 结果：当前 Channel 进入 confirm 模式
channel.basicPublish("event_bus", "order.created", true, body);
boolean acked = channel.waitForConfirms();  // 输出：阻塞等待 Broker 回 ACK
// 说明：acked=true 表示消息已入 Queue；false 表示路由失败或内部异常
// 错误用法：不开 confirm → 消息"fire and forget" → Broker 宕机直接丢
```

### 2.2 异步 Confirm（高吞吐）

```java
// 目的：批量发送 + 回调确认，适合高吞吐场景
channel.addConfirmListener((seq, multiple) -> {
    // 结果：Broker 确认此 seq 之前的消息已入 Queue
    pending.remove(seq);
}, (seq, multiple) -> {
    // 错误：路由失败，触发重发逻辑
    resend(seq);
}, null);
```

## 三、Consumer 端保障：手动 ACK

```java
// 目的：手动 ACK 保证消息消费成功才从 Queue 移除
channel.basicConsume("order_queue", false,  // 说明：autoAck=false → 手动确认
    (tag, delivery) -> {
        try {
            process(delivery.getBody());  // 输出：执行业务逻辑
            channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);  // 结果：移除消息
        } catch (Exception e) {
            channel.basicNack(tag, false, true);  // 错误用法：requeue=true → 无限重投循环！
            // 正确做法：requeue=false → 进死信队列
        }
    }, null);
```

## 四、死信队列（DLX）

```java
// 目的：消费失败 / TTL 过期 / Queue 满 → 消息路由到 Dead Letter Exchange
Map<String, Object> args = new HashMap<>();
args.put("x-dead-letter-exchange", "dlx");         // 说明：死信投递目标 Exchange
args.put("x-dead-letter-routing-key", "order.dl"); // 结果：死信 routingKey
channel.queueDeclare("order_queue", true, false, false, args);

channel.exchangeDeclare("dlx", "direct", true);
channel.queueDeclare("order_dlq", true, false, false, null);
channel.queueBind("order_dlq", "dlx", "order.dl");
// 输出：三次 nack(requeue=false) 后消息进入 order_dlq → 人工排查
```

## 五、延迟消息

RabbitMQ 原生无延时级别，两种实现：

| 方案 | 原理 | 缺点 |
|------|------|------|
| TTL + DLX | 消息过期后进 DLX → DLX 路由到目标 Queue | 精度差（队列头阻塞） |
| rabbitmq_delayed_message_exchange 插件 | Exchange 类型 `x-delayed-message`，内部按延时排序投递 | 需装插件 |

```java
// 目的：插件方式实现 30min 后关未支付订单
channel.exchangeDeclare("delay_exchange", "x-delayed-message", true, false,
    Map.of("x-delayed-type", "direct"));  // 结果：注册延迟 Exchange
channel.basicPublish("delay_exchange", "order_close",
    new AMQP.BasicProperties.Builder().headers(Map.of("x-delay", 1800000)).build(),
    body);  // 输出：30min 后消息才投递到绑定的 Queue
// 错误用法：大量不同延迟时长消息堆积 → 插件基于 Mnesia 表性能瓶颈
```

## 六、关联技术

- Spring AMQP `RabbitTemplate` 封装 confirm + retry
- `prefetchCount` 控制未 ACK 消息数（公平分发）
- Quorum Queue（3.10+）替代镜像队列（Raft）
- RabbitMQ 与 Kafka 选型对比：路由灵活 vs 吞吐极致
