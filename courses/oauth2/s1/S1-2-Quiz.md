# 授权码 + PKCE、scope 与令牌存储 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. PKCE 主要防护的攻击是？（6分）

- A. 授权码在回跳通道被截获后被攻击者用来换 token
- B. SQL 注入
- C. 令牌签名算法被降级
- D. CSRF 登录劫持

> 答案：A
> 解析：PKCE 用一次性 code_verifier/challenge 确保"只有发起授权的客户端能用 code 换 token"；CSRF 由 state 防。

### 2. code_challenge 的正确计算方式是？（6分）

- A. BASE64(code_verifier)
- B. BASE64URL(SHA256(code_verifier))，方法标记 S256
- C. MD5(client_secret)
- D. 直接等于 state

> 答案：B
> 解析：S256 才对 verifier 取 SHA256 再 BASE64URL；plain 是退路（等于不哈希），应尽量禁用。

### 3. 关于 code_verifier，正确的纪律是？（6分）

- A. 全 App 生命周期复用一个即可
- B. 每次授权新生成、高熵、存内存不出前端、绝不复用
- C. 放进 redirect_uri 一起回传
- D. 由 AS 生成下发给客户端

> 答案：B
> 解析：verifier 是客户端侧的秘密，复用会削弱前向安全；它只在 token 请求里发一次给 AS。

### 4. redirect_uri 校验的正确做法是？（6分）

- A. 前缀匹配注册域名即可
- B. 允许任意子域方便多环境
- C. 与预注册 URI 全等比较
- D. 只校验协议是 https

> 答案：C
> 解析：前缀/子域匹配会被 `app.example.com.evil.com` 之类绕过，导致授权码外泄与账户接管。

### 5. state 参数的核心作用是？（6分）

- A. 防 CSRF / 登录会话固定劫持
- B. 承载用户权限 scope
- C. 加速令牌刷新
- D. 替代 client_secret

> 答案：A
> 解析：客户端生成随机 state、回跳比对，挡住"攻击者用自己的 code 把受害者登录成攻击者"的会话固定攻击。

### 6. Web 机密客户端的 access token 最该存在哪里？（6分）

- A. 浏览器 localStorage
- B. 服务端 session，前端只拿 HttpOnly 会话 cookie
- C. URL 查询参数
- D. 前端全局 JS 变量并打印到控制台

> 答案：B
> 解析：令牌不下发浏览器最安全；localStorage 可被 XSS 一行读取，是高频错误做法。

### 7. scope 设计的合理原则是？（6分）

- A. 一个 all scope 通吃最省事
- B. 按页面划分（首页、详情页各一个）
- C. 按资源 + 动作细粒度划分，读写字分离，可增量
- D. scope 越多用户体验越好

> 答案：C
> 解析：细粒度可组合可审计，最小授权；AS 还应回落实际授予（可少于请求）的 scope。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. 关于令牌存储，正确的有？（多选）（9分）

- A. 移动端应放 Keychain / Keystore 等安全区
- B. SPA 首选把 token 留在 BFF，前端只持短期会话
- C. localStorage 存 refresh token 是安全最佳实践
- D. HttpOnly Cookie 能防 XSS 窃取，但需另配 CSRF 防护

> 答案：A、B、D
> 解析：C 反例——localStorage 无任何脚本隔离，XSS 可直接读走，长命 refresh 存这里等于长期后门。

### 9. 下列属于实现缺陷 / 攻击面的有？（多选）（9分）

- A. 接了 PKCE 参数但 token 端点不校验 verifier
- B. code_challenge_method 同时接受 plain 和 S256
- C. redirect_uri 用 startsWith 匹配
- D. token 端点对机密客户端做 client_secret 认证

> 答案：A、B、C
> 解析：D 是正确做法；A/B/C 分别让 PKCE 形同虚设、challenge 可被当 verifier、回调可被前缀绕过。

## 三、简答题（40 分）

### 10. 一个纯 SPA（无后端）要接入 OAuth2，请给出安全方案要点。（40分）

> 参考答案：
- 模式：授权码 + PKCE，绝不用隐式；公共客户端不配 client_secret。
- verifier：随机生成存内存，一次性、不复用，S256。
- 端点：state 随机 + 回跳比对；redirect_uri 全等、精确到 path。
- 存储：优先加一层 BFF 让 token 不下发浏览器；无 BFF 则内存持有 + 静默刷新，禁用 localStorage。
- scope：只申必需的最小集，读写字分离。
- 刷新：refresh 轮换 + 复用检测，页面重载能安全重取。

> 解析：能说清"PKCE 补公共客户端短板 + token 尽量不落浏览器 + 端点双校验"三条主线即达生产水准。
