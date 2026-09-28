# 核心角色与四种授权模式

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：能画出 Resource Owner / Client / Authorization Server / Resource Server 四角色协作图，讲清授权码、隐式、密码、客户端凭证四种 grant 的适用边界与 OAuth 2.1 的废弃理由；判断一个接入需求该用哪种模式，并识破"第三方要我方账号密码"的安全红线。

## 一、四个角色，两本账

OAuth2 的本质是**委托授权**：用户（Resource Owner）把自己的部分资源访问权委托给第三方应用（Client），而不交出账号密码。发牌的是 Authorization Server（AS，如企业 IdP、微信开放平台），凭牌取货的是 Resource Server（RS，存用户数据的 API）。

```text
图目的：看清令牌在四个角色间的流转与信任边界
Resource Owner(用户) --授权--> Authorization Server --发code/token--> Client(第三方)
                                                                       |
                                          持 Access Token 访问 -------> v
                                              Resource Server(校验token后放行数据)
信任边界：AS 信任用户登录 + Client 注册信息；RS 信任 AS 签发的令牌；Client 永远拿不到用户密码。
```

面试第一刀常问"Client 和 Resource Server 是不是同一个"——可以同进程也可以分离，关键是**职责**：谁发牌、谁验牌，验牌方不关心用户是谁，只关心令牌有效 + scope 够。

## 二、四种 grant：一张对照表看懂取舍

```text
图目的：四种授权模式的流程差异与 OAuth 2.1 态度
授权码 Authorization Code  用户→AS登录同意→回code→Client用code+secret换token   [推荐，2.1保留]
隐式 Implicit            AS 直接把 token 放 URL fragment 返回前端            [2.1 已废弃]
密码 Resource Owner Pwd  Client 拿到用户账号密码自己去换 token               [2.1 已废弃]
客户端凭证 Client Credentials  无用户参与，Machine-to-Machine 用自身身份取token [保留，服务端专用]
```

- **授权码**：唯一兼顾"用户在场 + 密钥不过前端"的模式，Web 应用标准答案；
- **隐式**：token 暴露在浏览器历史/Referer、无法带 refresh、易被片段窃取——被 PKCE + 授权码取代；
- **密码模式**：把"避免交出密码"的初衷亲手推翻，只有在遗留系统/第一方高信任场景才见，新设计规范禁止；
- **客户端凭证**：没有"用户"这个主角，服务自己刷令牌拉数据（定时对账、后台任务），签发的是"应用身份"令牌。

```java
// 目的：一眼看懂"密码模式"为何被废弃——它要求的输入本身即违规
// 反例（遗留写法，OAuth 2.1 明令禁止）❌
body.add("grant_type", "password");
body.add("username", 用户在表单里输入的账号);   // 第三方 app 直接收集账号密码 ❌
body.add("password", 明文口令);                             // 委托授权退化成共享凭证，违反最小权限与可撤销性
// 说明：正确路径是授权码跳转——Client 全程接触不到口令，只在回调里拿一次性 code 换 token
```

## 三、令牌两兄弟：Access Token 与 Refresh Token

Access Token 短命（分钟级）、随请求携带、RS 只验签不关心来源；Refresh Token 长命、只在"换新 access"时出现在 AS 的 token 端点、**绝不发给 RS**。二者作用域不同：把 refresh 当 access 用（拿去访问资源）是常见集成错误，RS 应显式拒绝带 `refresh_token` grant 类型的令牌。客户端凭证模式通常不发 refresh——反正机器可自行重取。

## 四、选型决策：接到需求先问三句话

1. **有没有"用户"参与？** 没有（服务对服务）→ 客户端凭证；
2. **用户用的什么端？** 机密客户端（后端能藏 secret）→ 授权码；公共客户端（SPA/移动端藏不住 secret）→ 授权码 + PKCE（下一节）；
3. **是自家 App 还是要接入第三方？** 要账号密码的一律打回——这是安全红线，不是技术选型问题。

## 五、关联课程

授权码 + PKCE 的完整流程与 redirect_uri 校验在 [授权码 + PKCE、scope 与令牌存储](S1-2-Lesson.md)；令牌长什么样、怎么验在 [JWT 结构与签名验证](../../jwt/s1/S1-1-Lesson.md)；OIDC 如何在 OAuth2 之上补"认证"见 [OIDC、SSO 与令牌关系（关联 JWT）](S1-3-Lesson.md)；Spring Security 侧的过滤器链落地在 [安全过滤器链执行顺序](../../spring-security/s1/S1-1-Lesson.md)。
