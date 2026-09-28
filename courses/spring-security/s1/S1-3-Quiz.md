# OAuth2/JWT 集成与 CSRF、方法级安全落地（关联） · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. 资源服务器本地校验 JWT 时，验签应使用（6分）

- A. 和授权服务器共享的对称密钥下发到每个服务
- B. 通过 jwk-set-uri 获取的授权服务器公钥
- C. 客户端传来的密钥
- D. 不需要验签

> 答案：B
> 解析：非对称 RS256 下私钥留授权服务器、资源服务只拿公钥验签；把对称密钥散发到各服务会放大泄露面。

### 2. 关于 JWT 校验必须检查的 claim，正确的是（6分）

- A. 只看有没有签名
- B. 验签 + iss/aud/exp 等，防止串 issuer、过期令牌与错受众
- C. 只看过期
- D. 全不用查

> 答案：B
> 解析：仅验签不够，还要校验签发者、受众、有效期等，否则别的系统签的或过期令牌会被误接受。

### 3. 让 `@PreAuthorize` 生效必须开启（6分）

- A. @EnableWebSecurity
- B. @EnableMethodSecurity
- C. @Configuration
- D. 什么都不用

> 答案：B
> 解析：Spring Security 6 用 `@EnableMethodSecurity`，缺它方法级注解静默失效，是高频坑。

### 4. `hasRole('ADMIN')` 实际比对的权限是（6分）

- A. ADMIN
- B. ROLE_ADMIN
- C. SCOPE_ADMIN
- D. ROLE.ADMIN

> 答案：B
> 解析：`hasRole` 自动补 `ROLE_` 前缀；若 JWT claim 存的是不带前缀的值会一直鉴权失败，命名要对齐。

### 5. 纯 Bearer Token 的无状态 API 通常可以关闭 CSRF，原因是（6分）

- A. REST 天生安全
- B. 认证凭证不会被浏览器自动携带，攻击者无法借 Cookie 机制伪造请求
- C. JWT 无法被窃取
- D. CSRF 只针对 GET

> 答案：B
> 解析：CSRF 利用"浏览器自动附带 Cookie"，Bearer 头需脚本显式加、跨站带不上，故可关；但混用 Cookie 就必须开。

### 6. 针对 JWT"签发后到期前难吊销"的短板，常见补救是（6分）

- A. 把令牌有效期设成一年
- B. 短 TTL + 刷新令牌，或服务端维护黑名单（如 Redis）主动失效
- C. 不校验过期
- D. 存进 Cookie

> 答案：B
> 解析：自包含 JWT 无法服务端单方作废，需靠短时效+刷新或引入黑名单来支持即时吊销。

### 7. 不透明令牌（opaque token）需要校验时一般用（6分）

- A. 本地 JWT 验签
- B. Token Introspection 调授权服务器内省
- C. 不解码
- D. 查 Cookie

> 答案：B
> 解析：不透明令牌本身无信息，需向内省端点校验有效性，好处是可即时吊销、坏处是每次要联网。

### 8.（多选）资源服务器配置 JWT 校验时应做的事有（9分）

- A. 用 jwk-set-uri 取公钥验签
- B. 校验 iss/aud/exp
- C. 把 claim 的 scope/role 正确映射为权限并命名对齐
- D. 把私钥也下发到资源服务

> 答案：A、B、C
> 解析：D 严重错误，私钥绝不能离开授权服务器；A/B/C 是资源服务正确校验步骤。

### 9.（多选）关于 CSRF 与令牌存放，正确的有（9分）

- A. Cookie 会话必须开 CSRF 防护
- B. 纯手动带 Authorization 头的 Bearer 可关 CSRF
- C. 混用 Cookie 的接口若关 CSRF 或不配 Token 仓库会出现写操作异常
- D. 所有 REST API 无论凭证形态都应强制开 CSRF

> 答案：A、B、C
> 解析：D 太绝对，CSRF 是否必要取决于凭证是否被浏览器自动携带，无状态 Bearer 可关。

### 10. 为一个前后端分离的电商 API 设计 Spring Security 授权方案：授权服务器签发 JWT、多个资源服务校验、前端存令牌手动带头。请说明资源服务器如何校验、权限如何落到方法、CSRF 该不该开，以及如何处理令牌吊销。（40分）

> 参考答案：
- 要点1：资源校验——配 issuer-uri + jwk-set-uri，用授权服务器公钥本地验签并校验 iss/aud/exp，私钥不外泄；不透明令牌场景才走内省（10分）
- 要点2：权限到方法——开启 @EnableMethodSecurity，用 @PreAuthorize 结合 hasAuthority('SCOPE_..')/hasRole('ROLE_..')，把 claim 命名与表达式对齐避免 403（10分）
- 要点3：CSRF 取舍——纯 Bearer 手动带头、浏览器不会自动附带，可安全关闭；一旦有 Cookie 认证接口就必须开并配 Token 仓库（10分）
- 要点4：吊销兜底——短 access TTL + refresh token，重要操作引入 Redis 黑名单/版本号在服务端主动失效，弥补 JWT 不可即时吊销（10分）
