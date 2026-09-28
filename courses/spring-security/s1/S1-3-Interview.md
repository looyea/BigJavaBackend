# OAuth2/JWT 集成与 CSRF、方法级安全落地（关联） · 面试题

## 题 1：资源服务器怎么校验 JWT？为什么用公钥而不是密钥？

- 配 issuer-uri + jwk-set-uri，从授权服务器 JWKS 拿公钥本地验签，并校验 iss/aud/exp。
- 非对称 RS256：私钥只留在授权服务器用于签发，公钥可安全下发给任意资源服务验签，避免对称密钥散发导致泄露面扩大。
- 加分：提到不透明令牌（opaque）走 Token Introspection 内省，代价是每次联网但可即时吊销。

## 题 2：JWT 只验签够吗？还要查什么？

- 不够。还要校验签发者 iss、受众 aud、过期 exp（及必要 nonce），防止别的系统签的令牌、过期令牌或错受众被误接受。
- 加分：解释 Spring 的 `JwtValidators`/createDefault 默认就查这些。

## 题 3：@PreAuthorize 不生效的常见原因？

- 忘了 `@EnableMethodSecurity`（Security 6）→ 注解静默失效。
- 权限命名不对齐：`hasRole('ADMIN')` 比对的是 `ROLE_ADMIN`，claim 不带前缀就一直失败；`hasAuthority('SCOPE_x')` 对应 JWT 的 scope。
- 加分：说自定义 `JwtAuthenticationConverter` 把 claim 映射成合适的 GrantedAuthority。

## 题 4：无状态 REST API 要不要开 CSRF？判断依据是什么？

- 关键看认证凭证会不会被浏览器"自动携带"。Cookie 会话会自动带 → 必须开；纯 Bearer 头由脚本显式加、跨站带不上 → 可关。
- 不是"因为是 REST 就随便关"，混用 Cookie 就必须开并配好 Token 仓库，否则写操作会 403。
- 加分：给出关 CSRF 的安全前提与混用场景的正确姿势。

## 题 5：JWT 签发后如何"即时吊销"？

- 自包含 JWT 到期前无法服务端单方作废，是固有短板。
- 补救：access 用短 TTL + refresh token 续期；重要场景引入 Redis 黑名单或令牌版本号，在校验时额外查一次实现主动失效。
- 加分：权衡"每次查库/Redis"与"吊销即时性"，或改用内省的不透明令牌天然可吊销。

## 题 6：设计一套前后端分离的授权方案，你会怎么落地？

- 授权服务器签发 RS256 JWT，资源服务只拿 JWKS 公钥本地校验，权限用 @PreAuthorize 落到方法并与 claim 命名对齐。
- 无状态 Bearer 关闭 CSRF，全程 HTTPS 传输；令牌吊销用短 TTL+刷新+黑名单兜底。
- 加分：把 scope 设计成可审计的权限点，配合最小权限与集中审计日志。
