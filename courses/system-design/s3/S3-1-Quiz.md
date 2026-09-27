# 小测验：分布式消息 / 缓存 / ID 生成器设计

### 1. Kafka 中 ISR 的含义是？（10分）
- A. In-Sync Replica，与 Leader 保持同步的副本集合
- B. Internal State Recovery，内部状态恢复机制
- C. Indexed Sequential Access，顺序索引访问
- D. Instant Send Retry，即时发送重试
> 答案：A
> 解析：ISR 是与 Leader 保持同步的 Follower 副本集合，只有 ISR 内的副本才有选举 Leader 的资格。

### 2. Cache Aside 模式中，更新数据的正确顺序是？（10分）
- A. 先删缓存再更新数据库
- B. 先更新数据库再删缓存
- C. 先更新缓存再更新数据库
- D. 顺序无关紧要
> 答案：B
> 解析：先更新 DB 再删缓存，把"不一致窗口"缩到最短。若先删缓存再写 DB，中间有读请求会把旧值回填缓存。

### 3. 以下哪些是防止缓存击穿的合理手段？（多选，10分）
- A. 互斥锁（singleflight）只让一个线程重建
- B. 热点 Key 逻辑过期不真正删除
- C. 布隆过滤器
- D. 永不过期 + 异步更新
> 答案：A、B、D
> 解析：布隆过滤器解决的是缓存穿透（查不存在数据），不是击穿。击穿指热点 Key 过期瞬间大量请求穿透到 DB。

### 4. Snowflake 算法中 12 位序列号意味着什么？（10分）
- A. 最多支持 4096 台机器
- B. 同一毫秒内同一节点最多生成 4096 个 ID
- C. ID 总长度为 4096 bit
- D. 最多支持 4096 个数据中心
> 答案：B
> 解析：12 位序列号 = 2^12 = 4096，表示同一毫秒同一 worker 节点内的自增序号上限。

### 5. 号段模式相比 Snowflake 的主要优势是？（10分）
- A. 性能更高
- B. 不依赖系统时钟
- C. ID 严格全局递增
- D. 不需要任何中间件
> 答案：B
> 解析：号段模式从 DB 取段，不依赖机器时钟，彻底规避时钟回拨问题。代价是需要 DB 作为发号依赖。

### 6. 关于 Kafka 消息可靠性，以下说法正确的有？（多选，10分）
- A. acks=all 要求 ISR 全部副本确认
- B. min.insync.replicas=2 意味着至少 2 个 ISR 副本写入成功
- C. 开启 enable.idempotence 后 Producer 重试不会产生重复消息
- D. unclean.leader.election.enable=true 可保证消息绝不丢失
> 答案：A、B、C
> 解析：D 错误——开启 unclean leader election 允许非 ISR 副本当 Leader，恰恰可能导致数据丢失。

### 7. Redis Cluster 的数据分片粒度是？（10分）
- A. 按 Key 的哈希值取模 N 个节点
- B. 固定 16384 个 hash slot，每个节点负责若干 slot
- C. 按 Key 前缀路由
- D. 一致性哈希环
> 答案：B
> 解析：Redis Cluster 采用 16384 slot 虚拟分桶，CRC16(key)%16384 映射到 slot，slot 再分配给节点。

### 8. 判断："布隆过滤器可以 100% 准确判断一个 Key 是否存在。"（5分）
- A. 正确
- B. 错误
> 答案：B
> 解析：布隆过滤器只能"判断不存在则一定不存在"，"判断存在则可能存在误判"。

### 9. 简答题：设计一个分布式消息系统时，如何保证消息不丢不重？请列出生产端、Broker 端、消费端各需做什么。（10分）
> 参考答案：
> - 生产端：acks=all + 重试 + 幂等 Producer（PID+SeqNum）确保不丢不重
> - Broker 端：ISR 机制 + min.insync.replicas>=2 + 禁止 unclean leader election + 多副本持久化
> - 消费端：关闭自动提交 offset，业务处理成功后手动 commit；幂等消费或去重表兜底
> - 全局兜底：事务消息或 Outbox 模式确保"本地写+发消息"原子性

### 10. 简答题：Redis Cluster 扩容时数据如何迁移？客户端如何感知新拓扑？（5分）
> 参考答案：
> - 以 slot 为单位迁移，源节点标记 MIGRATING、目标标记 IMPORTING，逐 key 搬运
> - 客户端收到 MOVED/ASK 重定向后更新本地 slot 映射表
> - 迁移期间对未迁走 key 返回 ASK 让目标回源读取
> - 全部 slot 迁移完成后集群元数据同步，业务无感
