# Realm 与权限粒度设计 · 作业

## 作业 1：双 Realm 工程与权限串通配验证

- **目标**：跑通 Subject → SecurityManager → Realm 主链路，验证 WildcardPermission 的隐含命中规则。
- **任务**：自建一个 `AuthorizingRealm`（用户表查凭证 + 角色/权限表装载 `Set<String>`），配 `HashedCredentialsMatcher`（BCrypt）；用 `subject.isPermitted("user:create")` 依次验证已授予 `user:*`、`*`、`user:update` 三种权限串的命中结果，写成参数化单测。
- **验收标准**：`user:*` 与 `*` 命中为 true、`user:update` 为 false 且断言全绿；`doGetAuthenticationInfo` 路径无任何权限表查询（SQL 日志证明）。
- **参考解法要点**：`WildcardPermission implying` 逐段判定——被请求权限的每一段要么是 `*` 要么包含请求动作；登录只验凭证、授权装载留给 `doGetAuthorizationInfo`（见 [课文](S1-1-Lesson.md) 第二节职责划分）。

## 作业 2：集群化改造——会话出站 + 缓存失效闭环

- **目标**：把单机 Shiro 改造成 3 节点无共享状态部署，并消灭"撤权不生效"幽灵。
- **任务**：`EnterpriseCacheSessionDAO` + Redis `SessionDAO` 替换默认内存实现；`RedisCacheManager` 接管授权缓存；权限变更发布 Redis 事件，各节点消费后调 `clearCachedAuthorizationInfo`。演练：节点 A 撤掉用户 `order:refund:*`，3 秒内在节点 B/C 验证退款接口 403。
- **验收标准**：kill 任一节点登录态不丢；撤权后三节点一致 403 且未重启；RememberMe cookie 密钥三节点配置一致（跨节点免登录验证通过）。
- **参考解法要点**：缓存 key 以 principal 而非 sessionId 为主体；失效消息带版本号防乱序；TTL 兜底防事件丢失——与 [Spring Security 动态授权](../../spring-security/s1/S1-2-Lesson.md) 的两级缓存思路同源。

## 作业 3：Shiro → Spring Security 迁移评估（书面）

- **目标**：用架构师口径给出迁移/共存结论，而不是背"哪个更流行"。
- **任务**：盘点存量项目中 `subject.hasRole`、URL 链定义、RememberMe、原生 Session 四类用法，对照 Spring Security 6 的等价能力（RoleHierarchy、链式 DSL、持久化登录、需自建会话管理或转 Token），估算迁移工作量与风险清单。
- **验收标准**：结论包含"框架是否必须自管会话"这一判定轴；给出至少一条"不迁移"与一条"必须迁移"的具体触发条件。
- **参考解法要点**：OAuth2/JWT 无状态主线在 Spring Security 生态内是官方维护件，Shiro 侧需自研；反之批处理/非 Web 场景 Shiro 的独立 SecurityManager 更省事。
