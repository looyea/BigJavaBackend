# 小测验：Slab 架构与与 Redis 的对比

### 1. Memcached 的 Slab 分配器主要解决什么问题？（10分）
- A. 网络吞吐不足
- B. 频繁 malloc/free 导致的内存碎片
- C. 单线程性能瓶颈
- D. 数据持久化
> 答案：B
> 解析：Slab 把内存按大小分级预分配（Page→Chunk），避免运行时碎片化。

### 2. Memcached 的 Page 默认大小是？（5分）
- A. 4KB
- B. 64KB
- C. 1MB
- D. 64MB
> 答案：C
> 解析：Memcached 默认 1MB Page，分配给某一 Slab Class 后按 chunk_size 等分。

### 3. 以下关于 Memcached 淘汰策略的说法，正确的是？（10分）
- A. 支持 8 种可配置的淘汰策略
- B. 全局 LRU + 惰性过期删除
- C. 支持按频率（LFU）淘汰
- D. 内存满时报错不淘汰
> 答案：B
> 解析：Memcached 只有全局 LRU，过期 item 在被访问时才删除；不支持 Redis 的多策略。

### 4. Memcached 的线程模型是？（10分）
- A. 单线程事件循环
- B. 多线程，每个 Worker 独立 epoll
- C. 协程模型
- D. 无连接复用
> 答案：B
> 解析：Memcached 用 Listener + N 个 Worker 线程各自 epoll，天然利用多核。

### 5. 以下哪些是 Memcached 相比 Redis 的劣势？（多选，10分）
- A. 不支持持久化
- B. 不支持主从/集群自动故障转移
- C. 不支持复杂数据结构
- D. 不支持多线程
> 答案：A、B、C
> 解析：D 不是劣势——Memcached 天然多线程，反而是 Redis 长期是单线程（6.0+ 仅 IO 多线程）。

### 6. Memcached 单个 Value 的最大大小限制是？（10分）
- A. 64KB
- B. 1MB
- C. 512MB
- D. 无限制
> 答案：B
> 解析：Memcached 硬限制单 item 最大 1MB；Redis 可达 512MB。

### 7. 判断："Memcached 集群扩缩容时不需要 rehash 所有 Key。"（5分）
- A. 正确
- B. 错误
> 答案：B
> 解析：Memcached 依赖客户端一致性哈希分片，节点变动时大部分 Key 需要重新映射。

### 8. Memcached 的 Slab Class 之间的 Page 能否互相借用？（10分）
- A. 可以自由借用
- B. 分配给某 Class 后不能改属（硬隔离）
- C. 通过 rebalance 在线迁移
- D. 自动按需求增长
> 答案：B
> 解析：经典 Memcached 中 Page 一旦分配给某个 Slab Class 就不能还给其他 Class，导致内存浪费（Growth 问题）。

### 9. 简答题：Memcached 为什么在大多数新项目中被 Redis 取代？列出至少 4 个原因。（15分）
> 参考答案：
> - 无持久化：重启数据全丢，Redis 有 RDB/AOF
> - 无原生高可用：无主从/哨兵/Cluster，Redis 三者兼具
> - 数据结构单一：仅 KV bytes，Redis 有 6+ 数据结构
> - 内存管理僵化：Page 归属 Class 后不可变；Redis 用 jemalloc 灵活分配
> - 生态与功能：Redis 有 Lua 脚本/Stream/模块系统/PubSub 等

### 10. 简答题：Memcached 在什么场景下仍比 Redis 有优势？（15分）
> 参考答案：
> - 超大 key 量纯 KV 缓存：多线程天然利用多核，高并发短连接吞吐有竞争力
> - 极简需求不需要持久化/数据结构/集群：部署维护成本更低
> - Session 共享：PHP/Java 老项目大量依赖 Memcached session handler，生态成熟
> - 历史系统兼容：短期迁移成本 > 收益时保留 Memcached
