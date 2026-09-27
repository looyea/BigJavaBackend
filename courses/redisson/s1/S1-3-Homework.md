# 作业题 · 布隆过滤器、限流器与 RMapCache

> 作业不判分，做完对照参考答案自查。需要本地 Redis + Redisson 工程。

## 作业 1：布隆误判率与"不可删"实测（必做）

```java
// 例子目的：建 expectedInsertions=100万、误判率 1% 的 RBloomFilter，插入 100 万个真实 ID
RBloomFilter<Long> bf = redisson.getBloomFilter("t:bloom");
bf.tryInit(1_000_000L, 0.01);
for (long i = 0; i < 1_000_000; i++) bf.add(i);       // 灌入全集
long hit = 0; for (long i = 2_000_000; i < 3_000_000; i++) if (bf.contains(i)) hit++; // 查 100 万个不存在的
// 记录 hit/100万 ≈ 1%（假阳性率）——正确使用结果：不存在元素约 99% 被 contains=false 挡下
bf.add(1L); bf.delete(1L);                            // 错误用法预期：delete 抛 UnsupportedOperation / 无效——Bloom 不支持删除
```

注释贴实测假阳性率与 delete 报错，验证"判无可信、不可删除"。

## 作业 2：限流器 OVERALL vs PER_CLIENT（必做）

起 3 个 JVM（或 3 个 main），对同一 `RRateLimiter` key 分别用 `OVERALL` 和 `PER_CLIENT` 设 rate=10/s，客户端每秒尝试 acquire 100 次，统计**全局**每秒实际通过数。

**参考答案要点**：OVERALL → 全局稳定 ≈10/s；PER_CLIENT → 全局 ≈10×3=30/s（每节点各限各的）——生产限集群总 QPS 必须 OVERALL，用错档等于没限住。

## 作业 3：RMapCache per-entry TTL + 旁路写脏读（必做）

`RMapCache.put("a", 1, 3, SECONDS)` 轮询 get 观察 3s 后消失；再开两节点 A/B 都用同一 RMapCache near-cache，A `put` 更新后 B 读（走 Redisson）应拿到新值，然后**用 redis-cli 直接 HSET 改值**，B 再读——观察 B 仍读到旧值。

**参考答案要点**：Redisson 途径的更新会发失效消息清对方本地缓存；旁路直写绕过框架、不触发失效 → near-cache 脏读。要么全走 Redisson，要么放弃本地缓存层。

## 作业 4：穿透防护组合拳（选做）

用一个不存在的 ID 集合压测查询接口：① 只加布隆；② 布隆+空值缓存。统计两者各自打到 DB 的请求数与随时间变化（模拟布隆里有"已删除但位仍在"的 key）。

**参考答案要点**：布隆挡掉大部分"必不存在"，但假阳性 + 已删除 key 仍漏到 DB；叠加空值短 TTL 后这部分被二次拦截，DB 压力进一步降到接近 0。

## 作业 5：原语选型卡片（选做）

为"接口限 QPS""限制同时导出任务数""防商品穿透""热点配置读加速"各选一件（RRateLimiter/RSemaphore/RBloomFilter/RMapCache），写一句理由贴组内。

**参考答案要点**：限流→RRateLimiter(OVERALL)；限并发任务→RSemaphore；防穿透→RBloomFilter+空值；读加速→RMapCache(near-cache)。体现"速率 vs 并发""挡穿透 vs 加速读"两组易混辨析。
