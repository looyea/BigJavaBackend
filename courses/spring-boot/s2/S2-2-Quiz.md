# 小测验 · Spring MVC 请求处理全链路（Boot 视角）

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. 一个请求进入 `DispatcherServlet` 后，`doDispatch` 的第一步核心动作是？（20分）

- A. 直接反射调用 Controller 方法
- B. 通过 HandlerMapping 找到匹配的 HandlerMethod 及拦截器链
- C. 渲染视图
- D. 执行 Filter 链

> 答案：B
> 解析：先由 HandlerMapping 定位 Handler 与拦截器链，才谈得上适配与调用。

### 2. 关于 Filter 与 Interceptor，下列说法正确的是？（20分）

- A. Filter 能拿到目标 HandlerMethod，Interceptor 不能
- B. Interceptor 属于 Servlet 规范，Filter 属于 Spring
- C. Filter 在 DispatcherServlet 之前执行，Interceptor 能拿到 Handler 且分 pre/post/afterCompletion 三段
- D. 两者执行时机完全等价，只是叫法不同

> 答案：C
> 解析：Filter 属容器、在 DispatcherServlet 前、拿不到 Handler；Interceptor 属 Spring、能拿到 Handler 且三段执行。

### 3.（多选）Boot 的 `WebMvcAutoConfiguration` 为 MVC 组件提供默认 Bean 时遵循的约定包括？（20分）

- A. 使用 `@ConditionalOnMissingBean`，用户声明同类型 Bean 即覆盖默认
- B. 用户加 `@EnableWebMvc` 会关闭 Boot 的 MVC 自动配置
- C. 推荐的定制入口是实现 `WebMvcConfigurer`
- D. 只能通过修改框架源码替换默认组件

> 答案：ABC
> 解析：D 错，Boot 靠条件化 Bean 让位约定支持用户覆盖，无需改源码。

### 4. 客户端收到 415 Unsupported Media Type，最可能的原因是？（20分）

- A. 服务端没有匹配 `Accept` 头的转换器
- B. 请求 `Content-Type` 与 `@RequestBody` 依赖的消息转换器支持的类型不符
- C. 路径变量绑定失败
- D. 拦截器 preHandle 返回了 false

> 答案：B
> 解析：415 是请求体类型读不了；406 才是响应侧 Accept 协商失败。

### 5. Controller 抛出的异常，是在链路哪一环被转成响应的？（20分）

- A. HandlerMapping
- B. MultipartResolver
- C. HandlerExceptionResolver（`@RestControllerAdvice` 在此生效）
- D. ViewResolver 之后

> 答案：C
> 解析：异常由 HandlerExceptionResolver 链处理，`@RestControllerAdvice` 的 `@ExceptionHandler` 正落在此。
