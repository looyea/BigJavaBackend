# 消费组与再平衡 · 小测

### 1. 同一 Consumer Group 内一个 Partition 可被几个 Consumer 消费？（6分）

- A. 多个（并行）
- B. 仅 1 个
- C. 最多 2 个
- D. 取决于 replication.factor

> 答案：B
> 解析：分区是消费的最小并行单位——组内一个分区只分配给一个 Consumer，保证有序。

### 2. 不同 Consumer Group 之间的关系是？（6分）

- A. 互斥（一条消息只被一组消费）
- B. 独立订阅（各组都消费全量消息）
- C. 共享位移
- D. 轮询分配

> 答案：B
> 解析：每个 Group 独立维护位移 → 全量消息被每组各消费一次 = 发布/订阅模型。

### 3. Cooperative 再平衡相比 Eager 的核心优势是？（6分）

- A. 速度更快
- B. 无需 Consumer 参与
- C. 未变动分区不暂停消费（增量迁移）
- D. 不需要 Group Coordinator

> 答案：C
> 解析：Eager 全停全让再重新分配；Cooperative 只回收/分配变动分区，其余继续消费。

### 4. 自动提交位移（enable.auto.commit=true）的风险是？（6分）

- A. 性能变慢
- B. 处理未结束即提交 → 宕机丢消息；或提交滞后 → 重复消费
- C. Partition 数不够
- D. Consumer 无法加入组

> 答案：B
> 解析：5s 定时提交可能与处理进度不一致——最坏 at-most-once（丢）或 at-least-once（重）。

### 5. max.poll.interval.ms 超时后 Broker 的处理是？（6分）

- A. 丢弃未处理消息
- B. 认为 Consumer 死亡 → 踢出组 → 触发 Rebalance
- C. 暂停 Topic 写入
- D. 自动增大 poll 限制

> 答案：B
> 解析：两次 poll 间隔超过此值 → Coordinator 判断 Consumer 无响应 → 回收分区。

### 6. __consumer_offsets 是什么？（6分）

- A. ZooKeeper znode
- B. 内部 Topic，存储各组各分区的消费位移
- C. 本地文件
- D. 外部 Redis 集群

> 答案：B
> 解析：Kafka 用内部 Topic（compact 策略）记录位移，不再依赖 ZK。

### 7. 事务 Producer 实现精确一次的关键步骤是？（6分）

- A. 设置 acks=0
- B. sendOffsetsToTransaction 将消费位移与生产消息原子提交
- C. 每条消息单独 commit
- D. 关闭所有重试

> 答案：B
> 解析：EOS = 消费位移更新 + 结果消息写入 在同一事务内原子完成（begin→send→sendOffsets→commit）。

### 8. 以下哪些操作会触发 Rebalance？（多选）（9分）

- A. Consumer 调用 subscribe() 加入已有组
- B. Producer 发送速率提升
- C. Topic 新增 Partition
- D. Consumer 宕机超 session.timeout.ms

> 答案：A、C、D
> 解析：B 错——Producer 行为不影响 Consumer 分配；A/C/D 均触发组内分区重新分配。

### 9. 关于 ConsumerRebalanceListener 说法正确的是（多选）？（9分）

- A. onPartitionsRevoked 在被回收分区前调用，适合提交位移
- B. onPartitionsAssigned 在获得新分区后调用，可 seek 到特定位移
- C. Eager 协议下 revoked 传入全部分区
- D. 只在 Cooperative 协议下生效

> 答案：A、B、C
> 解析：D 错——Eager 和 Cooperative 都调 Listener，只是 revoked 范围不同（全量 vs 增量）。

### 10. 简答题：描述 Kafka 从 Consumer 启动到消费第一条消息的完整 Rebalance 流程。（40分）

- 要点1：Consumer 调用 subscribe/poll → 向 Group Coordinator 发 JoinGroup 请求
- 要点2：Coordinator 收集所有成员元数据 → 选出一位 Consumer 为 Leader → 下发 SyncGroup
- 要点3：Leader Consumer 执行 Assignor 算法（Range/Sticky/CooperativeSticky）计算分配方案
- 要点4：Coordinator 将方案通过 SyncGroup Response 发给每个 Consumer
- 要点5：Consumer 调用 onPartitionsAssigned → 从 __consumer_offsets 读取上次位移 → 开始 poll 拉取消息

> 答案：见要点
> 解析：整个流程由 Coordinator 协调、Client 端 Leader 计算分配方案（Kafka 选择客户端分配减轻 Broker 负担）。
