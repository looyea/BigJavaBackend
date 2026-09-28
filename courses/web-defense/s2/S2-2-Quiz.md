# 认证会话安全与 JWT/CSRF 协同 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. 防"会话固定攻击"的关键动作是（6分）

- A. 让用户改密码
- B. 登录成功后 invalidate 旧会话、重建新会话 ID
- C. 加长 Cookie 有效期
- D. 关掉 HTTPS

> 答案：B
> 解析：攻击者会预置一个已知会话 ID 等受害者登录继承；登录后重建会话、作废旧 ID 使其预埋失效。

### 2. Cookie 的 HttpOnly 属性作用是（6分）

- A. 强制 HTTPS
- B. 禁止 JavaScript 读取该 Cookie，抗 XSS 窃取会话凭证
- C. 限制跨站携带
- D. 设置过期时间

> 答案：B
> 解析：HttpOnly 让脚本读不到 Cookie，即使页面有 XSS 也难直接偷走会话凭证。

### 3. SameSite=Lax/Strict 直接带来的安全收益是（6分）

- A. 加密 Cookie
- B. 跨站发起的请求不自动携带该 Cookie，天然抗 CSRF
- C. 延长会话
- D. 防止点击劫持

> 答案：B
> 解析：SameSite 控制第三方站点请求是否带上 Cookie，是抵御 CSRF 的浏览器层机制。

### 4. 把 JWT 放在 Authorization 请求头（前端手动加）时，CSRF 风险如何？（6分）

- A. 和 Cookie 会话一样高
- B. 基本免疫传统 CSRF——跨站表单带不上自定义头、凭证不自动携带
- C. 完全不存在任何问题
- D. 会自动携带导致劫持

> 答案：B
> 解析：CSRF 依赖"浏览器自动带凭证"，头里的 JWT 不会被自动携带，故传统 CSRF 面大幅降低。

### 5. 若把 JWT 存进 HttpOnly Cookie，则（6分）

- A. 既抗 XSS 又自动免疫 CSRF
- B. 抗住了 XSS 窃取，但凭证被自动携带，CSRF 风险回来，仍需 SameSite/Token
- C. 更容易被 XSS 偷
- D. 无法刷新

> 答案：B
> 解析：HttpOnly Cookie 防 XSS 读，但"自动携带"正是 CSRF 的触发条件，二者需分别防御。

### 6. 无状态 JWT 的"吊销难题"通常靠什么缓解？（6分）

- A. 永不过期
- B. access 短 TTL 自然过期 + 关键场景维护 JTI/黑名单 + refresh 旋转
- C. 存 localStorage
- D. 关掉签名验证

> 答案：B
> 解析：无状态无法即时失效，用短生命周期限制暴露窗口，敏感场景加黑名单/JTI，refresh 旋转检测复用。

### 7. 针对 `alg=none` 与 HS/RS 混淆这类 JWT 攻击应（6分）

- A. 信任令牌自带算法头
- B. 服务端强制期望算法、拒 alg=none，区分对称/非对称防算法混淆，校验 kid 防注入
- C. 不验签
- D. 只看过期

> 答案：B
> 解析：绝不能按令牌 header 声明的算法去验；服务端钉死期望算法并严格验签是关键。

### 8.（多选）会话 Cookie 应有的安全属性包含（9分）

- A. HttpOnly
- B. Secure
- C. SameSite
- D. 明文长期不过期

> 答案：A、B、C
> 解析：D 是反面；合理过期 + 空闲超时 + 全站 HTTPS 也是必备。

### 9.（多选）关于 JWT 存放位置，正确的判断有（9分）

- A. localStorage 易被 XSS 一次性全量窃取
- B. HttpOnly Cookie 抗 XSS 但需另防 CSRF
- C. 放 Authorization 头不易受传统 CSRF
- D. 放哪都一样、没有取舍

> 答案：A、B、C
> 解析：D 错；不同存放位置的 XSS/CSRF 暴露面不同，需按威胁模型选。

### 10. 为一个既要 Web 表单登录、又要开放 API 令牌访问的系统设计认证与会话安全。请给出方案。（40分）

> 参考答案：
- 要点1：会话侧防固定/劫持——登录后重建会话 ID、Cookie 设 HttpOnly+Secure+SameSite、全站 HTTPS、合理与空闲过期（10分）
- 要点2：CSRF 与凭证携带联动——Cookie 会话自动携带必上 CSRF Token+SameSite；JWT 放头基本免 CSRF，若放 Cookie 则 SameSite/Token 不能省（10分）
- 要点3：JWT 生命周期与吊销——短 access + refresh 旋转（复用即撤链），敏感场景 JTI/黑名单，存放按 XSS/CSRF 威胁取舍（10分）
- 要点4：算法与校验——服务端强制期望算法、拒 alg=none、防 HS/RS 混淆与 kid 注入，敏感操作二次校验兜底（10分）
