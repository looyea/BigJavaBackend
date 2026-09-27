# 网关限流、熔断与统一认证 · 面试题

## 题 1：令牌桶和漏桶的区别？SCG 用哪种？

| 维度 | 令牌桶 | 漏桶 |
|------|--------|------|
| 突发流量 | 允许（桶内有余量时） | 不允许（恒定速率流出） |
| 实现 | Redis + Lua（原子） | 队列 + 固定速率消费 |

SCG `RequestRateLimiter` = 令牌桶（`replenishRate` 放令牌，`burstCapacity` 桶容量）。

## 题 2：网关多实例部署时限流如何保证准确？

Redis 集群共享：令牌桶状态存在 Redis 中（Lua 脚本原子扣减），所有网关实例请求同一个 Redis → 限流计数全局一致。若用本地 Guava RateLimiter → 只能单机限流。

## 题 3：熔断降级后用户体验如何保障？

```java
// 目的：降级不只是返回 503——应返回"有意义的兜底数据"
@RequestMapping("/fallback/product")
public Mono<ResponseEntity<ProductVO>> productFallback(@RequestParam Long id) {
    // 说明：从本地缓存/静态 CDN 返回（可能是过期数据但展示可用）
    ProductVO cached = localCache.getIfPresent(id);  // 输出：兜底商品快照
    if (cached != null) return Mono.just(ResponseEntity.ok(cached));
    return Mono.just(ResponseEntity.status(503).build());  // 结果：无缓存才报错
}
```

## 题 4：网关认证 vs 微服务各自认证的区别？

- 网关统一认证：一处验 JWT → 后端信任内网 Header → 简化后端。
- 服务各自认证：每个服务独立验 Token → 适合开放 API/多租户。
- 生产最佳实践：网关认证 + 内网 mTLS 确保调用只来自网关。

## 题 5：Sentinel 熔断规则中的"慢调用比例"是什么意思？

```text
统计窗口内（如 5s），响应时间 > 阈值（如 2s）的调用占比 > 比例阈值（如 50%）
→ 触发熔断 → 持续时长（timeWindow）内所有请求走降级 → 之后 Half-Open 试探
```

比"异常比例"更早发现问题——服务没报错但响应极慢 → 可能快挂了。

## 题 6：网关层限流触发后如何通知下游服务降速？

- 429 + Retry-After Header：告知客户端等待时间。
- 配合 MQ：秒杀超出的请求不入 HTTP → 进 MQ 异步处理（削峰）。
- Sentinel 预热（Warm-Up）模式：冷启动时逐步放开 QPS → 避免瞬间打挂服务。
