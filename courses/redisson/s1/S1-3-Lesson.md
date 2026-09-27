# 布隆过滤器、限流器与 RMapCache

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：把 redis/lettuce 两包点到的"现成原语"真正用起来——**`RBloomFilter`**（位图 + 多哈希，判"无"一定无、判"有"可能假阳性）落地缓存穿透防护；**`RRateLimiter`**（令牌桶，`RateInterval` 配速率）做分布式限流，讲清它和 `RSemaphore`（限并发 vs 限速率）的分工；**`RMapCache`**（带 TTL/驱逐的分布式 Map，本地+Redis 二级）作为多级缓存的 Redisson 实现。每个都给"能直接抄"的配置 + 正反用例，并点出各自**最易踩的坑**（布隆不能删元素、限流器时钟与预消费、RMapCache 与 RMap 的区别）。

## 一、RBloomFilter：把穿透挡在 Redis 层（★★★★★）

回顾 redis s2-1：穿透=大量查**根本不存在**的 key，每次都击穿缓存打到 DB。布隆用 m 位位图 + k 个哈希把全集压成极小内存，**判"不存在"绝对可信**，直接返回空、不放行到 DB。

```java
// 例子目的：商品 ID 全集预载入布隆，查询先过布隆再决定打不打 DB
RBloomFilter<Long> bf = redisson.getBloomFilter("product:bloom");
bf.tryInit(100_000_000L, 0.03);      // 预期 1 亿元素、误判率 3%（tryInit 幂等，已存在则不重置；错误用法：每个节点启动都 init → 反复清空已构建的集合）
bf.add(88001L);                       // 上线的商品 ID 加入集合（正确：写入侧新增/下架要同步维护布隆）
...
Long id = 99999L;
if (!bf.contains(id)) return EMPTY;   // 判"无"→ 一定不存在，直接返回，DB 零压力（正确使用结果：拦截绝大多数穿透请求）
// 判"有"→ 可能存在（3% 假阳性），放行走正常"查缓存→查库"链路
Product p = cache.get(id);            // 因为不能全信 contains，命中布隆仍要走缓存兜底
if (p == null) { p = db.load(id); if (p==null) return EMPTY; cache.put(id, p); }
// 致命边界：RBloomFilter 不支持删除（位被多个元素共享）！商品下架不能从布隆移除 → 会持续"假阳性"放行到 DB。
//   对策：数据删除靠"DB 查不到→缓存空值短 TTL"兜底；集合大规模变更时用 Counting/Scalable Bloom 或定期重建
```

> 与 redis s2-1"空值缓存"组合拳：布隆挡掉**必不存在**的大头，空值缓存兜住**假阳性 + 已删除**的部分——两者叠加才完整。

## 二、RRateLimiter：令牌桶限速率（★★★★★）

```java
// 例子目的：全集群对某下单接口限"每秒最多 100 次"
RRateLimiter limiter = redisson.getRateLimiter("order:rl");
limiter.trySetRate(RateType.OVERALL, 100, 1, RateIntervalUnit.SECONDS); // OVERALL=所有节点合计 100/s（正确：跨进程共享令牌桶；错误用法：RateType.PER_CLIENT 只限本节点，多副本下总速率=100×副本数，形同没限）
...
if (limiter.tryAcquire(1, 3, TimeUnit.SECONDS)) {  // 取 1 个令牌，最多等 3s（等不到返回 false 快速失败，别用无界 acquire 堵死线程）
    placeOrder();
} else {
    throw new TooManyRequestsException();           // 限流走降级：排队/友好提示，而非直接 500
}
// 正确使用结果：无论部署多少副本，接口整体 ≤100/s；突发由桶容量吸收，平滑放行
// 陷阱：RateLimiter 基于 Redis 服务端时间+令牌预消费，集群节点时钟漂移或极高精度场景会有偏差；它是"限流保护"不是"计费级精确计量"
```

**`RRateLimiter` vs `RSemaphore`（高频辨析）**：

| | RRateLimiter | RSemaphore |
| --- | --- | --- |
| 限的是 | **速率**（每秒/每分钟通过多少）| **并发数**（同时在进行多少）|
| 模型 | 令牌桶 | 许可计数 |
| 场景 | 接口 QPS 限流、调用外部 API 配额 | 限制同时在跑的任务/连接数 |

## 三、RMapCache：带过期的分布式 Map（★★★★☆）

`RMap` 是 Redis Hash 的对象化，但**没有 per-entry TTL**；`RMapCache` 额外支持**每个条目独立过期 + 驱逐策略**，并内置**本地缓存（near-cache）**，是 Redisson 版多级缓存。

```java
// 例子目的：用户会话/配置项本地+Redis 双级缓存，条目各自 TTL
RMapCache<String, String> mc = redisson.getMapCache("user:session");
mc.put("u:1001", data, 30, TimeUnit.MINUTES);        // 该条目 30 分钟后自动过期（正确：per-entry TTL，RMap 做不到）
// 本地缓存模式：限制本地条目数 + 失效广播，其他节点 update/evict 会通知本节点清本地缓存
// 错误用法：数据被别的节点直接改 Redis 而不走 Redisson 的 RMapCache 失效消息 → 本地缓存读到旧值（本地缓存依赖 Redisson 自身的发布订阅失效，旁路写入会破坏一致性）
String v = mc.get("u:1001");                          // 命中本地→返回；未命中→回 Redis→回填本地（呼应 caffeine s1-2 多级缓存思想）
```

> 选型：纯共享、无本地加速需求 → `RMap`；要 per-key 过期或本地加速 → `RMapCache`；两者都受 Cluster 多 key 槽约束（跨槽操作不可用，呼应 redis s1-2）。

## 四、动手题

1. 用 `RBloomFilter`（1 亿元素/1% 误判）测：查 1000 万个不存在 ID，统计放行到 DB 的比例 ≈ 误判率；再 `add` 后 `remove` 验证"不支持删除"报错。
2. `RRateLimiter` 设 5/s，起 20 线程瞬间打，记录通过时间戳——观察令牌桶的匀速放行与突发吸收。
3. `RMapCache.put(k,v,3,SECONDS)` 后轮询 `get`，验证条目到期自动消失、而 `RMap.put` 的条目永不过期。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 布隆过滤器越用假阳性越高 | 只 add 不重建，元素数远超 `tryInit` 预估容量 |
| 想从布隆删下架商品失败 | Bloom 原理不支持删除 → 用空值缓存兜底或换 Counting Bloom |
| 多副本下限流"没生效" | 用了 `PER_CLIENT` 而非 `OVERALL`，总速率随副本翻倍 |
| RMapCache 本地缓存读到脏值 | 有节点绕过 Redisson 直接写 Redis，失效广播未触发 |
| RRateLimiter 偶发放行超配额 | 集群时钟漂移/预消费，限流器是保护非精确计量 |

## 六、关联技术栈

- **向前**：穿透/空值缓存 ↔ redis s2-1；限并发 ↔ s1-2 的 RSemaphore；Cluster 槽约束 ↔ redis s1-2
- **向后**：与 Lettuce 分工/落地边界 ↔ s1-4
- **横向**：多级缓存 ↔ caffeine 包；接口限流降级 ↔ 高可用专区

## 七、本节小结

三个原语各补一块拼图：**`RBloomFilter`** 用位图+多哈希把全集压到极小，"判无必真无"，在 Redis 层挡掉缓存穿透大头——代价是不能删除、有假阳性，需与空值缓存组合兜底；**`RRateLimiter`** 是跨节点共享的令牌桶，限的是**速率**（`OVERALL` 才管得住集群总 QPS），与限**并发数**的 `RSemaphore` 分属两件事；**`RMapCache`** 给 Redis Hash 加上 per-entry TTL 与 near-cache 本地加速，是 Redisson 版多级缓存，但其本地一致性依赖自身失效广播、旁路写会破坏它。用它们的共同前提仍是——**理解每件的边界，别把近似当精确、别绕过框架写同一份数据**。下一节收尾 Redisson 与 Lettuce 的协同与分布式锁落地边界。
