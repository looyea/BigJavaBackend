# 事务消息与最终一致性 · 小测

### 1. RocketMQ 事务消息的"半消息"对谁不可见？（6分）

- A. Producer
- B. Consumer
- C. Broker
- D. NameServer

> 答案：B
> 解析：半消息写入 RMQTRANS_HALF 内部 Topic，普通 Consumer 订阅不到，只有 Commit 后才复制到真实队列。

### 2. 事务消息两阶段提交的第二阶段是？（6分）

- A. 发送半消息到 Broker
- B. Broker 返回 ACK
- C. 执行本地事务并 Commit/Rollback 半消息
- D. Consumer 消费确认

> 答案：C
> 解析：一阶段=发半消息；二阶段=本地事务执行后通知 Broker Commit（投递）或 Rollback（删除）。

### 3. 回查机制触发的条件是？（6分）

- A. Consumer 消费失败
- B. Producer 未在规定时间内发 Commit/Rollback 二次确认
- C. Broker 磁盘满
- D. NameServer 不可用

> 答案：B
> 解析：Broker 等待 transactionCheckInterval 后主动向 Producer Group 回查本地事务状态。

### 4. 回查次数超过 transactionCheckMax（默认15）后 Broker 怎么做？（6分）

- A. 继续回查直到成功
- B. 丢弃半消息（视为 Rollback）
- C. 投递到真实队列
- D. 通知 NameServer 告警

> 答案：B
> 解析：超过上限认为本地事务大概率失败，Broker 主动删除半消息保证不投递。

### 5. 以下哪种场景不适合用事务消息？（6分）

- A. 下单后通知库存扣减
- B. 同步等待下游返回余额（强一致）
- C. 支付成功后发积分
- D. 注册后发欢迎短信

> 答案：B
> 解析：事务消息保证最终一致，不适合需要同步返回结果的强一致场景（应用 Seata/XA）。

### 6. Consumer 端为何要做幂等处理？（6分）

- A. 减少网络传输
- B. 事务消息 Commit 后可能因网络抖动重复投递
- C. Broker 不支持去重
- D. 幂等可以提高消费速度

> 答案：B
> 解析：RocketMQ 保证至少一次投递（At Least Once），重复消费必须靠业务幂等。

### 7. 半消息存储在哪个内部 Topic？（6分）

- A. RMQ_SYS_TRANS_HALF_TOPIC
- B. SCHEDULE_TOPIC_XXXX
- C. %RETRY%group
- D. DLQ_topic

> 答案：A
> 解析：半消息写入 RMQ_SYS_TRANS_HALF_TOPIC，Commit 后复制到目标真实 Topic。

### 8. 事务消息保证最终一致性的要素包括（多选）？（9分）

- A. 半消息机制暂存消息
- B. 回查保证 Producer 宕机后仍能确认
- C. Consumer 端重试 + 幂等
- D. 同步双写保证零延迟

> 答案：A、B、C
> 解析：D 错——事务消息是异步最终一致，不要求同步双写；A/B/C 是三个环节的保障。

### 9. 与本地消息表（Outbox）模式相比，事务消息的优势是（多选）？（9分）

- A. 不需要额外 DB 表
- B. 实时性更好（无需定时扫描）
- C. 完全不需要幂等
- D. 与业务代码耦合度更低

> 答案：A、B
> 解析：C 错——重复投递仍需幂等；D 有争议——需实现回查接口其实有耦合；A/B 是核心优势。

### 10. 简答题：画出事务消息的完整交互时序图（文字描述），并说明回查解决什么问题。（40分）

- 要点1：Producer 发送半消息到 Broker（写入 HALF Topic）→ Broker 返回 ACK
- 要点2：Producer 执行本地事务（DB INSERT/UPDATE）→ 成功则 Commit，失败则 Rollback
- 要点3：Commit → Broker 将半消息复制到真实 Topic → Consumer 可消费
- 要点4：若 Producer 宕机未发 Commit/Rollback → Broker 定时回查同组任一存活实例
- 要点5：回查查的是本地事务表/状态 → 已完成则 COMMIT，否则 UNKNOW 再查或 ROLLBACK；解决二阶段悬而未决问题

> 答案：见要点
> 解析：回查是补偿手段，保证即使 Producer 异常也不会有"永远不可见的半消息"。
