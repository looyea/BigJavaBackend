# 安全过滤器链执行顺序 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. Spring Security 在 Servlet 容器中的注册形态是？（6分）

- A. 每个安全功能各注册一个容器 Filter
- B. 只注册一个 DelegatingFilterProxy，桥接到 FilterChainProxy 再选内部链
- C. 以 Interceptor 形式注册在 MVC 层
- D. 依赖容器 SPI 自动织入
> 答案：B
> 解析：容器视角只有一个入口 Filter，安全语义全在 FilterChainProxy 选出的有序内部链里。

### 2. 401 与 403 的翻译分别由哪两个组件完成？（6分）

- A. AuthorizationFilter / CsrfFilter
- B. AuthenticationEntryPoint / AccessDeniedHandler（由 ExceptionTranslationFilter 触发）
- C. LogoutFilter / SessionManagementFilter
- D. SecurityContextHolderFilter / RequestCacheFilter
> 答案：B
> 解析：ExceptionTranslationFilter 捕获认证/授权异常后交给 Entry Point（401）与 Denied Handler（403），这是前后端错误契约的落点。

### 3. 自定义 JWT 认证过滤器必须放在？（6分）

- A. AuthorizationFilter 之后
- B. UsernamePasswordAuthenticationFilter 之前（即认证段），保证进授权闸门前 SecurityContext 已写入
- C. FilterChainProxy 之外
- D. 任意位置，顺序无关
> 答案：B
> 解析：常见错法是排到链尾——上下文永远为空，接口全 401 还查不出配置问题。

### 4. Security 6 中 SecurityContextHolderFilter 相比旧版 HttpSessionContextIntegrationFilter 的关键变化是？（6分）

- A. 改为每次请求都强制写 session
- B. 懒加载上下文、不再主动持久化，写入交给显式机制
- C. 移除了 ThreadLocal 存储
- D. 只支持 WebFlux
> 答案：B
> 解析：6 起上下文持久化与恢复解耦，减少无会话 API 的 session 创建，是"性能+语义"双重修整。

### 5. @Async 方法里 SecurityContextHolder.getContext() 拿到匿名主体，根因是？（6分）

- A. 方法没加 @PreAuthorize
- B. 默认存储策略是 ThreadLocal，工作线程不继承请求线程上下文
- C. SecurityContext 已过期
- D. 过滤器链跳过异步
> 答案：B
> 解析：跨线程要用 DelegatingSecurityContextExecutor 等显式传递，或在入口把权限信息作为参数下传。

### 6. actuator 端点被 permitAll 覆盖，最严重的后果是？（6分）

- A. 启动变慢
- B. /env、/heapdump 等端点暴露配置与内存，密钥随意外泄
- C. 日志变多
- D. CSRF 失效
> 答案：B
> 解析："健康检查变攻击面"是过滤器链评审必查项：management 端点要么独立端口，要么显式授权。

### 7. 自定义认证过滤器"跑了两次"（重复解析 token）的常见原因是？（6分）

- A. 容器 keep-alive
- B. 过滤器既是 @Component（被容器自动注册）又被 addFilterBefore 放进 Security 链
- C. SecurityContext 被写两次属正常
- D. 日志级别 TRACE
> 答案：B
> 解析：注册成 Bean 会让它同时挂在容器级与链内——用 FilterRegistrationBean 关闭容器注册或不做 Bean。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于过滤器链顺序，正确的说法有？（9分）

- A. CsrfFilter 在认证过滤器之前，非幂等请求先验令牌
- B. AuthorizationFilter 是链末最后一道闸，此前上下文必须已建立
- C. 顺序可以随意调整，功能等价
- D. ExceptionTranslationFilter 位于授权闸门外层，才能捕获并翻译其异常
> 答案：ABD
> 解析：C 错——顺序即安全语义：认证先于授权、翻译包在最外，乱序典型症状是"过滤器不生效"或 500 裸异常。

### 9. （多选）Security 6 迁移中正确的做法有？（9分）

- A. authorizeRequests 换成 authorizeHttpRequests + requestMatchers
- B. 配置写成 http.authorizeRequests().antMatchers(...) 保留不变
- C. 多场景用多 SecurityFilterChain + securityMatcher + @Order 划分
- D. permitAll 规则按最小面列举，收尾 anyRequest().authenticated()
> 答案：ACD
> 解析：B 是已废弃写法（antMatchers 移除、authorizeRequests deprecated），新链模型下不写 matcher 会导致链选择混乱。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 上线后发现"所有 /api 接口返回 401，但 token 验签日志显示成功"，请基于过滤器链模型给出排查与修复方案。（40分）

> 参考答案：
- 要点1：先分层定位——TRACE 日志看请求实际走的链：是否命中预期 SecurityFilterChain（securityMatcher/@Order 错配会落到默认链）；
- 要点2：验签成功≠上下文写入——检查 JwtFilter 是否在认证成功后调用 SecurityContextHolder.setContext（漏 set 是典型低级错误）；
- 要点3：链序检查——JwtFilter 是否排在 AuthorizationFilter 之前；addFilterBefore 的锚点过滤器是否在当前链存在（没启表单登录时锚点不在链上会被挤到链尾）；
- 要点4：异常翻译路径——确认 401 来自 EntryPoint 还是被网关/其他组件抢先返回；区分"未建立上下文"与"权限不足"（后者应是 403）；
- 要点5：异步/线程因素——若鉴权在 @Async 或虚拟线程里读上下文，按 ThreadLocal 不继承处理；
- 要点6：修复后回归——把 permitAll 最小面、actuator 授权、链选择断言写进集成测试（MockMvc securityDsl），防"改一处坏一片"复发。
