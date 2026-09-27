# 课后作业：Slab 架构与与 Redis 的对比

## 作业 1：Slab 机制分析（40分）

场景：一台 8GB 内存的 Memcached 服务器，存储三类数据：
- 5 亿个平均 80 字节的 Session ID → value
- 1000 万个平均 500 字节的用户 Profile JSON
- 100 个平均 800KB 的大报表缓存

要求：
1. 分析这三类数据分别落在哪个 Slab Class 区间，估算各自占用的 Page 数。
2. 指出"大报表缓存"为什么不适合 Memcached（接近 1MB 限制），并给出替代方案。
3. 假设实际 80% 数据是 80B 的 Session，Slab 预分配导致 Class-500B 的 Page 大量空闲浪费。如何调整 `growth_factor` 参数缓解？
4. 讨论：如果用 Redis 替代，同样的数据量内存开销会怎样？（考虑 jemalloc 碎片 + listpack/quicklist 编码）

## 作业 2：Memcached vs Redis 选型决策（30分）

要求：针对以下 3 个场景分别选择 Memcached 或 Redis，说明理由：
1. 电商 Session 集群（5000 万并发会话，只需 GET/SET/DEL，TTL 30 分钟）。
2. 社交动态 Feed 缓存（需要 ZSet 按时间排序、List 存最近 N 条、PubSub 推送更新）。
3. IoT 设备状态缓存（10 亿设备 × 200 字节 KV，无需持久化，要求极致吞吐）。

## 作业 3：迁移方案设计（30分）

场景：一个老旧 Java 项目使用 Memcached 做缓存 + Session 共享，现计划迁移到 Redis Cluster。

要求：
1. 设计双写迁移方案：写 Memcached 同时写 Redis → 切读 → 停写 Memcached。
2. 处理接口差异：Memcached CAS → Redis WATCH；Memcached 一致性哈希 → Redis Cluster slot。
3. 列出 Memcached 特性在 Redis 中的对应实现（Increment、Touch/TTL、Stats）。
4. 回滚方案与风险点：迁移期间 Memcached 有未过期热数据，Redis 如何预热？
