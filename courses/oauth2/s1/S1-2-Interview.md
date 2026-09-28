# 授权码 + PKCE、scope 与令牌存储 · 面试题

## 题 1：PKCE 到底防什么？为什么公共客户端特别需要它？

- 防授权码注入/截获：code 经不可信前端通道回跳，被恶意 App 或抓包拿到就能换 token。
- 机制：客户端预生成一次性 `code_verifier`，authorize 只发其哈希 `code_challenge`，换 token 时带原文，AS 重算比对——截到 code 没有 verifier 也换不出。
- 公共客户端（SPA/移动）藏不住 client_secret，失去了"客户端认证"这道锁，PKCE 就是补上的替代。
- 加分：机密客户端也推荐叠加 PKCE（OAuth 安全 BCP），防的是授权码拦截而不只是缺 secret。

## 题 2：S256 和 plain 有什么区别？什么时候能用 plain？

- S256：`challenge = BASE64URL(SHA256(verifier))`，即使 challenge 在 authorize 通道泄露也推不出 verifier。
- plain：`challenge = verifier`，challenge 泄露等于 verifier 泄露，PKCE 保护归零。
- 实践：只接受 S256；plain 仅给无法做 SHA-256 的极端受限客户端兜底，生产应禁用。
- 加分：指出"同时接受 plain 和 S256"本身就是缺陷——攻击者会诱导降级。

## 题 3：redirect_uri 为什么必须精确匹配？宽松匹配会怎样？

- 回调 URI 决定 code 发去哪，是信任锚点；前缀/子域匹配会被 `registered.com.evil.com`、路径穿越等构造绕过。
- 后果：攻击者注册一个能匹配到自己服务器的 URI，诱导用户走授权，code 落到攻击者手里→换 token→账户接管。
- 正确姿势：协议 + host + port + path 全等比较，动态端口（原生应用 loopback）按 RFC 8252 特殊处理。
- 加分：能提"开放重定向"这一同源漏洞家族，和 state 一起构成回调侧双保险。

## 题 4：state 和 PKCE 是不是重复了？各防什么？

- 不重复，防的是不同攻击：state 防**CSRF/会话固定**（攻击者诱导用户完成一次以自己 code 开头的授权，把受害者登录成攻击者）。
- PKCE 防**授权码截获后被换 token**（保护 code 的"发起者绑定"）。
- 两者作用点不同：state 在客户端回跳时校验、和会话绑定；PKCE 在 AS 换 token 时校验、和授权请求绑定。
- 加分：nonce 是 OIDC 里 id_token 对应 state 的东西，防的是 id_token 注入——三个词分清层级即高分。

## 题 5：为什么不建议把 token 存 localStorage？那存哪？

- localStorage 无脚本隔离，一次 XSS 一行 `localStorage.token` 就把 access/refresh 全偷走，且长期驻留。
- Web 机密客户端：token 留服务端 session，浏览器只拿 HttpOnly+Secure+SameSite 会话 cookie。
- SPA：优先 BFF 代理令牌不下发；实在纯前端就内存持有 + 静默刷新，降低持久化窃取面。
- 加分：HttpOnly cookie 挡 XSS 但引入 CSRF 风险，必须配 SameSite + CSRF token——安全是权衡不是单选。

## 题 6：scope 该怎么设计？"用户授权后又能改吗"？

- 粒度：资源 + 动作（`orders.read`/`orders.write`），读写字分离，避免 `all`/`admin` 这种一授全授。
- 最小化：Client 只申必需 scope，AS 回跳时告知**实际授予**（可少于请求），RS 按 scope 做细粒度准入。
- 可增量：危险 scope（如 `offline_access`、支付）单独同意，用户可在账号设置里撤销某 scope 或整个授权。
- 加分：撤销要能落到吊销——refresh 删除 + access 靠短 TTL 或黑名单收敛，与 [无状态登出、吊销与与 OAuth2 协同（关联）](../../jwt/s1/S1-3-Lesson.md) 衔接。
