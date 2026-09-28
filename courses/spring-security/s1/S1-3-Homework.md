# OAuth2/JWT 集成与 CSRF、方法级安全落地（关联） · 作业

### 作业 1：搭一个只拿公钥验签的资源服务器

- 目标：验证资源服务用 JWKS 公钥本地校验 JWT、私钥不外泄。
- 任务：配置 `spring.security.oauth2.resourceserver.jwt` 的 issuer-uri 与 jwk-set-uri，用一个真实/自签的 RS256 JWT 访问受保护接口；再构造一个"过期令牌"和一个"错误 issuer 令牌"，观察被拒。故意把校验改成共享对称密钥，说明为何不安全。
- 验收标准：合法令牌放行、过期/错 issuer 被拒；能说清验签用公钥、以及为什么必须校验 iss/aud/exp。
- 参考解法要点：JWKS 端点缓存公钥；`jwt.decoder` 的 validator 默认校验这些 claim。

### 作业 2：把权限点从 URL 收敛到方法

- 目标：体验 @PreAuthorize 细粒度鉴权与命名对齐坑。
- 任务：开启 `@EnableMethodSecurity`，给下单方法加 `@PreAuthorize("hasAuthority('SCOPE_order:write')")`、给管理方法加 `@PreAuthorize("hasRole('ADMIN')")`。先不加 `@EnableMethodSecurity` 观察注解静默失效，再开启。把 JWT 里的角色写成不带 `ROLE_` 前缀，复现 hasRole 一直 403，再通过自定义 GrantedAuthority 转换修复。
- 验收标准：不加开关注解不生效、加了才生效；能复现并修复前缀命名不一致导致的 403。
- 参考解法要点：JwtAuthenticationConverter 自定义 scope/claim → authorities 映射。

### 作业 3：CSRF 开与关的对照实验

- 目标：证明"凭证形态决定是否要 CSRF 防护"。
- 任务：同一套 API 做两种配置：A 用 Cookie 会话、B 用前端手动带 Bearer 头。都打开 CSRF 默认配置，观察 B 的 POST 因缺 Token 全 403；把 B 关闭 CSRF（`csrf().disable()`）后正常，而 A 必须保留 CSRF 且配 `CookieCsrfTokenRepository`。用一段跨站表单脚本验证 A 被拦、纯 Bearer 的 B 不受该攻击影响。
- 验收标准：能展示 CSRF 对 Cookie 会话的必要性、对无状态 Bearer 的可关性；说清混用场景的正确配置。
- 参考解法要点：CSRF 依赖浏览器自动附带凭证；无状态令牌跨站带不上，故风险来源不同。
