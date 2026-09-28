# XSS / CSRF 与 CSP · 作业

## 作业 1：三类 XSS 复现与按上下文修复

- **目标**：亲手在反射型、存储型、DOM 型各注入一次，再用对应编码修掉。
- **任务**：造一个回显昵称的页面（反射）、一个评论列表（存储）、一个读 `location.hash` 写 `innerHTML` 的组件（DOM），用 `<img src=x onerror=alert(1)>` 类 payload 触发；再分别用 HTML 实体编码、入库前 sanitize、前端改用 `textContent` 而非 `innerHTML` 修复，重跑证明失效。
- **验收标准**：三处修复后 payload 以纯文本显示、不执行脚本；给出每处"输出上下文 → 所用编码"的对应说明。
- **参考解法要点**：DOM 型最易被漏——服务端转义管不到纯前端写入，须前端改安全 API（见 [课文](S1-2-Lesson.md) 第一节分型）。

## 作业 2：给应用加上 CSP 并验证

- **目标**：用响应头 CSP 兜底内联脚本注入。
- **任务**：配置 `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'`，在页面里同时放一段合法外链脚本和一段内联 `<script>alert(1)</script>`，观察浏览器拦截行为；再加 `report-uri` 收集违规上报。
- **验收标准**：内联脚本被 CSP 拦（控制台报 Refused to execute）、外链同源脚本正常；违规事件上报到指定端点；说明为何上线初期用 `Content-Security-Policy-Report-Only` 灰度。
- **参考解法要点**：CSP 是纵深防御不是替代转义；`unsafe-inline` 一加即破功，用 nonce/hash 替代。

## 作业 3：CSRF 防护组合拳落地（书面 + 配置）

- **目标**：为一个基于会话 Cookie 的转账接口设计 CSRF 防线。
- **任务**：给出 SameSite=Lax/Strict + 一次性 CSRF Token（表单/头回带、服务端校验）+ Origin 校验 + 敏感操作二次确认的组合，明确每道防线挡什么、单独依赖谁会有何边界；说明为什么"改 POST"不算防。
- **验收标准**：能画 CSRF 攻击链并逐点标注防线拦截位置；指出无状态 Bearer API 为何天然免疫 CSRF。
- **参考解法要点**：与 [授权码 + PKCE、scope 与令牌存储](../../oauth2/s1/S1-2-Lesson.md) 里 state 防 CSRF 同源；Spring Security 默认开启 CSRF 保护见 [安全过滤器链执行顺序](../../spring-security/s1/S1-1-Lesson.md)。
