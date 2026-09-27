# 实际面试题 · 布隆过滤器、限流器与 RMapCache

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。考"布隆原理与局限、Redisson 限流、多级缓存"。

## 题 1：布隆过滤器的原理？为什么判"无"可信、判"有"不可信？

**期望时长**：90 秒

**答题要点**：

- m 位位图 + k 个独立哈希：加入元素时把 k 个位置 1；查询看这 k 位是否全 1。
- 判"无"：只要有一位是 0，该元素必未加入（因为只有它会置那几位）→ 绝对可信；
- 判"有"：k 位全 1 可能是**别的元素的哈希碰撞**凑出来的 → 假阳性，非真存在。

**追问链**：误判率受什么影响？→ 位数组大小 m、哈希个数 k、元素数 n；n 越接近或超过 m 设计容量误判越高。Redisson `tryInit(expectedInsertions, fpp)` 会据此算 m、k。

## 题 2：Redisson RBloomFilter 能删元素吗？数据下架了怎么办？

**答题要点**：

- 不能——删会把别的共享该位的元素也误删（标准 Bloom）；Redisson 未实现真删除。
- 下架/删除数据：靠"DB 查不到→写空值短 TTL 缓存"兜底假阳性与已删除项；集合大规模变更用 **Counting Bloom / Scalable Bloom** 或定期重建。

**追问链**：那布隆能替代空值缓存吗？→ 不能，二者互补：布隆挡"必不存在"的量大穿透，空值缓存兜"假阳性+已删除"的例外，叠加才闭环。

## 题 3：RRateLimiter 的原理，和 Guava RateLimiter、RSemaphore 区别？

**答题要点**：

- Redisson：令牌桶状态存 Redis，**Lua 原子取令牌**，跨节点共享 → 限**全集群速率**；`OVERALL` 全局、`PER_CLIENT` 每节点。
- Guava RateLimiter：单 JVM，进程内限流，管不了多副本总和。
- RSemaphore：限**并发数**（同时进行多少），不是速率；RRateLimiter 限**频率**（每秒多少）。

**追问链**：Redisson 限流精度问题？→ 依赖 Redis 服务端时间 + 令牌预消费，集群时钟漂移/极端并发下有偏差，定位是"过载保护"非"计费级计量"；要精确配额用专门的限流中间件（Sentinel）或按窗口计数。

## 题 4：RMapCache 和 RedisTemplate 缓存 Map 有什么不同？

**答题要点**：

- RMap = Redis Hash 对象化（原子操作、可重入、支持读/write-through 加载器）；RMapCache 再加 **per-entry TTL + 驱逐 + near-cache 本地二级缓存**。
- RedisTemplate 手工 `HSET` 无 per-field 过期（Redis Hash field 本身不支持 TTL，只能整 key 过期）。

**追问链**：near-cache 一致性怎么保证？→ 靠 Redisson 的发布订阅失效广播，节点间更新互相通知清本地；但**旁路直写 Redis 不触发失效**会读到脏值——用本地缓存就要统一走 Redisson 写路径，或接受短暂不一致。

## 题 5：设计一个商品详情多级缓存，会用到现在讲的哪些件？

**答题要点**：

- 一级本地：`RMapCache`/Caffeine near-cache（热点读加速、per-key TTL）；
- 二级共享：Redis（`RMap`/RedisTemplate）；
- 防穿透：`RBloomFilter`（挡必不存在）+ 空值缓存（兜假阳性/删除）；
- 防击穿：热点 key 用 `RLock` 互斥重建 或逻辑过期（呼应 redis s2-1）；
- 限流兜底：`RRateLimiter` 限回源/接口 QPS，防雪崩打垮 DB。

**追问链**：这么多层，缓存与 DB 一致性放哪？→ Cache Aside：更新 DB 后删缓存（提交后删+重试+TTL 兜底，呼应 redis s2-2）；本地缓存层再加失效广播；接受最终一致而非强一致，按业务容忍度定 TTL。
