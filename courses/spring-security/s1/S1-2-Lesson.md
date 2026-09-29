# 认证授权模型与权限设计

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：吃透 Authentication/GrantedAuthority 的对象模型与 Provider 认证机制，能设计 RBAC 权限粒度并把数据权限稳稳落到应用/SQL 层；会写方法级 @PreAuthorize 与动态授权（改权限不发版），并识破"前端藏按钮就是安全"的经典幻觉。

## 一、认证对象模型：一次登录产出了什么

`AuthenticationManager`（默认 `ProviderManager`）按凭证类型派给匹配的 `AuthenticationProvider`：表单走 `DaoAuthenticationProvider`（UserDetailsService + PasswordEncoder），OAuth2/JWT 各有对应 Provider。成功后产出的 `Authentication` 携带三样东西——**principal（主体）、credentials（凭证，成功后默认擦除）、authorities（权限集合）**，存入 SecurityContext 供后续所有授权决策消费。

```java
// 目的：看懂权限判定的命名契约——hasRole 与 hasAuthority 差一个前缀
@GetMapping("/orders/{id}")
@PreAuthorize("hasRole('ADMIN')")                    // 等价于 hasAuthority('ROLE_ADMIN')：hasRole 自动补 ROLE_ 前缀
public Order get(@AuthenticationPrincipal UserPrincipal me, @PathVariable Long id) {
    return service.load(me, id);
}
// 反例：GrantedAuthority 存成 "ADMIN" 再用 hasRole('ADMIN') ❌ 实际比较的是 "ROLE_ADMIN"，永远 403——
//        前缀约定不一致是权限联调的第一大耗时坑，入库规范要写死
// 说明：方法级防越权靠参数绑定——@PreAuthorize("#me.id == #id or hasRole('ADMIN')")，数据归属在服务层再兜底
```

## 二、RBAC 落地：五张表管不住的所有权

标准 RBAC（用户-角色-权限-资源，中间两张关联表）解决"**能不能调这个接口**"，但它天然回答不了"**能不能碰这条数据**"：

- **垂直越权**（功能权限）：RBAC 覆盖——权限字符串按 `域:资源:动作` 设计（`order:refund:exec`），粒度到操作而非菜单，角色只聚合权限不直接绑接口，改接口不动角色；
- **水平越权**（数据权限）：框架不管——必须落到 SQL/应用层：多租户 `tenant_id` 由 MyBatis 拦截器统一注入，行级范围（本人/本部门/全部）翻译为数据条件而非 if 语句散落在 Service；
- 角色层级用 `RoleHierarchy` bean 表达继承（AUDITOR 蕴含 VIEWER），避免"高级角色要在每个规则里重复列举"。

```java
// 目的：动态授权——权限规则改库即生效，不发版不重启
@Bean AuthorizationFilter authorizationFilter(RequestMatcherResolver r) {
    return new AuthorizationFilter(r, (auth, request) ->
        authorizationService.decide(auth, request));   // 结果：决策走缓存（本地+Redis 两级），变更事件驱动失效
}
// 反例：每次请求回源查"角色-权限"联表 ❌ 权限表变全站单点热点，压测 TPS 被 DB 卡死
//        另一反例：@PostFilter("filterObject.ownerId == authentication.principal.id") 做行过滤——
//        全量加载后在内存筛，大列表下既是性能事故又把他人数据的存在性泄漏在耗时差里
```

## 三、前端隐藏 ≠ 授权：决策点必须在服务端

菜单/按钮的显隐是**体验优化**，不是安全：接口永远可被直接调用。授权决策的唯一权威点在服务端（链上 AuthorizationFilter + 方法级注解双层），前端拿 `/me/permissions` 集合渲染只是消费同一份事实源。审计口径：**任何"藏起来"的入口，都要能回答"直接调它的 API 会怎样"**——答不上来就是越权面。ABAC/表达式权限（"金额>1万的退款需双人复核"）放服务层策略引擎，别硬塞进 URL 规则。

## 四、密码与主体侧的配套纪律

DaoAuthenticationProvider 必须配强哈希（BCrypt/Argon2，详见 [对称/非对称/哈希与密码存储](../../data-security/s1/S1-1-Lesson.md)）；`eraseCredentialsAfterAuthentication` 默认 true 别关；UserDetails 里不要塞大对象（会话存储/克隆成本）；账号锁定与并发会话控制（`maximumSessions`）是认证域配置，常被误当成授权问题排查。

## 五、关联课程

链上执行位置与 401/403 翻译在 [安全过滤器链执行顺序](S1-1-Lesson.md)；Token 里的 claims 如何映射 authorities 见 [Claims、刷新与算法攻击防护](../../jwt/s1/S1-2-Lesson.md)；OAuth2 scope 与权限的关系在 [核心角色与四种授权模式](../../oauth2/s1/S1-1-Lesson.md)；水平/垂直越权的攻击案例在 [反序列化、越权与业务逻辑漏洞](../../web-defense/s1/S1-3-Lesson.md)；Shiro 的等价建模对照在 [Realm 与权限粒度设计](../../shiro/s1/S1-1-Lesson.md)。
