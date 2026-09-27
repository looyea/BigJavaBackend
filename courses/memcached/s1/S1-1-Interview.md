# 面试题：Slab 架构与与 Redis 的对比

## 高频面试题

### Q1：Memcached 的 Slab 分配器是什么？为什么需要它？

**答题要点**：
- 问题：频繁 malloc/free 不同大小对象 → 内存碎片 → 有效内存利用率下降
- 方案：预分配 1MB Page → 按 chunk_size 等分为 Slab Class → item 分配只从对应 Class 的 free chunk 链表取
- 优点：O(1) 分配/释放，无外部碎片
- 缺点：Class 间 Page 不可借用 → 内部碎片（chunk 比 item 大就浪费）

**追问方向**：Redis 为什么不用 Slab？（答：Redis 用 jemalloc 做通用分配器，粒度更细无硬隔离；且 Redis 需要支持动态数据结构大小变化）

### Q2：Memcached 与 Redis 的线程模型有何不同？各自的优劣？

**答题要点**：
- Memcached：多线程，每 Worker 独立 epoll → 天然利用多核，但 Slab 全局锁争抢
- Redis：主线程单线程处理命令 → 无锁争抢、简单可靠；6.0+ IO 多线程只并行读写网络
- Memcached 在高并发短连接场景吞吐量可能更高（多核）
- Redis 单核性能极高（避免线程切换），复杂数据结构操作原子性天然保证

**追问方向**：Redis 6.0 IO 多线程为什么没有并行执行命令？（答：命令执行仍是单线程保证原子性和简单性；只有网络读写和协议解析并行化）

### Q3：Memcached 集群方案与 Redis Cluster 有什么本质区别？

**答题要点**：
- Memcached：无原生集群，依赖客户端一致性哈希分片；节点变动需 rehash
- Redis Cluster：服务端 16384 slot 分片 + Gossip 协议 + 自动故障转移 + MOVED 重定向
- Memcached 扩缩容需要应用层感知拓扑变化；Redis Cluster 对客户端基本透明
- Memcached 无副本 → 节点宕机该分片数据全丢；Redis 每 slot 可配多副本

**追问方向**：客户端一致性哈希的好处是什么？（答：服务端极简无需协调；适合"纯缓存丢了可从 DB 回填"场景）

### Q4：为什么 Memcached 正在被取代？什么场景下还值得用？

**答题要点**：
- 被取代原因：无持久化、无 HA、功能单一、Page 归属僵化
- 仍有价值：超大 key 纯 KV、多线程多核吞吐、老系统兼容性
- 新项目默认选 Redis；Memcached 仅作为历史包袱维护
- 如果只需要"高速 KV 缓存 + 可容忍全部丢失"，Memcached 仍然简洁高效

**追问方向**：你负责的系统里有 Memcached 还值得迁移吗？（答：如果没有高可用需求且运行稳定，迁移成本 > 收益则不迁；如果有持久化/数据结构需求则必须迁）

### Q5：Memcached 的 LRU 有什么问题？Redis 如何改进？

**答题要点**：
- Memcached：全局 LRU 链表 + 惰性删除（过期 item 不主动清理，只在 Get 时判断）
- 问题：大量过期 item 占内存但不被清理（无后台定期扫描）；LRU 容易被偶发扫描污染
- Redis：近似 LRU（采样 pool）+ 定期主动过期扫描 + LFU（4.0+按频率）
- Redis 8 种 maxmemory-policy 可灵活应对不同淘汰需求

**追问方向**：近似 LRU 为什么用采样而不是真 LRU 链表？（答：真 LRU 需要每个 key 维护双向链表指针，内存开销大；Redis 用 16 个候选的采样池近似）
