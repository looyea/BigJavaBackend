# 顺序、幂等、堆积与重试死信 · 小测

### 1. 实现分区有序的关键是？（6分）

- A. 全局单线程消费
- B. 相同业务 Key 路由到同一 Queue + Orderly Listener
- C. 消息带上时间戳排序
- D. Broker 内部排序

> 答案：B
> 解析：同一 Queue 内 CommitLog 追加顺序=FIFO；用 MessageQueueSelector 按 Key 哈希固定路由。

### 2. MessageListenerOrderly 与 Concurrently 的区别？（6分）

- A. 无区别
- B. Orderly 对 Queue 加锁单线程消费；Concurrently 多线程并发
- C. Orderly 不支持重试
- D. Concurrently 不能处理顺序消息

> 答案：B
> 解析：Orderly 保证同一 Queue 串行；Concurrently 线程池并行消费性能更高但不保证顺序。

### 3. 幂等消费最可靠的方案是？（6分）

- A. Redis SETNX
- B. 内存 HashMap 去重
- C. DB 唯一键 INSERT 冲突判断
- D. 消息 ID 布隆过滤器

> 答案：C
> 解析：DB 唯一键有事务保障，Redis 可能故障/过期；内存重启丢失；布隆有误判率。

### 4. 消费失败后 RocketMQ 默认最大重试次数是？（6分）

- A. 3
- B. 5
- C. 16
- D. 32

> 答案：C
> 解析：默认 maxReconsumeTimes=16，超过后进 DLQ。

### 5. %RETRY%group Topic 的作用是？（6分）

- A. 存放新消息
- B. 存放消费失败待重试的消息
- C. 存放死信
- D. 存放延迟消息

> 答案：B
> 解析：Consumer 返回 RECONSUME_LATER 后消息被投递到 %RETRY% Topic，按梯度延迟重新消费。

### 6. 消息堆积超过 Consumer 处理能力时，首先应？（6分）

- A. 删除堆积消息
- B. 确认 Queue 数是否可扩容 + 增加 Consumer 实例
- C. 重启 Broker
- D. 关闭持久化

> 答案：B
> 解析：核心瓶颈在消费并行度；Consumer 实例数 ≤ Queue 数才有效，需先扩 Queue 再扩实例。

### 7. 全局有序消息的实现代价是？（6分）

- A. 需要 ZooKeeper
- B. Topic 只允许 1 个 Queue，吞吐极低
- C. 必须用同步刷盘
- D. 必须用 Dledger

> 答案：B
> 解析：全局有序=单 Queue+单 Producer 串行发送，丧失了并行写能力。

### 8. 关于 DLQ 运维做法正确的是（多选）？（9分）

- A. DLQ 消息默认自动重新投递给 Consumer
- B. 应配置 DLQ 堆积告警（阈值如 100 条）
- C. 人工处理后可从控制台重投回原 Topic
- D. maxReconsumeTimes 设过高会让毒消息长时间堵塞重试队列

> 答案：B、C、D
> 解析：A 错——DLQ 不再自动投递，需人工消费或定时任务处理；B/C/D 是正确运维实践。

### 9. 以下会导致消息重复投递的有（多选）？（9分）

- A. Consumer 处理成功但 ACK 超时未到达 Broker
- B. Rebalance 后新实例从头 offset 重新消费
- C. Producer 发送超时重试
- D. Broker 异步刷盘

> 答案：A、B、C
> 解析：A—Broker 认为未消费重投；B—新实例可能重复；C—Producer 重试发两条相同消息；D—只影响持久性不影响投递次数。

### 10. 简答题：描述 RocketMQ 消费失败后的重试→死信完整流程，并说明为什么顺序消费模式下重试策略不同。（40分）

- 要点1：普通消费返回 RECONSUME_LATER → Broker 按延迟等级投 %RETRY% Topic → 重新投递
- 要点2：超过 maxReconsumeTimes（默认16）→ 消息移到 %DLQ% Topic，不再自动投递
- 要点3：顺序消费模式下不能投 RETRY Topic（否则打乱顺序），而是原地重试（SUSPEND_CURRENT_QUEUE_A_MOMENT）
- 要点4：这意味着一条毒消息会阻塞整个 Queue 后续消息，必须设告警人工干预

> 答案：见要点
> 解析：顺序消费的"重试不换队列"设计保证了有序性但放大了毒消息影响。
