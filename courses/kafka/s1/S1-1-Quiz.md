# 分区、副本与 ISR 机制 · 小测

### 1. Kafka Partition 的存储本质是？（6分）

- A. B+Tree 索引结构
- B. Append-only 顺序日志（Segment 文件）
- C. Hash 分桶
- D. B-Tree 页式存储

> 答案：B
> 解析：每个 Partition 是只追加的 commit log，按 Segment 切分，天然顺序写。

### 2. ISR 中副本落后的判定超时参数是？（6分）

- A. session.timeout.ms
- B. replica.lag.time.max.ms
- C. fetch.max.wait.ms
- D. linger.ms

> 答案：B
> 解析：默认 30s——Follower 超过此时间未追上 Leader 最后一条消息则被踢出 ISR。

### 3. acks=all 保证的是？（6分）

- A. 消息被 Consumer 消费成功
- B. 消息被所有 ISR 副本写入确认
- C. 消息被所有副本（含 OSR）写入
- D. 消息已 fsync 到磁盘

> 答案：B
> 解析：acks=all 要求 ISR 中全部副本确认写入；OSR 副本可能落后但未要求确认。

### 4. min.insync.replicas=2 的效果是？（6分）

- A. Topic 必须有 2 个分区
- B. ISR 数量 < 2 时拒绝 Producer 写入
- C. 至少保留 2 个 Segment 文件
- D. Consumer 至少 2 实例

> 答案：B
> 解析：配合 acks=all——若 ISR 缩到 1（< min）→ 抛 NotEnoughReplicasException → 保证至少 2 副本有数据。

### 5. 零拷贝（sendfile）带来的收益是？（6分）

- A. 消息不丢
- B. 减少数据从内核到用户态再回到内核的内存拷贝
- C. 增加副本同步速度
- D. 压缩消息体积

> 答案：B
> 解析：传统路径 Disk→Kernel→User→Socket→Kernel→NIC；零拷贝省掉 User 态中转：PageCache→NIC。

### 6. 同一 Partition 内消息的特征是？（6分）

- A. 无序
- B. 按 offset 严格递增有序
- C. 按 key 排序
- D. 按时间戳排序

> 答案：B
> 解析：offset 是分区内唯一递增序号，保证追加顺序即逻辑顺序；跨分区不保证。

### 7. unclean.leader.election.enable=false 的含义是？（6分）

- A. 禁止 Leader 选举
- B. 只允许 ISR 内副本成为新 Leader
- C. 允许任何副本当 Leader
- D. 需要人工选 Leader

> 答案：B
> 解析：false → 只从 ISR 选 → 可能短暂不可用但不丢数据；true → OSR 也可选 → 可用性↑ 但可能丢。

### 8. 以下哪些是 Kafka 高吞吐的原因？（多选）（9分）

- A. 顺序写磁盘
- B. 零拷贝 sendfile
- C. 批量压缩（Producer linger + compression）
- D. 每条消息同步刷盘

> 答案：A、B、C
> 解析：D 错——Kafka 默认异步刷盘（依赖 OS PageCache + 多副本容灾）；A/B/C 是高吞吐三大支柱。

### 9. 关于 Kafka 幂等 Producer 说法正确的是（多选）？（9分）

- A. enable.idempotence=true 开启
- B. 通过 PID + Sequence Number 去重
- C. 只能保证单 Partition 内不重复
- D. 可跨 Topic 全局去重

> 答案：A、B、C
> 解析：D 错——幂等 Producer 只在单分区单 Session 内保序去重，不跨 Partition/Topic。

### 10. 简答题：设计一套 Kafka 配置使其在 3 Broker 集群上达到"最多容忍 1 节点故障且不丢消息"。（40分）

- 要点1：replication.factor=3 → 每分区 3 副本分布在不同 Broker
- 要点2：min.insync.replicas=2 → ISR 至少 2 副本才接受写入
- 要点3：acks=all → Producer 等 ISR 全部确认
- 要点4：unclean.leader.election.enable=false → 只从 ISR 选 Leader 不丢数据
- 要点5：结果——1 节点挂后 ISR 剩 2 ≥ min → 继续写入；Leader 挂从 ISR 选新 Leader → 零丢失

> 答案：见要点
> 解析：四参数协同形成"写入不丢 + 选举不丢"的双重保障。
