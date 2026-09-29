# 认证会话安全与 JWT/CSRF 协同

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：能把"会话"和"令牌"两套认证形态的安全要点讲透，并让 CSRF 防御与它们正确配合。**会话（Cookie-Session）**侧三大风险：**会话固定**（攻击者预先塞一个已知 JSESSIONID，等受害者登录后劫持其身份）——防御是**登录后重建会话、作废旧 ID**；**会话劫持**（令牌被窃取即冒充）——靠 **Cookie 属性**兜底：`HttpOnly`（禁 JS 读，抗 XSS 偷 Cookie）、`Secure`（仅 HTTPS 传）、`SameSite=Lax/Strict`（跨站请求不带 Cookie，天然抗 CSRF）、合理 `Path`/过期与**空闲超时**；全站 HTTPS 防中间人嗅探。**JWT（自包含无状态令牌）**侧：把状态从服务端搬到令牌里，于是没有传统会话固定问题，但出现新课题——存放位置（`localStorage` 易被 XSS 窃取 vs `HttpOnly Cookie` 抗 XSS 但需另防 CSRF）、**过期与刷新**（access 短命 + refresh 轮换，refresh 泄露危害大要绑定/旋转检测）、**吊销难题**（无状态天然难即时失效，靠短 TTL + 黑名单/JTI）、算法攻击（`alg=none`、HS/RS 混淆、`kid` 注入）须强校验。**CSRF 本质**是"带凭证的跨站请求被诱导发起"：Cookie 会话会被浏览器自动携带故怕 CSRF（用 **CSRF Token + SameSite** 防），而 **JWT 放 Header（Authorization）时不受传统 CSRF 影响**（跨站表单带不上自定义头 + 无自动凭证），但**若把 JWT 塞进自动携带的 Cookie，CSRF 风险回来、仍需 SameSite/Token**。所以三者的协同关键是"**凭证怎么带、会不会被自动带**"。识破"登录后不重建会话""Cookie 不设 HttpOnly/Secure/SameSite""JWT 长效不吊销又存 localStorage""以为用了 JWT 就自动免疫 CSRF""Stateless 却把令牌放自动携带 Cookie"等坑。

## 一、会话安全：重建 + Cookie 属性

```java
// 目的：登录后防会话固定——作废旧 ID、重建新会话, 再给 Cookie 上安全属性
session.invalidate();                                 // 说明：丢弃登录前(可能被攻击者预置)的会话
HttpSession s = req.getSession(true);                 // 结果：登录后是全新会话 ID, 攻击者预置的旧 ID 失效
Cookie c = new Cookie("SESSION", s.getId());
c.setHttpOnly(true);                                  // 说明：JS 读不到, 抗 XSS 偷 Cookie
c.setSecure(true);                                    // 说明：仅 HTTPS 传输, 防中间人嗅探
c.setAttribute("SameSite", "Lax");                    // 结果：跨站发起的请求不带此 Cookie → 天然抗 CSRF
// 反例：登录成功只 setAttribute 不换会话 ID ❌ 攻击者预埋的 JSESSIONID 随受害者升为已认证 → 会话固定劫持 ❌
```

## 二、JWT 存放与 CSRF 的联动关系

```text
图目的：CSRF 怕不怕, 取决于"凭证会不会被浏览器自动带上"
JWT 放 Authorization 头(前端手动加) → 跨站表单带不上自定义头、无自动凭证 → 基本免疫传统 CSRF
JWT 放 HttpOnly Cookie(自动携带) → 抗 XSS 偷取, 但 CSRF 风险回来 → 仍需 SameSite + CSRF Token
Cookie-Session(自动携带) → 天然怕 CSRF → CSRF Token(同步令牌器/双重提交) + SameSite 双防
存放取舍: localStorage 易被 XSS 全量窃取; HttpOnly Cookie 抗 XSS 但要防 CSRF
```

## 三、令牌生命周期与吊销

```text
图目的：无状态不等于"发完不管"
短 access(分钟级) + refresh 轮换(用一次换一次, 检测到复用即撤销整条链)
吊销难: 无状态无法即时失效 → 靠短 TTL 自然过期 + 关键场景维护 JTI/黑名单
算法校验: 强制期望算法, 拒 alg=none; 区分 HS(对称)/RS(非对称)防混淆; kid 参数防注入
```

## 四、坑与底线

- **别把"用了 JWT"当成"免疫 CSRF"**：只要凭证被浏览器自动携带（放 Cookie），CSRF 面就回来了，SameSite/Token 不能省。
- **无状态也要能"提前作废"**：纯无状态 + 长效令牌 = 令牌泄露即长期冒充；用短 TTL + refresh 旋转 + 敏感操作二次校验兜底吊销。

## 五、关联课程

XSS 与 CSRF、CSP 的基础攻防见 [XSS / CSRF 与 CSP](../s1/S1-2-Lesson.md)；JWT 结构与验签细节见 [JWT 结构与签名验证](../../jwt/s1/S1-1-Lesson.md)；刷新、算法攻击防护承接 [Claims、刷新与算法攻击防护](../../jwt/s1/S1-2-Lesson.md)；SSRF/上传等其他攻击面见 [文件上传、SSRF 与命令注入](./S2-1-Lesson.md)。
