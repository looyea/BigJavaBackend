# Realm 与权限粒度设计

> 本节难度：★★★☆☆
> 本节重要性：★★☆☆☆
> 学习产出：能画出 Subject → SecurityManager → Realm 的三段架构，写对 `user:create` 式权限串与通配表达式；理解 Shiro 自带的授权缓存与 SessionDAO 集群化方案，并给出 Shiro 与 Spring Security 的选型判断。

## 一、三段架构：Shiro 自己管到 Session

```text
图目的：看清 Shiro 的权威点分布——Subject 是门面，SecurityManager 是中枢，Realm 是数据适配层
Servlet/Web ──> ShiroFilter（链定义 shiroFilterChainDefinitions）
                   └─> Subject（当前会话门面：isPermitted / hasRole / getSession）
                          └─> SecurityManager（Authenticator + Authorizer + SessionManager 三合一）
                                 └─> Realm 0..N（AuthorizingRealm：doGetAuthenticationInfo / doGetAuthorizationInfo）
                                        └─> DB / LDAP / 自定义源
```

与 Spring Security 最大的架构差异：Shiro 的 `SecurityManager` 内建 **SessionManager**，不依赖容器的 HttpSession 也能跑（Swarm 无 Web 环境可用）；Spring Security 则把会话留给容器、自己只管 SecurityContext。这一句是选型讨论的第一性事实。

## 二、Realm：认证与授权两个回调

`AuthorizingRealm` 只需实现两个方法——`doGetAuthenticationInfo`（验凭证，返回账号+密码哈希给 Comparators 比对）与 `doGetAuthorizationInfo`（装载角色/权限集合）。注意后者**只在缓存未命中时被调用**，这是下一节缓存的钩子。

```java
// 目的：写对 Realm 的两个回调，避掉"在 AuthenticationInfo 里塞权限"的串位反例
@Override
protected AuthorizationInfo doGetAuthorizationInfo(PrincipalCollection principals) {
    SimpleAuthorizationInfo info = new SimpleAuthorizationInfo();
    info.setRoles(roleDao.of(user(principals)));                 // 角色名原样入库，无前缀契约
    info.setStringPermissions(perms(principals));                // 例：["user:create", "order:refund:*"]
    return info;
    // 反例：把权限算成布尔一次性返回 ❌ 失去通配与隐含语义，粒度退化成接口一一对应
}
// 反例：doGetAuthenticationInfo 里顺手查全量权限 ❌ 登录路径被授权查询拖慢，
//        且 Shiro 会把这个调用结果误缓存进授权缓存——两库职责混用的经典事故
```

权限串规范：`资源:动作:实例:附加`，缺省位可用 `*` 通配——`user:create` 隐含被 `user:*` 与 `*` 命中（`WildcardPermission` 逐段匹配）。角色判定 `hasRole` 与权限判定 `isPermitted` 是**两条独立通道**，Shiro 不像 Spring Security 那样让角色自动吃权限，需 `RolePermission` 映射显式桥接——这是从 Spring Security 迁来的人最容易误判的一点。

## 三、授权缓存与 SessionDAO：分布式化的两块拼图

Shiro 自带授权缓存抽象（`CacheManager` 挂 Ehcache/Redis），`doGetAuthorizationInfo` 的结果按 principal 缓存；改权限后必须显式 `clearCachedAuthorizationInfo`，否则"改了库权限没生效"的幽灵 403。会话侧默认单机内存 `MemorySessionDAO`，集群必须换 `EnterpriseCacheSessionDAO` + Redis 后端 `SessionDAO`，配合 `DefaultWebSessionManager` 关掉容器 Cookie 重写。

```java
// 目的：集群部署的两个必改点——否则登录态随节点漂移、权限缓存永不失效
@Bean
public SessionDAO sessionDAO(RedisTemplate<String, Object> redis) {
    RedisSessionDAO dao = new RedisSessionDAO(redis, "shiro:session:"); // 结果：会话出站，节点无状态
    dao.setActiveSessionsCacheName("shiro-activeSessionCache");
    return dao;
    // 反例：生产留着 MemorySessionDAO ❌ 负载均衡切节点即掉登录，表现为"随机要求重新登录"
}
// 反例：开了授权缓存却不接失效事件 ❌ 撤权后旧权限最长活到 TTL，离职账号窗口期越权面
```

## 四、与 Spring Security 的定位对照

同代产物、哲学相反：Shiro 全自管（认证+授权+会话+缓存一站式，API 直觉，`subject.hasRole` 随处可调），Spring Security 深嵌 Servlet/MVC 生态（链式配置、OAuth2/Login 子系统完备、方法级 SpEL 精细）。存量 Shiro 项目继续维护没问题；新项目若走 OAuth2/JWT 无状态主线，Spring Security 的官方生态红利明显更大（对照详述见 [安全过滤器链执行顺序](../../spring-security/s1/S1-1-Lesson.md)）。判断口径：**要不要框架管会话**——要，Shiro 顺手；不要（纯 Token），Spring Security 原生。

## 五、关联课程

权限串与 RBAC 建模的通用方法在 [认证授权模型与权限设计](../../spring-security/s1/S1-2-Lesson.md)；BCrypt 哈希在 Realm 里怎么比对见 [对称/非对称/哈希与密码存储](../../data-security/s1/S1-1-Lesson.md)；会话集群化与无状态化的取舍在 [无状态登出、吊销与与 OAuth2 协同（关联）](../../jwt/s1/S1-3-Lesson.md)。
