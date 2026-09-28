# Realm 与权限粒度设计 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. Shiro 三段架构中，"当前会话门面"指的是？（6分）

- A. SecurityManager
- B. Subject
- C. Realm
- D. ShiroFilter
> 答案：B
> 解析：Subject 是应用代码直接接触的门面（isPermitted/hasRole/getSession），背后委托给 SecurityManager。

### 2. AuthorizingRealm 中负责装载角色与权限集合的方法是？（6分）

- A. doGetAuthenticationInfo
- B. doGetAuthorizationInfo
- C. supports(AuthenticationToken)
- D. hasRole(role)
> 答案：B
> 解析：doGetAuthorizationInfo 返回 AuthorizationInfo（角色+权限串集合）；A 是验凭证，且该方法只在授权缓存未命中时被调用。

### 3. 权限串 `user:create` 能被以下哪个已授予的权限命中？（6分）

- A. `user`
- B. `user:*:view`
- C. `user:*`
- D. `create:*`
> 答案：C
> 解析：WildcardPermission 逐段匹配，`user:*` 的第二段通配吃下 `create`；A 段数不足且无通配，B 动作段固定为 view。

### 4. Shiro 中 `hasRole("ADMIN")` 为 true 但 `isPermitted("user:create")` 为 false，可能的原因是？（6分）

- A. 缓存未过期
- B. Shiro 的角色不会自动蕴含权限，需显式建立 RolePermission 映射
- C. 角色名必须加 ROLE_ 前缀
- D. Realm 只能返回一种类型
> 答案：B
> 解析：角色与权限是两条独立判定通道，这正是与 Spring Security（可配 RoleHierarchy/权限挂载）不同的地方。

### 5. 集群部署时替代默认 MemorySessionDAO 的正确组合是？（6分）

- A. Ehcache + MemorySessionDAO
- B. EnterpriseCacheSessionDAO + Redis 后端 SessionDAO
- C. 容器 HttpSession 直接复用
- D. CookieRememberMeManager 加密即可
> 答案：B
> 解析：会话必须出站共享，否则负载均衡切节点即"随机掉登录"；D 只解决记住我，不解决会话漂移。

### 6. 撤权后用户仍带着旧权限访问，最直接的根因是？（6分）

- A. 授权缓存未做失效（未调 clearCachedAuthorizationInfo）
- B. SessionDAO 序列化太慢
- C. ShiroFilter 链顺序错误
- D. doGetAuthenticationInfo 返回了过期密码
> 答案：A
> 解析：doGetAuthorizationInfo 的结果按 principal 缓存，改库不触发失效则最长活到 TTL——离职窗口期越权面。

### 7. 与 Spring Security 选型时，Shiro 更顺手的场景是？（6分）

- A. 深度依赖 OAuth2 Login 官方子系统
- B. 纯 JWT 无状态微服务网关
- C. 框架需自管会话的非 Web 环境（如批处理/Swarm）
- D. 需要 SpEL 方法级细粒度表达式
> 答案：C
> 解析：SecurityManager 内建 SessionManager 不依赖容器是 Shiro 独有优势；A/B/D 都是 Spring Security 的主场。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. 关于 Realm 的实现纪律，正确的有？（多选）（9分）

- A. doGetAuthenticationInfo 只验凭证，不查全量权限
- B. 密码比对交给 HashedCredentialsMatcher，Realm 返回存储哈希即可
- C. 在 doGetAuthenticationInfo 里顺带查权限并塞进缓存，可以减少一次 DB 查询，是推荐做法
- D. 多 Realm 时按 supports(tokenClass) 路由，顺序影响短路行为
> 答案：A、B、D
> 解析：C 恰是课文反例——登录路径被授权查询拖慢，且认证调用结果可能被误缓存进授权缓存，属职责串位事故。

### 9. 授权缓存接入 Redis 后，必须配套的治理动作有？（多选）（9分）

- A. 权限变更事件驱动 clearCachedAuthorizationInfo
- B. TTL 兜底，防止失效消息丢失后永久脏读
- C. 把缓存 key 设为 sessionId 而非 principal，保证同会话一致
- D. 失效广播带版本号，丢弃乱序旧事件
> 答案：A、B、D
> 解析：C 错误——同一 principal 多会话会各存一份，缓存应以用户为主体；其余三项构成"事件失效 + TTL 兜底 + 幂等乱序保护"闭环。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 你接手一个单机 Shiro 项目要上 3 节点集群并支持"改权限不发版"，请给出缓存与会话层的改造方案要点。（40分）

> 参考答案：
- 要点1：会话出站——EnterpriseCacheSessionDAO + Redis SessionDAO，节点不再持有会话，掉登录问题根除。
- 要点2：授权缓存接管——CacheManager 挂 Redis，Realm 的 doGetAuthorizationInfo 结果按 principal 缓存。
- 要点3：失效链路——权限表变更发布事件（Redis pub/sub），消费端调 clearCachedAuthorizationInfo，并设 TTL 兜底。
- 要点4：登录态与 RememberMe 密钥集群统一（cookie 加密密钥不一致会导致随机掉线）。
- 要点5：验收用例——撤权后 1 秒内三节点一致 403；kill 任一节点用户无感。
- 要点6：评估是否值得——若权限模型复杂且新项目走 Token 化，对照 Spring Security 动态授权方案再定迁移方向。
