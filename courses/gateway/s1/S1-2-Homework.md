# 网关限流、熔断与统一认证 · 作业

## 作业 1：Redis 令牌桶限流

**目标**：配置 RequestRateLimiter 并用 JMeter 验证。

1. 启动 Redis + SCG，配置 replenishRate=5 burstCapacity=10。
2. ipKeyResolver 按 IP 限流。
3. JMeter 10 线程 1s 内发 50 请求 → 观察约 10 个成功（桶容量），其余 429。
4. 等 2s 后再发 → 又恢复可用。

## 作业 2：Sentinel 流控 + 自定义降级响应

**目标**：使用 Sentinel 对 Route 级限流。

1. 引入 sentinel-gateway-adapter，启动 Sentinel Dashboard。
2. 在 Dashboard 为 order-route 配流控规则 QPS=20。
3. 自定义 BlockRequestHandler 返回 `{"code":429,"msg":"流量过大"}`。
4. 压测 50 QPS → Dashboard 实时曲线观察通过/拒绝数。

## 作业 3：OAuth2 网关集成

**目标**：网关作为 Resource Server 校验 JWT。

1. 部署简易 Auth Server（Spring Authorization Server），签发 JWT。
2. 网关配置 `spring.security.oauth2.resourceserver.jwt.jwk-set-uri`。
3. 无 Token → 401；有效 Token → 转发且后端收到 X-User-Id。
4. Token 过期 → 401；用 refresh_token 续期后成功。
