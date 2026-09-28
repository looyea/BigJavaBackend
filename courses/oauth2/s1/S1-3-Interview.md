# OIDC、SSO 与令牌关系（关联 JWT） · 面试题

## 题 1：OIDC 和 OAuth2 什么关系？为什么说 OAuth2 不能单独做登录？

- OAuth2 是授权框架，产出 Access Token，回答"持牌者能访问哪些资源"。
- 它没有规定"这张令牌代表哪个用户、由谁在何时认证"——把这些当身份断言用是范畴错误。
- OIDC 在其上叠一层认证：`scope=openid` 触发 AS 额外签发 id_token（JWT），明确 `sub/iss/aud/auth_time/nonce`。
- 加分：很多"第三方登录"事故源于拿 access_token 的 sub 当登录依据，正确姿势只验 id_token。

## 题 2：Access Token、id_token、Refresh Token 三者职责怎么分？

- Access Token：给 RS 做资源准入，携带 scope，格式可不透明；受众是 RS。
- id_token：给 Client 做身份认证，必须 JWT；受众是本 Client，建立本地会话后即弃。
- Refresh Token：只在 AS token 端点续期用，绝不发给 RS、不上资源请求。
- 加分：三者 `aud` 各不相同，RS/Client 各自校验"这张牌是不是发给我的"，混用即 audience 混淆攻击。

## 题 3：验证 id_token 要验哪些字段？漏一个会怎样？

- 签名：用 IdP 的 JWKS 公钥验签，否则伪造令牌直通。
- iss：签发者必须是可信 IdP，挡"任意方签发冒充"。
- aud：必须含本 client_id，否则别的 client 的 id_token 被拿来登录（audience 混淆）。
- exp/auth_time + nonce：过期与重放防护，nonce 绑本次授权。
- 加分：`at_hash` 校验可把 id_token 与 access_token 绑定，防令牌替换。

## 题 4：SSO 单点登录是怎么做到"跨系统免登"的？

- 核心是 IdP 侧维护的全局会话 cookie：首个系统登录后 IdP 记住这次认证。
- 第二个系统跳 IdP，命中全局会话则静默签发 code/id_token，用户不再输口令。
- 各业务系统持独立本地会话，仅"认证"这一环委托 IdP。
- 加分：区分同域 SSO（共享顶级域 cookie）与跨域 OIDC SSO；CAS/SAML 是中心会话 + 断言的同思想变体。

## 题 5：无状态 JWT 让单点登出很难，怎么破？

- 难点：JWT 自证有效，中心清会话也不影响已发出的 access_token 到期前继续可用。
- 登出通道：Back-Channel Logout（IdP 服务端回调各应用带 logout_token）比前端通道彻底。
- 令牌收敛：短 TTL 让 access 自然过期；要即时则 refresh 吊销 + access 进黑名单或 introspection。
- 加分：讲清"无状态便利 vs 可撤销性"的取舍——金融等高敏场景宁可牺牲无状态换即时下线。

## 题 6：什么场景你会选 OIDC 而非自建登录？反过来呢？

- 选 OIDC：多应用/多端 SSO、要接第三方身份源（企业 IdP、社交登录）、需集中审计与合规、想复用成熟 PKCE/轮换机制。
- 自建/简单方案：单体小系统、就一个第一方 App、不需要跨域联邦，硬上 OIDC 是过度设计。
- 折中：第一方移动端常用"自有账号 + 短 JWT + refresh"，但不必完整 OIDC 联邦那套。
- 加分：指出选型的不是"先新技术"，而是"是否需要把认证从每个应用里解耦出去"。
