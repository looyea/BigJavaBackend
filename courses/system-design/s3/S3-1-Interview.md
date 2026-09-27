# 面试题：分布式消息 / 缓存 / ID 生成器设计

## 高频面试题

### Q1：如何设计一个不丢不重的消息队列？

**答题要点**：
- 生产端：acks=all + 幂等 Producer（PID+SeqNum）、事务 API
- Broker 端：多副本 ISR + min.insync.replicas≥2 + 禁用 unclean leader election
- 消费端：手动提交 offset + 业务幂等（去重表/Redis SETNX）
- 兜底：Outbox 表定时扫描补发

**追问方向**：Kafka 的 exactly-once 语义到底覆盖了哪些阶段？（答：仅 Producer→Broker 段，消费端仍需幂等）

### Q2：缓存和数据库的一致性如何保证？

**答题要点**：
- Cache Aside 模式：先更新 DB 再删缓存
- 极端情况兜底：Canal 订阅 binlog 异步删缓存
- 延迟双删：写前删 + 写后延迟 500ms 再删
- 强一致场景：Read/Write Lock 或 Write Through

**追问方向**：为什么不建议"先删缓存再更新 DB"？（答：中间并发读把旧值回填，缓存脏数据长期存在）

### Q3：Snowflake 生成 ID 在分布式部署中怎么分配 workerId？

**答题要点**：
- 静态配置：启动参数写死，容器化环境不灵活
- ZooKeeper/etcd 临时顺序节点：启动时注册获取递增编号
- IP/MAC 取低位：有碰撞概率，适合非严格场景
- 美团 Leaf-snowflake：ZK 持久节点 + 版本号乐观锁

**追问方向**：K8s Pod 重建后 workerId 可能复用，如何避免 ID 重复？（答：结合 Pod 序号 + 时间戳偏移；或用号段模式彻底规避）

### Q4：Redis Cluster 与 Codis / Twemproxy 的分片方式有何不同？

**答题要点**：
- Redis Cluster：客户端感知 slot（16384），服务端 MOVED 重定向，去中心化
- Codis/Twemproxy：Proxy 中间层路由，客户端透明，Proxy 本身是瓶颈/单点
- Cluster 原生高可用（Gossip + 自动故障转移）；Proxy 方案通常配合哨兵

**追问方向**：Cluster 不支持跨 slot 事务/MULTI，怎么绕过？（答：Hash Tag 把相关 Key 路由到同一 slot）

### Q5：MQ 的推拉模式各有什么优缺点？

**答题要点**：
- 推（Push）：Broker 主动推送，实时性好；但无法控制消费速率，容易压垮消费者
- 拉（Pull）：消费者自主拉取，可控制速率；但空闲轮询浪费资源、延迟高
- Kafka/RocketMQ 采用长轮询 Pull：无数据时请求挂起，有数据立即返回，兼顾实时与流控

**追问方向**：长轮询挂起的连接数如何控制上限？（答：Broker 端 hold 超时 + 连接池大小配置）

### Q6：号段模式如何做到不依赖 DB 单点？

**答题要点**：
- 双 Buffer：当前号段用完前预取下一号段，取号段时 DB 短暂不可用也不影响发放
- DB 主从 + 乐观锁 `UPDATE SET max_id=max_id+step WHERE biz_tag=? AND max_id=?`
- 部署多节点，每节点独立取段，号段不重叠
- 美团 Leaf 方案：号段 + Snowflake 混合，DB 仅做 workerId 分配

**追问方向**：如果应用重启后内存号段丢失，是否浪费一段 ID？（答：是，但不影响唯一性；趋势递增仍成立）

### Q7：如何设计一个支持百万 TPS 的全局 ID 服务？

**答题要点**：
- 架构层：无中心部署，每台机器独立生成，不依赖网络
- Snowflake：单机 409.6 万/秒（4096×1000）；100 台即 4 亿/秒
- 号段模式：步长设大（10 万），本地 AtomicLong 无锁发放
- 混合：对外 gRPC/HTTP 网关限流；内部直连 SDK 嵌入业务进程

**追问方向**：如何验证生成的 ID 全局唯一？（答：压测时收集所有 ID 放入 BloomFilter 或 HashSet 判重）

### Q8：缓存雪崩时如何做到服务降级而不雪崩到数据库？

**答题要点**：
- TTL 随机抖动避免集中过期
- 本地缓存（Caffeine）作为 L1 兜底
- 熔断器（Sentinel/Hystrix）：DB QPS 超阈值直接返回降级数据
- 热点探测 + 自动加载到本地

**追问方向**：熔断恢复后如何避免缓存集中回填压垮 DB？（答：逐步放量 + 互斥锁 singleflight 重建 + 预热脚本）
