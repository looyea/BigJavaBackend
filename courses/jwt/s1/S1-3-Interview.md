# 无状态登出、吊销与与 OAuth2 协同（关联） · 面试题

## 题 1：JWT 无状态，那怎么做"退出登录"？

- 认清前提：无状态 access 在到期前无法凭自身作废，"登出"是把它放进黑名单或等 TTL 自然过期。
- 分层动作：① 清应用本地会话；② AS 侧吊销 refresh（否则能继续换新 access）；③ 未过期 access 进 jti 黑名单（TTL=剩余有效期）。
- 前端只删 localStorage token 不是真登出——服务端令牌仍活。
- 加分：能主动说"要即时就得牺牲一部分无状态"，给出短 TTL 把窗口压到分钟级的默认折中。

## 题 2：黑名单方案怎么设计才不被拖垮？

- 只存"已撤销且未过期"的 jti，令牌一过期条目即淘汰，集合大小 ≈ TTL 窗口内撤销量。
- 用 Redis `SETEX`，key 过期自动清理，无需定时任务。
- 顺序：先验签再查黑，防伪造令牌用随机 jti 制造穿透/污染。
- 加分：黑名单是一次共享存储读，仍是"部分无状态"；比 introspection 轻，比纯自验重——讲清这条光谱。

## 题 3：refresh token 吊销和 access 黑名单是什么关系？

- 管的东西不同：refresh 吊销断"未来续命"，access 黑名单清"当下存量"。
- 只做 access 黑名单而漏 refresh，攻击者可用手上 refresh 不断换新 access，绕开撤销。
- 只做 refresh 吊销而不处理已发 access，则撤销窗口 = access TTL。
- 加分：封号/离职这类"全量下线"要把该用户 refresh 族全删 + 现有 access 拉黑，两手一起。

## 题 4：introspection 和自验签怎么选？

- 自验签：RS 用公钥本地验，零回源、扩展性最好，但撤销只能靠短 TTL/黑名单。
- introspection：RS 调 AS `/introspect` 实时问 active，秒级撤销、逻辑集中，代价是 AS 成可用性/性能关键。
- 选法：内容类容忍分钟窗口→自验 + 短 TTL；资金/权限敏感要即时→introspection 或自验 + 黑名单。
- 加分：introspection 结果可短 TTL 缓存降压，但缓存时长就是撤销延迟——量化取舍更显功力。

## 题 5：把 JWT/OIDC 和 OAuth2 拼成完整登录，链路怎么走？

- 登录：授权码 + PKCE 从 AS 换 access/id/refresh；Client 验 id_token（签名+iss+aud+nonce）建本地会话。
- 访问：带 access 调 RS，RS 自验或 introspect，校验 aud/scope。
- 续命：access 过期用 refresh 换（轮换 + 复用检测）。
- 登出：RP-Initiated 回 AS 结束中心会话 + Back-Channel 通知各应用清会话 + 吊销 refresh/拉黑 access。
- 加分：能画"登录—访问—续期—登出—被封"五段闭环即达架构级认知，参见 [OIDC、SSO 与令牌关系（关联 JWT）](../../oauth2/s1/S1-3-Lesson.md)。

## 题 6：改密码后要不要让旧令牌失效？怎么做到？

- 要。改密是典型"强制重认证"事件，旧令牌应尽快作废以防被窃后继续用。
- 做法：吊销该用户所有 refresh（断续命）+ 把当前 access 的 jti 入黑名单，或直接使签名密钥/`auth_time` 版本号失效。
- 无状态极简方案：在 claim 里放"凭证版本号/pwd_version"，改密后 +1，RS 比对会话记录版本不符即拒（仍需一处共享状态存最新值）。
- 加分：指出这本质仍是"引入最小共享状态换即时撤销"，与黑名单同源，按即时性要求选实现。
