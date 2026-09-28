# Realm 与权限粒度设计 · 面试题

## 题 1：讲讲 Shiro 的整体架构，Realm 在其中扮演什么角色？

- 三层：Subject（应用门面）→ SecurityManager（认证/授权/会话三合一中枢）→ Realm（安全数据适配层，对接 DB/LDAP 等）。
- `AuthorizingRealm` 只需实现两个回调：`doGetAuthenticationInfo` 验凭证、`doGetAuthorizationInfo` 装角色权限——后者仅在授权缓存未命中时被调用。
- 反例：登录回调里顺手查全量权限，登录路径被拖慢且结果可能被误缓存，属职责串位。
- 加分：多 Realm 按 `supports(tokenClass)` 路由，顺序影响短路；这是"框架只管流程、数据源自己插拔"的模板。

## 题 2：Shiro 的权限串怎么设计？`isPermitted` 的匹配规则是什么？

- 格式 `资源:动作:实例:附加`，`WildcardPermission` 逐段匹配：已授予 `user:*` 蕴含请求 `user:create`，`*` 蕴含一切。
- 粒度到"操作"而非"菜单"：`order:refund:exec` 与 `order:refund:audit` 拆开，审批与执行分离可直接表达。
- 坑：Shiro 的角色不自动蕴含权限，`hasRole("ADMIN")` 为 true 不代表 `isPermitted` 通过，需显式把 `role:admin` 之类权限挂进角色。
- 加分：对比 Spring Security 的 `hasRole` 自动补 `ROLE_` 前缀——两家命名契约相反，混用系统是面试深挖点。

## 题 3：Shiro 和 Spring Security 怎么选型？

- 第一性差异：Shiro 的 SecurityManager 内建 SessionManager，可脱离 Servlet 容器运行（批处理/Swarm 场景独有优势）；Spring Security 把会话留给容器，自己只管 SecurityContext。
- 生态：OAuth2/OIDC/Login 官方子系统、方法级 SpEL、深嵌 MVC 是 Spring Security 主场；Shiro 侧这些要自研。
- 口径：要框架管会话选 Shiro，纯 Token 无状态选 Spring Security；存量 Shiro 项目功能不缺一律不值得重写迁移。
- 加分：能指出两者都只管"功能权限"，数据权限（行级）都得下推 SQL，选型不解决这个问题。

## 题 4：集群部署 Shiro 要动哪两块？各自不改会出现什么现象？

- 会话出站：默认 `MemorySessionDAO` 单机内存，必须换 `EnterpriseCacheSessionDAO` + Redis 后端——不改的现象是负载均衡切节点"随机掉登录"。
- 授权缓存接管：`CacheManager` 挂 Redis，`doGetAuthorizationInfo` 结果按 principal 缓存共享。
- RememberMe cookie 加密密钥要全节点一致，否则部分节点解不开免登录令牌。
- 加分：主动失效链路——权限变更事件广播 + 版本号防乱序 + TTL 兜底，缺失效机制就是撤权窗口期越权事故。

## 题 5：改了权限表但用户还是旧权限，怎么排查？

- 首查授权缓存：`doGetAuthorizationInfo` 有缓存，改库不触发 `clearCachedAuthorizationInfo` 则最长活到 TTL——这是第一嫌疑。
- 二查会话亲和：多节点各持本地 Ehcache，失效只清了收到事件的节点。
- 三查主体错位：缓存 key 若错设成 sessionId，同一用户多会话各存一份，清不干净。
- 加分：给出验证脚本——撤权后固定打三节点同一接口看 403/200 矩阵，10 秒定位是缓存层还是广播层问题。

## 题 6：无 Web 环境（批处理、MQ 消费者）怎么做 Shiro 鉴权？

- 正是 Shiro 强项：直接 `new DefaultSecurityManager()` 挂 Realm，`subject.execute(principal, runnable)` 以指定身份运行代码段，全程不需要 HttpSession。
- Spring Security 等价做法是手工构造 `UsernamePasswordAuthenticationToken` 塞进 `SecurityContextHolder`，子线程还要处理 ThreadLocal 传递。
- 注意：异步线程池里 Subject 上下文不自动跟随，要么包装 Runnable 要么显式 re-associate。
- 加分：能对比两家 ThreadLocal 模型在异步/虚拟线程下的坑（Shiro 的 `ThreadState` 与 Spring 的 `SecurityContextHolderStrategy`），说明这题在回答"上下文归属"而非"API 好不好用"。
