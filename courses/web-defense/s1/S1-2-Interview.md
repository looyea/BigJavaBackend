# XSS / CSRF 与 CSP · 面试题

## 题 1：XSS 有几种类型，各自触发路径？

- 反射型：恶意脚本在 URL 参数，服务端原样回显到页面，诱导点击触发，一次性。
- 存储型：脚本写进 DB（评论/昵称/富文本），所有浏览者被永久注入，危害最大。
- DOM 型：不进服务端，前端 JS 把 `location.hash` 等写入 `innerHTML` 触发。
- 加分：点出三者本质相同——浏览器把数据当 HTML/代码执行；DOM 型最易漏，服务端转义管不到。

## 题 2：怎么根治 XSS？为什么"一套 escapeHtml"不够？

- 按输出上下文编码：HTML 正文实体化、属性用属性编码、`<script>` 内 JS 变量用 JS 编码、URL 参数用 URL 编码。
- 用错上下文仍有洞：把用户数据放进 JS 字符串却只做 HTML 实体化，闭合引号照样注入。
- 兜底 CSP + HttpOnly Cookie 抬高利用成本。
- 加分：富文本用白名单 sanitize 而非转义（否则功能尽失），体现"上下文决定手段"。

## 题 3：CSP 是什么，能替代转义吗？

- CSP 是响应头声明资源可信来源（脚本/样式/框架），浏览器拒绝加载白名单外资源、默认禁内联。
- 不能替代转义——它是纵深防御第二道，漏转义时让注入的脚本难执行。
- 上 `unsafe-inline` 等于自废；正规用 nonce/hash 放行必要内联。
- 加分：上线初期用 `Report-Only` + `report-uri` 灰度观察，避免一刀切打断业务。

## 题 4：讲清 CSRF 的原理和防线。

- 原理：诱导已登录用户浏览器，借其自动携带的会话 Cookie 执行非本人意愿操作；服务端只认 Cookie 不认来源。
- 防线1 SameSite=Lax/Strict 限制跨站自动携带；防线2 一次性 CSRF Token 要求回带校验；防线3 校验 Origin/Referer + 敏感操作二次确认。
- 边界：SameSite 有子域/顶级导航 GET 放行等缝隙，不能单独依赖。
- 加分：无状态 Bearer Token API 天然免疫 CSRF——浏览器不会自动加 `Authorization` 头，这点最能区分理解深度。

## 题 5：HttpOnly 和 SameSite 各解决什么？能互相替代吗？

- HttpOnly：JS 读不到 Cookie，挡的是 XSS 后窃取会话凭证（机密性）。
- SameSite：限制跨站请求是否自动携带 Cookie，挡的是 CSRF（借凭证发请求）。
- 不能互替：HttpOnly 挡不住 CSRF（请求仍自动带 Cookie），SameSite 挡不住 XSS 读页面 DOM 数据。
- 加分：两者 + Secure 是会话 Cookie 的标配三件套，分别对应不同攻击面。

## 题 6：CSRF 和 XSS 有什么关系？谁更"根本"？

- 都能导致"以受害者身份行事"，但机制不同：CSRF 借合法凭证发合法请求（利用信任），XSS 注入代码破坏页面可信域。
- 有 XSS 往往可衍生 CSRF：用脚本读取页面 CSRF Token 再发请求，绕过 Token 防线——所以 XSS 更"根本"、破坏性更大。
- 防御互相关联：HttpOnly 让 XSS 难拿 Cookie，但仍难挡已登录状态下的 DOM 操作，需 CSP 兜底。
- 加分：能讲"CSRF 防线在 XSS 面前会降级"，说明二者必须同时到位，任一失守另一也受牵连。
