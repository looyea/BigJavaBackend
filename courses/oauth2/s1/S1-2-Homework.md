# 授权码 + PKCE、scope 与令牌存储 · 作业

## 作业 1：手写一遍 PKCE 交换

- **目标**：把 verifier→challenge→校验 的时序落到能跑的代码。
- **任务**：用任意语言生成 `code_verifier`（43~128 字符高熵），计算 `code_challenge = BASE64URL(SHA256(verifier))`，发起 authorize 带 `method=S256`；拿到 code 后在 token 请求里带回原始 verifier，并模拟 AS 端重算比对逻辑（相等发 token，不等抛 `InvalidGrantException`）。
- **验收标准**：正常路径换到 token；故意篡改 verifier 后被拒；两次授权使用不同 verifier（断言无复用）。
- **参考解法要点**：BASE64URL 去 padding、`+→-`、`/→_`；challenge 与本次 code 绑定存储，用过即弃（见 [课文](S1-2-Lesson.md) 第一节）。

## 作业 2：redirect_uri 与 state 加固

- **目标**：堵死回调前缀绕过与会话固定。
- **任务**：写一个 `validateRedirectUri(registered, requested)` 做**全等**校验（协议+host+port+path 逐段比），单测覆盖 `https://a.com` vs `https://a.com.evil.com`、`https://a.com/../evil`、大小写与尾部斜杠；给客户端加 state 生成+回跳比对，构造"攻击者预取 code 诱导受害者"的用例断言被拒。
- **验收标准**：上述三组绕过样本全部返回 false；state 不一致时拒绝并记录告警。
- **参考解法要点**：精确匹配而非 `startsWith`/正则宽松匹配；state 一次性、绑定 session，验证后立即失效。

## 作业 3：令牌存储方案评审（书面）

- **目标**：为 Web/SPA/移动端各选一存储并说明拒绝理由。
- **任务**：评审同事把 access+refresh 全存 localStorage 的做法，指出 XSS 窃取路径；给出 Web（服务端 session + HttpOnly cookie）、SPA（BFF 或内存 + 静默刷新）、移动端（Keychain/Keystore）三套替代，并说明各自需要配套的 CSRF / 刷新机制。
- **验收标准**：能讲清"令牌尽量不下发浏览器"的首选原则，以及非下发不可时 HttpOnly 优于 localStorage 的取舍与代价（CSRF 防护）。
- **参考解法要点**：HttpOnly 挡 XSS 但挡不住 CSRF，需 SameSite + CSRF token；对照 [XSS / CSRF 与 CSP](../../web-defense/s1/S1-2-Lesson.md)。
