# 可靠性语义、幂等与消息不丢不重 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. `acks=all(-1)` 真正能防丢的前提是（6分）

- A. 只要设了 `-1` 就行
- B. 配合 `replication.factor>=3` 且 `min.insync.replicas>=2`
- C. 关闭副本
- D. `acks=1` 等价

> 答案：B
> 解析：ISR 至少留 2 个副本确认才有冗余；`RF=1/min.insync=1` 时 leader 崩即丢，`all` 名不副实。

### 2. 当 ISR 数量低于 `min.insync.replicas` 时，broker 对 `acks=all` 的写入会（6分）

- A. 静默丢弃
- B. 抛 `NotEnoughReplicasException` 拒绝写入
- C. 降级为 `acks=0`
- D. 排队永久等待

> 答案：B
> 解析：宁可暂时不可用也不违反不丢承诺——直接拒写，这是用可用性换持久性的体现。

### 3. `unclean.leader.election.enable=false` 的意义是（6分）

- A. 提升吞吐
- B. 禁止落后过多的非 ISR 副本当 leader，避免丢已确认数据
- C. 加速再平衡
- D. 开启幂等

> 答案：B
> 解析：让非 ISR 上位能尽快恢复可用，但它可能缺已确认消息→丢数据；关掉它换"不丢"。

### 4. 幂等 Producer（`enable.idempotence=true`）主要解决（6分）

- A. 消费慢
- B. 网络/重试导致的**单分区内重复**
- C. 跨分区事务原子性
- D. 分区不均衡

> 答案：B
> 解析：靠 (PID+sequence) 让 broker 去重重试副本，实现分区内 exactly-once；跨分区原子要靠事务。

### 5. 幂等 Producer 生效的约束不包括（6分）

- A. `acks=all`
- B. `max.in.flight.requests.per.connection<=5`
- C. `retries` 足够
- D. `enable.auto.commit=true`

> 答案：D
> 解析：auto.commit 是消费端配置，与生产幂等无关；A/B/C 是幂等 Producer 的前提。

### 6. 要做到"消费不丢"，提交 offset 的正确时机是（6分）

- A. poll 到就自动提交
- B. 业务处理成功后再手动提交（`enable.auto.commit=false`）
- C. 从不提交
- D. 交给 broker 提交

> 答案：B
> 解析：先提交后处理，一旦处理失败/崩溃该消息位点已过、永久丢；必须处理成功再提交。

### 7. 关于端到端 exactly-once（EOS），正确说法是（6分）

- A. 开幂等就自动端到端 EOS
- B. 跨分区原子与 read-process-write 需用 Kafka 事务（`transactional.id`）
- C. EOS 没有任何代价
- D. 消费端无需幂等

> 答案：B
> 解析：EOS 靠事务把"消费位点提交+生产"原子化；有协调开销，工业常用"至少一次+消费幂等"替代。

### 8.（多选）以下哪些会造成"消息丢失"的窗口？（9分）

- A. `acks=1` 且 leader 未同步就崩溃
- B. 消费端处理前 `auto.commit` 提交了位点，随后处理失败
- C. `RF=3, min.insync=2, acks=all`
- D. 非 ISR 副本被选为 leader（开了 unclean 选举）

> 答案：A、B、D
> 解析：C 是正确的高可靠配置，不构成丢窗口；A/B/D 都是典型丢消息路径。

### 9.（多选）关于"不重"的治理，正确的有（9分）

- A. 生产端开幂等消除重试导致的分区内重复
- B. 消费端用业务唯一键/去重表/upsert 兜底 at-least-once 的重投
- C. 幂等 Producer 能替你去重业务层面的重复消息
- D. 需要跨分区原子时用事务

> 答案：A、B、D
> 解析：C 错——幂等 Producer 只对分区内技术重试去重，业务重复要靠消费幂等。

### 10. 一个金融"支付成功事件"链路要求不丢不重。请设计生产、broker、消费三段配置，并说明为什么单靠幂等 Producer 不够。（40分）

> 参考答案：
- 要点1：生产不丢——`acks=all` + 幂等 Producer（`enable.idempotence=true`、`retries` 大、`in.flight<=5`），配合发送回调/同步确认失败重试（10分）
- 要点2：broker 不丢——`RF>=3`、`min.insync.replicas>=2`、`unclean.leader.election=false`；ISR 不足时拒写而非丢（10分）
- 要点3：消费不丢不重——`auto.commit=false` 处理成功后再 `commitSync`；因重投必致重复，用业务唯一键（支付流水号）去重表/`upsert` 做幂等（10分）
- 要点4：为何幂等不够——幂等只解决"生产重试"的分区内重复，跨分区/消费失败重投/重复投递仍会产生业务重复，必须叠加消费幂等；若还要"读事件-写下游-提交位点"原子才上事务（10分）
