# Exchange 类型与消息投递保证 · 作业

## 作业 1：四种 Exchange 路由实验

**目标**：用 Java 原生 AMQP 客户端分别演示 Direct / Fanout / Topic / Headers 路由效果。

1. 声明 Exchange + Queue + Binding。
2. 发送不同 routingKey/header 的消息。
3. 打印每个 Queue 收到的消息列表，验证路由规则。
4. 测试：Topic pattern `a.#.c` 匹配哪些 key（如 a.b.c / a.x.y.c / a.c）。

## 作业 2：可靠性全链路实现

**目标**：搭建 confirm + 持久化 + 手动 ACK + DLX 的完整链路。

1. Producer 端：开启 confirm，消息设 `delivery_mode=2`（persistent）。
2. Broker 端：Queue 声明 durable=true + x-dead-letter-exchange。
3. Consumer 端：autoAck=false，处理失败 nack(requeue=false)。
4. 模拟：发 100 条消息让其中 5 条处理异常 → 验证 95 条正常 ACK + 5 条进入 DLQ。

## 作业 3：延迟消息关单

**目标**：实现 30min 未支付自动关单。

1. 安装 `rabbitmq_delayed_message_exchange` 插件。
2. 声明 `x-delayed-message` Exchange。
3. 下单时发一条延迟 1800000ms 的消息到 `order_close_queue`。
4. Consumer 收到后查订单状态：已支付 → 跳过；未支付 → 关单。
5. 测试：支付成功时是否能"取消"延迟消息（讨论：不可取消，只能在消费时判断）。
