# RocketMQ 架构与存储模型 · 小测

### 1. RocketMQ 中 NameServer 的设计特点是？（6分）

- A. 有状态集群，节点间通过 Paxos 同步
- B. 无状态，各节点互不通信，Broker 向所有 NameServer 注册
- C. 基于 ZooKeeper 的 CP 注册中心
- D. 只负责消息存储

> 答案：B
> 解析：NameServer 极简设计——每个节点独立保存全量路由表，AP 模型，Broker 每 30s 心跳注册。

### 2. CommitLog 的写入方式是？（6分）

- A. 按 Topic 分别写入不同文件
- B. 所有 Topic 消息混合顺序追加到同一文件
- C. 随机写入 B+Tree 结构
- D. 按消费组分区存储

> 答案：B
> 解析：混合顺序写是 RocketMQ 高吞吐的核心——利用磁盘顺序 I/O 性能接近内存。

### 3. ConsumeQueue 每条记录的大小是？（6分）

- A. 变长，取决于消息体
- B. 固定 20B（Offset+Size+TagHash）
- C. 固定 64B
- D. 4KB 一个 page

> 答案：B
> 解析：定长 20B 使 queueOffset 可通过 index×20 O(1) 计算物理位置，无需查找。

### 4. 异步刷盘（ASYNC_FLUSH）的风险是？（6分）

- A. 吞吐降低
- B. Broker 断电时 PageCache 中未 fsync 的消息丢失
- C. 消息重复
- D. ConsumeQueue 损坏

> 答案：B
> 解析：数据仅写入 OS PageCache 即返回 ACK，掉电后未落盘部分丢失。

### 5. Dledger 模式底层使用的共识算法是？（6分）

- A. Paxos
- B. Zab
- C. Raft
- D. Gossip

> 答案：C
> 解析：DLedger = Raft 实现，过半节点确认才算写入成功，Leader 挂后秒级重新选举。

### 6. Broker 与 NameServer 的心跳间隔默认是？（6分）

- A. 5s
- B. 30s
- C. 60s
- D. 300s

> 答案：B
> 解析：Broker 每 30s 向所有 NameServer 发 RegisterBrokerRequest；NameServer 每 10s 扫描超 120s 未心跳的节点剔除。

### 7. ReputMessageService 的作用是？（6分）

- A. 将消息从 Slave 复制到 Master
- B. 异步从 CommitLog 构建 ConsumeQueue 和 IndexFile
- C. 定时清理过期消息文件
- D. 处理 Consumer 拉取请求

> 答案：B
> 解析：消息写入 CommitLog 后由 ReputMessageService 分发到逻辑队列索引，通常延迟 ms 级。

### 8. 以下关于 RocketMQ 刷盘与复制策略说法正确的是（多选）？（9分）

- A. SYNC_MASTER + SYNC_FLUSH 提供最强可靠性
- B. ASYNC_MASTER 消息复制到 Slave 是异步的
- C. 异步刷盘时 Broker 宕机可能丢消息
- D. Dledger 模式下仍需手动配置 Master/Slave

> 答案：A、B、C
> 解析：D 错——Dledger 自动选举 Leader/Follower，无需手动指定角色。

### 9. RocketMQ 消息删除的机制包括（多选）？（9分）

- A. 按时间过期（默认 72h）
- B. 磁盘使用率达 75% 时立即删除最老 CommitLog
- C. 消息被消费后立即物理删除
- D. 文件粒度删除（整个 1GB CommitLog 文件）

> 答案：A、B、D
> 解析：C 错——RocketMQ 不按条删除（顺序文件），靠文件级过期清理；A/B/D 均为实际策略。

### 10. 简答题：描述从 Producer 发送一条消息到 Consumer 消费成功的完整存储路径。（40分）

- 要点1：Producer 从 NameServer 获取 Topic 路由→选择 QueueId→发送消息到 Broker
- 要点2：Broker 将消息顺序追加到 CommitLog（先写 PageCache，按策略决定是否 fsync）
- 要点3：ReputMessageService 后台线程从 CommitLog 分发→构建 ConsumeQueue 条目（20B 定长）和 IndexFile
- 要点4：Consumer 长轮询 PullMessage→Broker 根据 Consumer 提交的 queueOffset 读 ConsumeQueue→得到物理 offset→从 CommitLog 读出消息体→返回 Consumer
- 要点5：Consumer 本地消费成功后提交新 offset 到 Broker（或本地文件）

> 答案：见要点
> 解析：整个路径体现了"一次写（CommitLog）+ 多次读（ConsumeQueue 索引）"的设计。
