# 授权码 + PKCE、scope 与令牌存储

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：能完整推导 PKCE 防授权码拦截的原理（code_verifier / code_challenge / S256），写对 redirect_uri 精确校验与 state 防 CSRF；会用 scope 做最小授权，并给出 access/refresh 令牌在 Web、移动端各自的安全存储方案。

## 一、PKCE：给授权码加一道"只有原始发起者能解的锁"

公共客户端（SPA、移动端）藏不住 client_secret，授权码在回跳时被恶意 App / 抓包截获就可能被换走 token。**PKCE（Proof Key for Code Exchange，RFC 7636）**用一次性的动态密钥堵住这个洞：

```text
图目的：看清 PKCE 两个参数在流程里的时序与校验点
1 客户端随机生成 code_verifier（高熵字符串，本地留存，不出前端）
2 计算 code_challenge = BASE64URL(SHA256(code_verifier))   [方法 S256]
3 authorize 请求带 code_challenge + code_challenge_method=S256  → AS 存下 challenge 绑定这次 code
4 AS 回跳带 code
5 客户端到 token 端点：code + code_verifier（原文）
6 AS 重算 SHA256(code_verifier) == 已存 challenge ?  相等才发 token
攻击者即使截到 code，没有内存里的 verifier 也算不出 challenge → 换不出 token。
```

铁律：**每次授权用全新的 verifier，绝不复用**；`code_challenge_method` 必须是 `S256`，`plain` 仅在极端受限环境才降级（等于没哈希）。

```java
// 目的：验证侧（AS）的 PKCE 校验——忘了比 challenge 就是形同虚设
String recomputed = base64Url(sha256(codeVerifier));        // 用收到的原文 verifier 重算
if (!recomputed.equals(storedChallenge)) throw new InvalidGrantException(); // 不等则拒绝发 token
// 反例：token 端点只看 code 对不对，压根不校验 code_verifier ❌
//        结果：PKCE 白做，截获的 code 仍能换 token——"接了 PKCE 参数但没验证"是高频实现缺陷
// 反例：code_challenge_method 收 plain 也接受 ❌ 攻击者截到 challenge 即等于拿到 verifier
```

## 二、redirect_uri 与 state：两个必守的端点纪律

- **redirect_uri 精确匹配**：AS 必须对预注册 URI 做**全等**比较，不能前缀/子域匹配——`https://app.example.com` 放行 `https://app.example.com.evil.com` 或 `/../` 是经典账户接管漏洞。
- **state 防 CSRF**：客户端生成随机 state 存 session，回跳时比对不一致即拒——否则攻击者用自己拿到的 code 覆盖受害者会话，把受害者"登录成攻击者"。

```text
图目的：state 校验缺失导致的会话固定攻击链
攻击者自走 OAuth 拿到 codeA → 构造带 codeA 的回调 URL 发给受害者
→ 受害者点击，浏览器用 codeA 换 token → 受害者登录成了攻击者账号
防御：客户端侧随机 state + 回跳比对，AS 侧 redirect_uri 全等校验，两道缺一不可。
```

## 三、scope：授权的最小切片

scope 是"用户到底同意授予哪些能力"的声明。设计要点：读写字分离（`orders.read` / `orders.write`）、按资源域切分而非按页面、能增量（`offline_access` 单独申 refresh）。AS 应在 token 里回落**实际授予**的 scope（可能少于请求），RS 据此做细粒度判定。

```text
图目的：scope 粒度的正反设计
正例：orders.read  payments.write  profile            [按资源+动作，可组合可审计]
反例：all  admin  basic                                [大而全，一授全授，最小权限形同虚设]
```

## 四、令牌存储：按端选择，没有银弹

- **Web 后端机密客户端**：token 存服务端 session（内存/Redis），前端只拿 HttpOnly+Secure+SameSite 的会话 cookie——**不要把 access token 塞 localStorage**。
- **SPA 纯前端**：无处藏 secret，最优是把 token 留在 BFF（后端代理），前端只持有短期会话；退而求其次内存持有 + 静默刷新，避开 localStorage（XSS 可直接读）。
- **移动端**：iOS Keychain / Android Keystore 或 EncryptedSharedPreferences，绝不裸存 SharedPreferences/文件。

```text
图目的：三种存储位置的风险对比
localStorage   读取方便 ❌ XSS 一行 JS 全偷走，无 HttpOnly 保护
内存 + 刷新     XSS 难持久化窃取 ✓ 但刷新需 BFF/silent 支撑，页面重载需重取
HttpOnly Cookie  JS 读不到 ✓ 浏览器自动带 ❌ 需配 CSRF 防护（SameSite + token）
结论：优先让令牌不下发到浏览器；确实要下发时，用 HttpOnly Cookie 而非 localStorage。
```

## 五、关联课程

授权码模式全景与四 grant 取舍在 [核心角色与四种授权模式](S1-1-Lesson.md)；id_token 与 SSO 在 [OIDC、SSO 与令牌关系（关联 JWT）](S1-3-Lesson.md)；令牌本身的 JWT 结构在 [JWT 结构与签名验证](../../jwt/s1/S1-1-Lesson.md)；refresh 轮换与吊销在 [无状态登出、吊销与与 OAuth2 协同（关联）](../../jwt/s1/S1-3-Lesson.md)。
