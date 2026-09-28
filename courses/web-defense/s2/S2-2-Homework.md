# 认证会话安全与 JWT/CSRF 协同 · 作业

### 作业 1：加固 Cookie 会话登录

- 目标：消除会话固定与会话劫持面。
- 任务：实现登录成功后 `session.invalidate()` 再重建会话；给会话 Cookie 设 HttpOnly、Secure、SameSite=Lax、合理 Path 与过期，并加空闲超时；开启全站 HTTPS。构造"预置 JSESSIONID 再诱导登录"的会话固定用例，验证被重建会话打断。
- 验收标准：登录后会话 ID 变化；Cookie 三属性齐备；有 XSS 时脚本读不到会话 Cookie；跨站请求不自动带 Cookie。
- 参考解法要点：HTTPS 防嗅探、空闲超时缩小劫持窗口。

### 作业 2：JWT 存放与 CSRF 联动验证

- 目标：证明"凭证是否被自动携带"决定 CSRF 暴露面。
- 任务：分别把 JWT 放 ① Authorization 头 ② HttpOnly Cookie，观察 SameSite 与 CSRF 表现差异；对放 Cookie 的方案补上 CSRF Token/双重提交 + SameSite 并复验。对比 localStorage 存储在 XSS 下被全量窃取的风险。
- 验收标准：能演示"放头基本免 CSRF、放 Cookie 需另防"；加固后跨站伪造被拒；说清各存放位置的 XSS/CSRF 取舍。
- 参考解法要点：CSRF 依赖自动携带，自定义头不自动带；HttpOnly 抗 XSS 读但不解决 CSRF。

### 作业 3：令牌生命周期与吊销设计

- 目标：让无状态令牌"泄露也不长期有效、且能提前作废"。
- 任务：设计短 TTL 的 access + refresh 轮换（用一次换一次、检测复用即撤销整条链）；为登出/风控实现 JTI 黑名单兜底；强制服务端期望算法、拒绝 `alg=none`、防 HS/RS 混淆与 kid 注入。写一个用例验证被拉黑的 JTI 不再被接受。
- 验收标准：access 过期由 refresh 无感续期；复用旧 refresh 触发撤链；alg=none/混淆令牌被拒；黑名单命中即失效。
- 参考解法要点：敏感操作二次校验；TTL 与吊销窗口按业务风险权衡。
