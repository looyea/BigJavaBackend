# XSS / CSRF 与 CSP · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. 存储型 XSS 相比反射型的最大危害在于？（6分）

- A. 只影响自己
- B. 恶意脚本入库，所有浏览该数据的用户都被注入
- C. 不需要浏览器
- D. 只能 GET 触发

> 答案：B
> 解析：脚本持久化到 DB（评论/昵称），扩散到每个查看者，影响面远大于一次性反射型。

### 2. XSS 根治的核心原则是？（6分）

- A. 统一 escapeHtml 到处用
- B. 按数据被插入的输出上下文选择正确的转义/编码
- C. 关掉 JS
- D. 只用 POST

> 答案：B
> 解析：HTML 正文、属性、JS 字符串、URL 各有不同编码，用错上下文（如对 script 变量只 HTML 实体化）仍有洞。

### 3. 富文本（允许加粗、链接）场景防 XSS 的正确做法是？（6分）

- A. 全部转义成实体
- B. 白名单标签清洗（sanitize），只放行安全标签与属性
- C. 不处理直接存
- D. 禁止富文本

> 答案：B
> 解析：全转义功能尽失、不转义则中招；用 jsoup Safelist 之类清洗保留白名单标签、剥离 script/onerror。

### 4. CSP 的主要价值是？（6分）

- A. 加密传输
- B. 限制脚本/资源来源，作为漏转义时的纵深兜底
- C. 防 SQL 注入
- D. 加速渲染

> 答案：B
> 解析：CSP 声明可信来源，即使注入成功也难执行内联/外域脚本，是第二道防线非替代转义。

### 5. 下面哪条 CSP 会让防护形同虚设？（6分）

- A. script-src 'self'
- B. script-src 'self' 'unsafe-inline'
- C. object-src 'none'
- D. default-src 'self'

> 答案：B
> 解析：unsafe-inline 放开内联脚本，注入的内联 JS 照跑，等于没防；其余是收紧策略。

### 6. CSRF 能得手的根本机制是？（6分）

- A. 攻击者偷到了密码
- B. 浏览器对目标站请求自动携带会话 Cookie，服务端只认 Cookie 不认来源
- C. Cookie 没加密
- D. HTTPS 被破解

> 答案：B
> 解析：CSRF 是"借登录态发非本人意愿请求"，攻击者看不到响应也能得手。

### 7. 把转账接口从 GET 改成 POST 能防 CSRF 吗？（6分）

- A. 完全能
- B. 不能，自动提交表单一样能发跨站 POST
- C. POST 不会被浏览器携带 Cookie
- D. 能，但要加 HTTPS

> 答案：B
> 解析：改方法是常见错觉；真防线是 SameSite + CSRF Token + 校验 Origin/敏感操作确认。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. 关于 SameSite Cookie，正确的有？（多选）（9分）

- A. Lax 会阻止跨站 POST 携带该 Cookie
- B. Strict 最严，连顶级导航跳转也不带
- C. 设了 SameSite 就完全不必再用 CSRF Token
- D. 它是从"请求是否跨站"层面限制凭证自动携带

> 答案：A、B、D
> 解析：C 错——SameSite 有子域/Lax 放行 GET 等边界，纵深防御仍应叠加 CSRF Token 兜底。

### 9. 下列对 XSS 的缓解手段有效的有？（多选）（9分）

- A. 会话 Cookie 加 HttpOnly，使 XSS 读不走 Cookie
- B. 输出前按上下文转义
- C. 配置 CSP 禁止内联脚本
- D. 只在前端做输入长度校验

> 答案：A、B、C
> 解析：D 无效——前端校验可绕过，且长度限制挡不住精心构造的短 payload，安全须服务端兜底。

## 三、简答题（40 分）

### 10. 一个 UGC 社区（昵称/简介/评论/富文本帖子）要系统性防 XSS，给出分层方案。（40分）

> 参考答案：
- 输入：长度/类型基础校验（不作主防），拒绝明显异常字符可选。
- 存储：富文本入库前用白名单 sanitizer 清洗（放行 b/p/a 等，剥离 script/事件属性/onerror）。
- 输出：按上下文转义——正文 HTML 实体、属性编码、JS 变量 JS 编码、URL 参数 encodeURIComponent。
- CSP：default-src 'self'、script-src 去 unsafe-inline、object-src 'none'、frame-ancestors 'none'。
- Cookie：会话 Cookie HttpOnly + Secure + SameSite，抬高 XSS 后窃凭证成本。
- 兜底：安全响应头、CSP 上报（report-uri）监控违规、定期扫描回归。

> 解析：能体现"输入-存储-输出-策略-Cookie"多层且强调输出上下文转义即达生产水准。
