# Exchange 类型与消息投递保证 · 小测

### 1. Topic Exchange 中 routingKey `order.*` 能匹配？（6分）

- A. order.created.extra
- B. order.created
- C. order
- D. user.created

> 答案：B
> 解析：`*` 匹配恰好一个单词；`#` 匹配零或多个。order.* 匹配 order.created 但不匹配 order.created.extra。

### 2. Fanout Exchange 的路由特点是？（6分）

- A. 按 routingKey 精确匹配
- B. 广播到所有绑定的 Queue，忽略 routingKey
- C. 按 header 匹配
- D. 只投递到第一个 Queue

> 答案：B
> 解析：Fanout 无视 routingKey，消息复制到每个绑定 Queue。

### 3. Producer Confirm 机制确认的是？（6分）

- A. Consumer 消费成功
- B. 消息已写入磁盘
- C. 消息到达 Exchange 并成功路由到 Queue
- D. 消息已被 ACK

> 答案：C
> 解析：Confirm 只保证 Broker 侧接收+路由；Consumer ACK 是另一层保障。

### 4. autoAck=true 的风险是？（6分）

- A. 消息重复投递
- B. Broker 投递即删，Consumer 处理失败则消息丢失
- C. 消费速度变慢
- D. Queue 堆积

> 答案：B
> 解析：自动确认后消息立即从 Queue 移除，Consumer 崩溃则无法重新投递。

### 5. basicNack(tag, false, true) 中第三个参数 requeue=true 的效果是？（6分）

- A. 消息进入死信
- B. 消息重新放回原 Queue 头部
- C. 消息被丢弃
- D. 消息延迟重试

> 答案：B
> 解析：requeue=true → 放回 Queue → 同一 Consumer 立刻再次收到 → 若逻辑不变则无限循环。

### 6. 死信队列的触发条件不包括？（6分）

- A. nack 且 requeue=false
- B. 消息 TTL 过期
- C. Queue 达到MaxLength
- D. Consumer ACK 超时

> 答案：D
> 解析：ACK 超时只是 Broker 重投，不会进 DLX；A/B/C 是三大死信触发条件。

### 7. RabbitMQ 延迟消息 TTL+DLX 方案的"队列头阻塞"问题是？（6分）

- A. 网络带宽不足
- B. 先入队的长 TTL 消息挡住后面短 TTL 消息的过期投递
- C. Exchange 路由慢
- D. Consumer 处理慢

> 答案：B
> 解析：Queue 按 FIFO 检查过期——队头不过期则后续即使已过 TTL 也不投递到 DLX。

### 8. 以下关于 RabbitMQ 消息可靠性说法正确的是（多选）？（9分）

- A. 持久化 Exchange + 持久化 Queue + persistent 消息 = Broker 重启不丢
- B. 镜像队列（或 Quorum Queue）防止单节点故障
- C. Confirm + 手动 ACK + DLX 形成完整链路保障
- D. 只要开启持久化就万无一失

> 答案：A、B、C
> 解析：D 错——持久化只防重启丢，不防路由失败/Consumer 崩溃；需多层配合。

### 9. prefetchCount 的作用是（多选）？（9分）

- A. 限制 Channel 未 ACK 的消息数
- B. 实现公平分发（多 Consumer 轮询）
- C. 增加消息持久化
- D. 控制 Consumer 并行度

> 答案：A、B
> 解析：C 错——与持久化无关；D 有争议——prefetch 影响单 Channel 积压量但不等于线程并行度。

### 10. 简答题：一条消息从 Producer 发出到 Consumer 成功处理，经历哪些可靠性保障环节？（40分）

- 要点1：Producer 开启 confirm → Broker ACK 确认消息入 Queue（否则重发）
- 要点2：Exchange + Queue + Message 全部持久化 → Broker 重启不丢
- 要点3：镜像队列/Quorum Queue → 单节点故障不丢
- 要点4：Consumer autoAck=false → 处理完毕才 basicAck
- 要点5：处理失败 → nack(requeue=false) → DLX → 人工介入；保证消息有去无回不丢失

> 答案：见要点
> 解析：五层保障形成"发送确认 → 持久存储 → 冗余 → 消费确认 → 死信兜底"完整链路。
