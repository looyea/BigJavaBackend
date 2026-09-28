# 安全过滤器链执行顺序 · 面试题

## 题 1：讲一讲 Spring Security 一次请求的完整流程。

- 容器只有一个 DelegatingFilterProxy → FilterChainProxy 按 securityMatcher 选中内部有序链；
- 主干：协议/头过滤器 → CsrfFilter → 认证类过滤器（表单/OAuth2/自定义，产出 Authentication 写入 SecurityContext）→ SessionManagement/匿名 → ExceptionTranslationFilter 包着末端 AuthorizationFilter；
- 授权不过抛 AccessDeniedException，由翻译层按"未认证/已认证无权限"分别走 EntryPoint(401)/DeniedHandler(403)；
- 加分：能画出链序图并指出两处"顺序即语义"依赖（认证先于授权；翻译必须在外层）。

## 题 2：自定义 JWT 过滤器应该加在哪里？常见事故是什么？

- 位置：认证段、AuthorizationFilter 之前，常以 UsernamePasswordAuthenticationFilter 为锚点 addFilterBefore；职责是验签后 `SecurityContextHolder.setContext`；
- 事故一：锚点过滤器不在当前链（没启用表单登录）导致排位失效掉到链尾——上下文永远空，全 401；事故二：过滤器注册成 @Component 被容器再挂一次，token 解析两遍、甚至绕开链语义；
- 事故三：只验签不设 authorities，AuthorizationFilter 拿不到权限全 403；
- 加分：给出排错三板斧——TRACE 日志看链、actuator/filters 看注册表、MockMvc securityDsl 写 200/401/403 三断言锁行为。

## 题 3：401 和 403 什么时候出现？为什么这个区分重要？

- 401：认证失败/未建立上下文，AuthenticationEntryPoint 输出，语义是"重新登录"；403：已认证但授权不过，AccessDeniedHandler 输出，语义是"权限不足"；
- 前端按码分流：401 触发刷新令牌/跳登录，403 提示无权限并上报（可能是越权探测）；混用的恶果是 token 过期被当 403，前端永远卡在无权限页；
- 注意默认 HttpBasic/表单入口的 401 带 WWW-Authenticate，纯 API 常自定义 EntryPoint 返回 JSON；
- 加分：指出"permitAll 的路径异常也可能变 500"——ExceptionTranslation 只翻译链内异常，Controller 里再抛的要靠 @ExceptionHandler 收口。

## 题 4：SecurityContextHolder 为什么默认用 ThreadLocal？异步场景怎么办？

- 请求-线程绑定模型下 ThreadLocal 最简单安全：一处 set 全调用栈可读，不用层层传参；
- 代价：@Async/线程池/虚拟线程扇出/MQ 消费线程拿不到上下文——上下文传递要显式（DelegatingSecurityContext* 包装执行器），"该不该传"要先想清语义：消费线程继承 HTTP 主体权限通常是错的；
- 替代设计：把鉴权结论收敛为方法入参（principal 注入），下游不依赖线程魔法，可测性更好；
- 加分：提 Security 6.1+ 对 ContextReloader/协程化存储的演进与虚拟线程下 ThreadLocal 的成本讨论。

## 题 5：多个 SecurityFilterChain 怎么协作？配置错会的典型症状？

- 每条链用 securityMatcher 声明领地，@Order 决定尝试顺序，第一个匹配的链生效；常见拆法：API 链（无状态+JWT）、OAuth2 授权服务器链、actuator 管理链；
- 症状一：漏写 matcher 的链吃掉所有请求，业务链永远不命中（TRACE 看 FilterChainProxy 选链）；症状二：两条链都覆盖同一路径，行为随 Order 漂移，"本地好预发坏"；
- 纪律：链的领地划分写进文档，anyRequest 兜底只留一条默认链；
- 加分：说明 WebSecurityCustomizer.ignoring() 是完全绕开链（静态资源级），误用它放行接口=连 CSRF/头保护都没有。

## 题 6：安全过滤器链和 MVC 拦截器、网关鉴权是什么关系？怎么分工？

- 三层递进：网关（粗粒度：token 真伪、限流、路由级鉴权）→ Security 过滤器链（请求级：认证建立+URL 授权+CSRF/头）→ MVC 拦截器/AOP（业务级：数据权限、@PreAuthorize 方法细防）；
- 原则：**每层只做本层代价最低且必须兜底的事**，安全决策不重复也不留缝——网关验过的签名不在应用层再验一遍（除非零信任内网也要验），但"任何请求可达应用"的路径必须有链兜底（网关被旁路/内网直连场景）；
- 反模式：拦截器做认证（太晚且绕开异常翻译体系）、应用授权逻辑写两处（链规则与代码 if 各一套，必然漂移）；
- 加分：结合金融/电力私有化场景说明"旁路直连必须也能拒绝"的纵深防御论证。
