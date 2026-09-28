# XSS / CSRF 与 CSP

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：分清零点/反射型/存储型 XSS 的触发路径与"按输出上下文转义"的根治法，会用 CSP 兜底；讲清 CSRF 的"借用浏览器自动携带凭证"本质，掌握 SameSite、CSRF Token、校验 Origin 三道防线，并识破"换个 POST 就防住了"的错觉。

## 一、XSS：脚本在受害者浏览器里以受害者身份执行

三种形态，危害同级：

```text
图目的：按"恶意脚本进入页面的路径"分型
反射型   恶意脚本在 URL 参数里，服务端原样回显到页面 → 诱导点击链接触发
存储型   脚本写进 DB（评论/昵称/富文本），其他用户浏览时被永久注入 → 危害最大
DOM 型   脚本不进服务端，纯前端 JS 把 location.hash 等写入 innerHTML 触发
共性：浏览器无法分辨"你给的 HTML"和"数据里的 HTML"，把数据当代码执行——又是"数据当代码"。
```

## 二、根治：按输出上下文转义，而不是"统一 HTML 实体化"

XSS 防御的关键认知：**转义规则取决于这段数据被插到哪种上下文**，一套 escapeHtml 打天下必留洞。

```java
// 目的：不同输出上下文用不同编码器（OWASP Encoder 思路）
// 1) HTML 元素正文
out.write(HtmlEncoding.escapeHtmlSnippet(userNick));        // < > & " ' → 实体，脚本失效
// 2) HTML 属性内
out.write("<a title=\"" + AttrEncoding.escapeHtmlAttribute(v) + "\">");
// 3) 拼进 <script> 里的 JS 字符串变量 —— 用 JS 编码，不是 HTML 实体！
out.write("<script>var u=" + JavascriptEncoding.escapeJs(varFromReq) + ";</script>");
// 反例：富文本需求下对所有内容 escapeHtml ❌ 要么功能全废，要么干脆不转义（更糟）
//        正解：富文本走白名单标签清洗（sanitize，如 jsoup Safelist），只放行 <b>/<p> 等
```

- **兜底靠 CSP**：`Content-Security-Policy` 限制脚本来源，即使漏转义也难执行内联/外域脚本。
- **HttpOnly Cookie**：给会话 cookie 加 `HttpOnly`，XSS 即便发生也读不走 cookie（挡不住一切，但抬高代价）。

```text
图目的：一条能有效压制内联 XSS 的 CSP 头
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com; object-src 'none'; frame-ancestors 'none'
含义：脚本只允许同源 + 指定 CDN，禁内联脚本（不用 unsafe-inline）；object 全禁；禁止被 iframe 嵌套（兼防点击劫持）
反例：script-src 'unsafe-inline' ❌ 等于没上 CSP，内联注入照样跑
```

## 三、CSRF：借你的登录态，发我没权限发的请求

CSRF 不是"偷令牌"，而是**诱导已登录用户的浏览器，带着自动携带的 Cookie 去执行非本人意愿的操作**。攻击者看不到响应，但"让转账 GET/POST 发出去"就已得手。

```text
图目的：CSRF 攻击链
1 受害者已登录 bank.com（浏览器存有 bank 的会话 Cookie）
2 攻击者页面藏 <img src="https://bank.com/transfer?to=attacker&amt=1000"> 或自动提交表单
3 受害者浏览该页 → 浏览器请求 bank 时自动带上会话 Cookie → bank 认作合法操作执行
根因：浏览器"自动带 Cookie" + 服务端"只认 Cookie 不认请求来源"。
```

## 四、CSRF 三道防线

```java
// 防线1：SameSite Cookie —— 从根上限制跨站请求不带此 Cookie
Set-Cookie: SESSIONID=...; HttpOnly; Secure; SameSite=Lax   // Lax 挡跨站 POST；Strict 更严
// 防线2：CSRF Token —— 服务端发一次性随机值，要求请求（表单隐藏域/Header）回带并校验
// 反例：只用"Referer/Origin 非空"判断 ❌ 可伪造或浏览器隐私设置剥离，不能单独作防
// 防线3：敏感操作二次确认（密码/短信/人脸）—— 即便前两道被绕，仍有业务闸
// 认知纠偏：把接口从 GET 改成 POST ❌ 不等于防住 CSRF，自动提交表单一样 POST 过来
```

- SameSite=Lax/Strict 是现代主力，挡掉大部分跨站携带；但子域、顶级导航（Lax 放行 GET）仍有边界，**不能只靠它**。
- CSRF Token 是通用兜底，配合"校验 Origin 头"更稳；纯 Token/无状态 API（Bearer 头而非 Cookie）天然免疫 CSRF——因为浏览器不会自动加 `Authorization` 头。

## 五、关联课程

注入同源"数据当代码"见 [注入原理与预处理防御](S1-1-Lesson.md)；令牌存储与 HttpOnly 取舍在 [授权码 + PKCE、scope 与令牌存储](../../oauth2/s1/S1-2-Lesson.md)；越权与业务逻辑在 [反序列化、越权与业务逻辑漏洞](S1-3-Lesson.md)；Spring Security 内置 CSRF 防护见 [安全过滤器链执行顺序](../../spring-security/s1/S1-1-Lesson.md)。
