# OIDC、SSO 与令牌关系（关联 JWT）

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：分清 Access Token 与 id_token 的职责边界，讲明 OIDC 如何在 OAuth2 之上补齐"认证"；能描述 SSO 单点登录/单点登出的会话机制，并解释为什么"用 Access Token 做登录"是危险反模式。

## 一、OAuth2 只授权，不认证——OIDC 补哪一块

OAuth2 发的是 Access Token，它回答"持牌者能做哪些操作"，但**不保证**"这张牌是给哪个用户、由谁签发、什么时候签的"。很多团队拿 `access_token` 里的 `sub` 直接当登录依据，是范畴错误。OIDC（OpenID Connect）在 OAuth2 授权流上叠了一层身份：

```text
图目的：三种令牌各自回答什么问题
Access Token   能做什么     → 给 RS，携带 scope，不透明或 JWT 均可
id_token       你是谁       → 给 Client，必须是 JWT，含 sub/iss/aud/auth_time/nonce
Refresh Token  续命用       → 只在 AS token 端点用，不发 RS 不上资源请求
登录判定只能靠 id_token（含 nonce 防重放），资源访问才靠 access_token。
```

触发方式是 `scope=openid`，AS 额外返回 id_token，Client 校验其签名 + `aud=自己的 client_id` + `iss` + `exp` + `nonce` 后才认这次登录。

## 二、为什么不能拿 Access Token 当登录凭证

```java
// 目的：识破"用 access_token 解析 sub 当登录"的高频反模式
// 反例：把 Access Token 当身份来源 ❌
String userId = Jwts.parse(accessToken).getBody().get("sub");   // 危险
// 结果一：Access Token 格式不保证是 JWT（可能不透明串），aud 面向 RS 而非本 Client，
//        本 Client 无权也无需解析 —— 语义上它压根不是身份断言
// 反例：接受任意来源的 id_token，只验签名不验 aud/iss/nonce ❌
//        结果：别的 client 的 id_token 被拿来冒充登录（audience 混淆攻击）
```

正确：只验 id_token，且 `aud` 必须含本 client_id、`iss` 必须是可信 AS、`nonce` 必须等于发起授权时下发的那个值。

## 三、SSO：一套会话，多处免登录

单点登录的价值在**一次认证、跨应用免登**。机制是 IdP 侧维护一个全局会话 cookie，各业务应用把登录判断委托给 IdP：

- **同域 SSO**：所有子系统共享顶级域下的 session cookie，最简单。
- **跨域 OIDC SSO**：应用跳 IdP，IdP 已有全局会话则静默签发 code/id_token，用户无感——这是标准做法。
- **CAS / SAML**：企业老系统常见，思想一致（中心会话 + 断言），协议不同。

## 四、单点登出（SLO）：真正的难点

登录容易，"一处登出、处处失效"才是难点，因为无状态 JWT 天然不可撤销：

```text
图目的：两种登出模型与各自的破口
前端通道登出：应用各自跳 IdP 再清本地会话 —— 依赖浏览器，用户关页面则失效不彻底
Back-Channel Logout：IdP 服务端直接回调每个应用的 /logout 端点带 logout_token —— 不依赖浏览器 ✓
破口：应用持有长命 access_token 时，即使会话登出，令牌到期前仍可访问 RS
兜底：登出必须触发 refresh 吊销 + access 进黑名单（或短 TTL 让其自然过期）
```

## 五、令牌关系全景与最佳实践

- 一个用户一次登录，Client 侧最终持有 **id_token（一次性用于建立本地会话，用完即弃）+ access_token（访问资源）+ refresh_token（续期）**。
- id_token 不应长期存储或反复携带——它只在"建立应用本地会话"那一刻有意义，之后应用用自己的会话 cookie。
- access_token 生命周期尽量短，RS 校验 audience（`aud`）确保这张牌是发给自己的，防止令牌在多个 RS 间被误用。

## 六、关联课程

授权码 + PKCE 细节在 [授权码 + PKCE、scope 与令牌存储](S1-2-Lesson.md)；四 grant 与角色在 [核心角色与四种授权模式](S1-1-Lesson.md)；id_token 的 JWT 结构与验签在 [JWT 结构与签名验证](../../jwt/s1/S1-1-Lesson.md)；claims 与算法攻击在 [Claims、刷新与算法攻击防护](../../jwt/s1/S1-2-Lesson.md)；登出吊销在 [无状态登出、吊销与与 OAuth2 协同（关联）](../../jwt/s1/S1-3-Lesson.md)。
