# 无状态登出、吊销与与 OAuth2 协同（关联）

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：直面 JWT"签发即无法收回"的原罪，掌握短令牌、黑名单、Refresh 吊销、Token Binding、introspection 五类撤销手段的取舍；能把 JWT/OIDC 与 OAuth2 授权码流拼成一套完整、可登出、可撤销的登录体系。

## 一、无状态的另一面：撤销是"买回来"的

JWT 的美在于 RS 不用回源即可验签；痛点也在此——令牌一旦发出，到期前天然有效。"登出""改密强制下线""封号"这些**需要即时失效**的动作，都得靠额外机制把无状态"改造"出可撤销性。设计的第一步是**接受取舍**：越即时，越要牺牲一部分无状态的扩展优势（回源或共享黑名单）。

```text
图目的：撤销即时性 vs 无状态扩展性的光谱
纯无状态(只靠 exp) ── 扩展最好，撤销窗口=令牌TTL（最慢）
   ├─ 短 TTL access：把窗口压到分钟级，牺牲"少发令牌"
   ├─ 黑名单 jti：即时撤销，牺牲"零共享状态"（要共享一份会过期的集合）
   ├─ Refresh 吊销：断掉续命，已发 access 仍到期前可用
   ├─ Token Binding / 设备密钥绑定：被窃令牌在他处用不了
   └─ introspection(RFC 7662)：RS 回源 AS 查活，即时但牺牲无状态（金融级选择）
```

## 二、登出到底登出了什么

```text
图目的：一次"退出登录"应当清理的三样东西
1 应用本地会话（cookie/session）—— 必清
2 refresh token —— 应在 AS 侧吊销（否则能被继续换新 access）
3 未过期 access token —— 无状态则清不掉，只能等 TTL 或进黑名单
反例：前端"退出"只删了本地 localStorage 里的 token ❌ AS 侧 refresh 还活着，攻击者持备份 refresh 照样续命
```

真正的登出是**服务端动作**：吊销 refresh（+ 视需要把 access 的 `jti` 塞进黑名单）。前端删 token 只是"看起来登出了"。

## 三、黑名单的工程形态

- 存什么：只存**未过期**令牌的 `jti` + 到期时间，令牌一过期就把条目淘汰——集合大小 ≈ TTL 窗口内的活跃撤销量，可控。
- 存哪里：Redis（带 TTL 自动过期），验签后多一步 `if (blacklist.has(jti)) reject`。
- 成本权衡：黑名单是一次共享存储读，介于"纯无状态"与"introspection 全回源"之间，是多数团队甜点。

```java
// 目的：验签 + 黑名单的标准顺序——先验签再查黑，防用伪造 jti 打爆黑名单存储
Claims c = verify(token);                       // 验签/过期不过直接抛异常，不进下一步
if (blacklist.contains(c.getId())) {            // c.getId() 即 jti
    throw new InvalidTokenException("revoked"); // 结果：已登出/被封的令牌即使没过期也拒
}
// 反例：先查黑名单再验签 ❌ 攻击者用海量随机 jti 请求制造黑名单缓存污染/穿透压力
```

## 四、introspection：把"能不能用"交回 AS

对即时性要求极高（金融、权限敏感），RS 不再自验，而是拿 access token 调 AS 的 `/introspect` 端点问"这牌还有效吗"。AS 返回 `active: true/false` 及原始 claims。

```text
图目的：introspection 把无状态变回"有状态可撤销"
RS 收到 token → 调 AS /introspect(token) → AS 查授权库/黑名单 → {active:false} 即刻拒
代价：每个（或每缓存窗口）请求多一次 AS 调用，AS 成可用性关键——用缓存 + 短 TTL 折中
适用：撤销必须秒级生效的场景；与黑名单相比，逻辑集中在 AS、RS 更省心
```

## 五、与 OAuth2 的合流：一张图收口

```text
图目的：授权码 + PKCE 登录后，令牌生命周期如何闭环
登录：授权码+PKCE 换 access/id/refresh → 验 id_token 建本地会话（见 OIDC 节）
访问：带 access 调 RS（RS 验签 or introspect）
续命：access 过期 → refresh 换新（轮换 + 复用检测，见上节）
登出：清本地会话 + 吊销 refresh +（可选）access 进黑名单 / RP-Initiated Logout 回 AS
被封：introspection 立刻 active=false；纯无状态则靠短 TTL + 黑名单收敛
```

## 六、关联课程

refresh 轮换与复用检测在 [Claims、刷新与算法攻击防护](S1-2-Lesson.md)；结构基础在 [JWT 结构与签名验证](S1-1-Lesson.md)；授权码换令牌在 [授权码 + PKCE、scope 与令牌存储](../../oauth2/s1/S1-2-Lesson.md)；单点登出通道在 [OIDC、SSO 与令牌关系（关联 JWT）](../../oauth2/s1/S1-3-Lesson.md)；幂等与令牌防重放在 [重复请求的四类解法](../../idempotent/s1/S1-1-Lesson.md)。
