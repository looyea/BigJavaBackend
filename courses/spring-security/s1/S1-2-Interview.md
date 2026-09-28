# 认证授权模型与权限设计 · 面试题

## 题 1：认证成功后的 Authentication 对象里有什么？credentials 去哪了？

- principal：主体，通常是 `UserDetails`（或 OAuth2 场景下的 Jwt principal），授权决策围绕它展开。
- authorities：`GrantedAuthority` 集合，登录时由 `UserDetailsService` 一次性聚合装载，后续请求直接消费内存对象。
- credentials：密码/凭证，`DaoAuthenticationProvider` 默认擦除（`eraseCredentials`），防止密码随会话序列化进 Redis 或日志。
- 加分：`eraseCredentialsAfterThrow` 与 `ProviderManager` 的 `setEraseCredentialsAfterAuthentication` 语义差别；JWT 场景 credentials 是令牌本身，验证后同样不驻留。

## 题 2：hasRole 和 hasAuthority 差在哪？设计权限串时怎么避免踩坑？

- `hasRole('ADMIN')` 编译为匹配 `ROLE_ADMIN`，`hasAuthority('ADMIN')` 精确匹配——库自动补前缀是最大心智负担。
- 反例：DB 存 `ROLE_ADMIN` 却写 `hasRole('ROLE_ADMIN')`，实际匹配 `ROLE_ROLE_ADMIN`，永远 403。
- 实践建议：权限建模统一用 `资源:动作[:范围]` 三段串（如 `order:refund:apply`）走 `hasAuthority`，角色仅作授权包入口，不与权限串混用同一命名空间。
- 加分：多角色并集用 `AnyRequestMatcher`/SpEL 组合，层级压制用 `RoleHierarchy`（ADMIN ⊃ EDITOR）避免 `hasAnyRole` 列表越写越长。

## 题 3：为什么 Spring Security 只管功能权限，数据权限要自己下推 SQL？

- 框架的授权决策发生在请求入口，输入是"用户 + 接口"，它不知道"这次查询会碰到哪几行数据"。
- `@PostFilter` 看似能做数据权限，实为先查全量再内存过滤：DB 负载、拖库泄漏、分页失真三重反模式。
- 正解是把用户的数据范围（租户 ID、区域列表）注入查询条件——MyBatis 拦截器或 JPA `@Filter`，让越权数据根本不出库。
- 加分：下推失败必须默认拒绝（fail-closed）而非跳过条件；多租户改造与 [Web 安全防护](../../web-defense/s1/S1-3-Lesson.md) 的水平越权是同一问题的两层防线。

## 题 4：@PreAuthorize 和过滤器链上的 AuthorizationFilter 是什么关系？只留一个行不行？

- 两层互补：`AuthorizationFilter` 在链尾做"接口级"粗准入（URL → 所需角色），`@PreAuthorize` 在方法上做"业务级"细判定（SpEL 可引用参数，如 `#orderId` 归属校验）。
- 只留链层：接口放行后方法内裸奔，同一接口服务多租户时无从判断数据归属；只留注解：恶意请求穿透到业务层才被拒，审计与限流信号已被污染。
- 注解走 AOP（`MethodSecurityInterceptor`），同类内部 `this` 调用绕过代理导致鉴权失效，与事务失效同因。
- 加分：`@PreAuthorize` 对 `@Transactional` 的执行顺序（先鉴权后开事务）是对的，反过来会因越权事务回滚留下脏审计。

## 题 5：权限要运行时可变（改配置不发版），怎么设计？

- 把 `.anyRequest().permitAll()` + 硬编码规则换成自定义 `AuthorizationManager`，`decide` 回调里按 `URI + method` 查"接口→权限"映射表。
- 映射表与"用户→权限"两级缓存（本地 Caffeine + Redis），变更通过事件广播主动失效，TTL 兜底防消息丢失。
- 陷阱：缓存不一致期间各节点判定不同，同一用户一会儿 403 一会儿 200——失效广播要带版本号，节点丢弃旧事件。
- 加分：改权限动作本身要有审计与灰度（先单节点生效）；参考实现见 [课文动态授权一节](S1-2-Lesson.md)。

## 题 6：RBAC、ABAC、ReBAC 怎么选型？

- RBAC（角色中转）：授权关系固化在"角色-权限"表，模型简单、缓存友好，适合后台管理系统这类权限可枚举的场景。
- ABAC（属性决策）：规则引擎按"用户属性 + 资源属性 + 环境"实时判定（如"部门总监在工作时间可审批 50 万内付款"），灵活但难审计、难缓存。
- ReBAC（关系图）："用户与资源存在某种关系即可访问"（Google Zanzibar 模型，SpiceDB/OpenFGA），适合共享协作类"文档被 10 万人分享"的关系爆炸场景。
- 加分：工业实践常混用——对外 API 走 RBAC 打底，个别复杂判定嵌 ABAC 规则；面试能讲出"RBAC 表达'谁能用什么功能'，ReBAC 表达'谁能碰哪条数据'"即达生产认知。
