# 安全过滤器链执行顺序

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：能在脑中画出一次请求穿过 Spring Security 过滤器链的完整时序（SecurityContextHolder 何时写入、异常在哪被翻译成 401/403），会配 SecurityFilterChain 并把自定义 JWT 过滤器放到正确位置，识破 permitAll/ignoring 滥用的经典越权事故。

## 一、一个入口，一条有序链

Spring Security 在 Servlet 容器里只注册了**一个** Filter——`DelegatingFilterProxy` 桥接到 `FilterChainProxy`，后者按 `securityMatcher` 选择一条**有序**过滤器链执行。顺序不是实现细节，而是安全语义：上下文未建立时不能鉴权、鉴权未过时不能进业务、异常必须在最外层翻译。

```text
图目的：一次登录用户请求经过的关键过滤器（Security 6，从上到下即执行顺序）
1  DisableEncodeUrl / Hsts / Cors            —— 协议与响应头层，最先兜底
2  CsrfFilter                                —— 非幂等请求先过 CSRF 检查
3  LogoutFilter / 登录类 Filter（表单/OAuth2/自定义JWT）—— 认证：解析凭证 → 产出 Authentication
4  SecurityContextHolderFilter               —— 建立/恢复上下文（6 起懒加载，不再主动写 session）
5  RequestCache / Anonymous / SessionManagement（并发登录控制）
6  ExceptionTranslationFilter                —— 只负责翻译：捕获下面抛出的认证/授权异常
7  AuthorizationFilter                       —— 最后一道闸：hasRole/SpEL 表达式判 403
❌ 误读：把它当普通 Filter 随意插队——自定义过滤器排在 AuthorizationFilter 之后等于永远不生效
```

## 二、认证与授权的交接棒

第 3 步的认证过滤器把凭证交给 `AuthenticationManager`（默认 `ProviderManager` 派给匹配的 Provider），成功后写入 `SecurityContextHolder`；第 7 步 `AuthorizationFilter` 从上下文取 `Authentication` 评估 `authorizeHttpRequests` 规则。失败路径靠 **ExceptionTranslationFilter**：`AuthenticationException` → `AuthenticationEntryPoint`（401，"你是谁都不对"）；`AccessDeniedException` → `AccessDeniedHandler`（403，"知道了你但不配"）——这对语义是 API 网关与前端联调的契约基础。

```java
// 目的：Security 6 标准姿势——lambda DSL + 显式匹配器，一条链覆盖业务路由
@Bean SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http.securityMatcher("/api/**")
        .csrf(csrf -> csrf.disable())                       // 说明：纯 token API 可关 CSRF；有 Cookie 会话再关就是 XSS 直通车（反例见下）
            .authorizeHttpRequests(a -> a
        .requestMatchers("/api/public/**").permitAll()      // 反例：图省事对 /api/** 整体 permitAll ❌ 全系统裸奔的经典事故；单星 /api/* 漏多级子路径则是另一个方向的坑（误拦）
        .requestMatchers("/actuator/**").hasRole("OPS")     // 结果：actuator 被 permitAll 覆盖=健康检查变攻击面（env/heapdump 泄密钥）
        .anyRequest().authenticated())
        .addFilterBefore(jwtAuthFilter,                    // 位置关键：必须在 AuthorizationFilter 之前写入 SecurityContext
            UsernamePasswordAuthenticationFilter.class)    // 异常：JwtFilter 排到链尾 → 上下文永远空，全部 401 却查不出原因
        .exceptionHandling(e -> e.authenticationEntryPoint(new JwtEntryPoint())
            .accessDeniedHandler(new RoleDeniedHandler())) // 401/403 口径统一在这收口，前端按码分流登录/无权限页
        .build();
}
// 说明：多个 SecurityFilterChain bean 用 securityMatcher 划分领地，排序靠 @Order；漏配 matcher 会让副链永远不命中
```

## 三、上下文与线程模型的两个坑

`SecurityContextHolder` 默认 ThreadLocal 存储：**异步线程（@Async、线程池、虚拟线程并发扇出）拿不到上下文**——要么传递（`DelegatingSecurityContextExecutor`），要么把所需权限提前收敛为方法参数。第二个坑在 WebFlux/虚拟线程高并发场景，ThreadLocal 的成本语义变化，Security 6.1+ 提供共享/协程化存储方案，迁移前先压测（上下文丢失的表象是一片 403，极易误判为权限配置错误）。

## 四、排查手册：链序问题的三板斧

1. `logging.level.org.springframework.security=TRACE` 看请求依次经过哪些过滤器、在哪一步被拒；
2. `/actuator/filters`（或打印 `FilterChainProxy`）核对真实注册顺序与链数；
3. 自定义过滤器"不生效"三连查：是否注册成 Bean 导致**容器级重复执行**（链内+链外各跑一遍）、securityMatcher 是否覆盖该路由、位置是否在认证之后授权之前。

## 五、关联课程

认证产出的 `Authentication/GrantedAuthority` 模型与权限设计在 [认证授权模型与权限设计](S1-2-Lesson.md)；JWT 过滤器里验签的细节在 [JWT 结构与签名验证](../../jwt/s1/S1-1-Lesson.md)；OAuth2 登录过滤器对接授权流程见 [授权码 + PKCE、scope 与令牌存储](../../oauth2/s1/S1-2-Lesson.md)；过滤器之外的注入/CSP 防线在 [注入原理与预处理防御](../../web-defense/s1/S1-1-Lesson.md)；传统容器场景的等价机制对照见 [Realm 与权限粒度设计](../../shiro/s1/S1-1-Lesson.md)。
