# 网关限流、熔断与统一认证 · 小测

### 1. RequestRateLimiter 依赖的外部存储是？（6分）

- A. MySQL
- B. Redis
- C. ZooKeeper
- D. Etcd

> 答案：B
> 解析：令牌桶算法基于 Redis Lua 脚本原子操作，多网关实例共享计数。

### 2. burstCapacity 的含义是？（6分）

- A. 每秒处理请求数
- B. 令牌桶最大容量（短时允许突发流量）
- C. 后端线程数
- D. 超时时间

> 答案：B
> 解析：桶容量 > replenishRate 时允许突发；等于时不允许任何突发。

### 3. Sentinel 网关适配器把什么作为限流资源？（6分）

- A. URL 正则
- B. Route ID
- C. HTTP Method
- D. IP 地址

> 答案：B
> 解析：adapter 自动将每个 Route 注册为 Sentinel 资源，限流规则按 Route ID 配置。

### 4. CircuitBreaker 降级后请求去向？（6分）

- A. 直接返回 500
- B. forward 到 fallbackUri 指定的路径
- C. 重试到其他实例
- D. 丢弃

> 答案：B
> 解析：`fallbackUri: forward:/fallback/xxx` → 网关内部转发到降级 Controller。

### 5. 网关统一认证后，后端服务如何获取用户身份？（6分）

- A. 再验一次 JWT
- B. 读取网关注入的 X-User-Id Header
- C. 从 Cookie 解析
- D. 查数据库

> 答案：B
> 解析：网关验证 JWT 后将 userId 注入透传 Header，后端信任该 Header。

### 6. 限流、熔断、认证的正确执行顺序是？（6分）

- A. 限流→认证→熔断
- B. 认证→限流→熔断
- C. 熔断→限流→认证
- D. 随意

> 答案：B
> 解析：先认证（拒绝无效请求），再限流（消耗令牌只算合法请求），最后熔断（只对转发请求判断）。

### 7. OAuth2 Resource Server 模式验证 JWT 需要什么配置？（6分）

- A. client-secret
- B. jwk-set-uri（公钥端点）
- C. redirect-uri
- D. scope 列表

> 答案：B
> 解析：资源服务器用 Auth Server 暴露的 JWKS 公钥验证 Token 签名。

### 8. RequestRateLimiter 返回 429 状态码时前端应？（多选）（9分）

- A. 展示"操作过于频繁"提示
- B. 自动无限重试
- C. 指数退避后重试
- D. 忽略当作正常

> 答案：A、C
> 解析：B 会加剧限流；D 体验差。

### 9. Sentinel 熔断降级对比 Resilience4j CircuitBreaker（多选）？（9分）

- A. Sentinel 规则可动态推送无需重启
- B. Resilience4j 内置更多熔断策略（慢调用率+异常率）
- C. Sentinel 对 SCG 有官方 Adapter
- D. Resilience4j 支持集群限流

> 答案：A、B、C
> 解析：D 错——Resilience4j 无集群限流；Sentinel 支持。

### 10. 简答题：设计电商秒杀场景的网关限流+降级方案。（40分）

- 要点1：全局限流：replenishRate=5000 burstCapacity=10000，按 IP 限制
- 要点2：接口限流：秒杀接口单独 Route，Sentinel QPS=1000
- 要点3：用户维度：userKeyResolver 每用户 1 req/s
- 要点4：降级：库存服务熔断 → fallback 返回"活动太火爆"
- 要点5：认证前置：未登录请求不消耗限流令牌 → 快速拒绝

> 答案：见要点
> 解析：秒杀峰值 10w+ QPS → 三层限流+熔断保后端。
