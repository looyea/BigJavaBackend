# 认证会话安全与 JWT/CSRF 协同 · 面试题

## 题 1：什么是会话固定攻击？怎么防？

- 攻击者预先让受害者使用一个已知会话 ID，待其登录后劫持该已认证会话。
- 防御：登录成功后 invalidate 旧会话、重建新 ID；配 Cookie 安全属性。
- 加分：区分它与"会话劫持"（凭证被窃）——后者靠 HttpOnly/Secure/HTTPS 缓解。

## 题 2：会话 Cookie 应该设哪些属性？为什么？

- HttpOnly：JS 读不到，抗 XSS 偷 Cookie。
- Secure：仅 HTTPS 传输，防嗅探。
- SameSite=Lax/Strict：跨站请求不自动携带，抗 CSRF。
- 加分：合理 Path、绝对/空闲过期，全站 HTTPS。

## 题 3：用了 JWT 是不是就不用防 CSRF 了？

- 不一定。取决于凭证是否被浏览器自动携带。
- JWT 放 Authorization 头（前端手动加）→ 传统 CSRF 基本免疫。
- JWT 放 HttpOnly Cookie（自动携带）→ CSRF 面回来，仍需 SameSite/Token。
- 加分：点出"自动携带"才是 CSRF 的触发根因。

## 题 4：JWT 放 localStorage 还是 Cookie？

- localStorage 易被 XSS 一次性全量窃取；HttpOnly Cookie 抗 XSS 读但要另防 CSRF。
- 按威胁模型选：更怕 XSS 偷令牌选 HttpOnly Cookie + CSRF 防护；纯 API/头携带则头里存。
- 加分：能讲 refresh token 单独放更受控、access 尽量短。

## 题 5：无状态 JWT 怎么"提前吊销"？

- 天然难即时失效，靠短 access TTL 自然过期 + refresh 旋转。
- 敏感场景维护 JTI/黑名单、或版本化令牌（用户改密即失效）。
- 加分：refresh 复用检测（用了旧 refresh 即撤整条链）。

## 题 6：JWT 有哪些算法攻击、怎么防？

- `alg=none` 去签名、HS(对称)/RS(非对称)混淆、`kid` 路径/注入。
- 服务端强制期望算法、不按 header 决定、严格验签、校验 kid。
- 加分：密钥管理（轮换、公钥分发 JWKS）与最小信任。
