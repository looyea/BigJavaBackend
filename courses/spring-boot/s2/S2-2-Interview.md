# 实际面试题 · Spring MVC 请求处理全链路（Boot 视角）

## 题 1：描述一个 HTTP 请求在 Spring MVC 中的完整处理流程

**考察层次**：初级只会背"DispatcherServlet→Controller→View"；中级能说出九大组件；高级能把每一步和真实线上问题、和 Boot 自动装配对应起来。

**参考答法（3 分钟内）**：

1. 请求先过 Servlet Filter 链（编码、鉴权、CORS 常在这层）。
2. 进入 `DispatcherServlet.doDispatch`：`HandlerMapping` 根据 URL/请求头匹配出 `HandlerMethod` 及其拦截器链。
3. 选到合适的 `HandlerAdapter`，执行 `Interceptor.preHandle`。
4. 适配器内部：`ArgumentResolver` 解析参数 →（`@RequestBody` 走 `HttpMessageConverter` 反序列化）→ 反射调用 Controller → `ReturnValueHandler` 处理返回值（REST 下由 MessageConverter 序列化写响应体，MVC 下返回视图名）。
5. 若抛异常，`HandlerExceptionResolver`（`@RestControllerAdvice` 在此）转成响应。
6. 执行 `Interceptor.afterCompletion`，写回响应。

**追问**：Boot 环境下这些组件从哪来？→ `WebMvcAutoConfiguration` 通过 `@ConditionalOnMissingBean` 提供默认 Bean，用户声明同类型 Bean 即覆盖；加 `@EnableWebMvc` 会关闭这套自动配置。

## 题 2：Filter 和 Interceptor 到底怎么选？

**答题要点**：

- 层次：Filter 属 Servlet 容器，Interceptor 属 Spring MVC。
- 时机与信息：Filter 在 `DispatcherServlet` 之前，拿不到 HandlerMethod；Interceptor 能拿到、还能拿到 Controller 返回值/异常。
- 生命周期：Filter 由容器管，Interceptor 由 Spring 管，能注入 Bean。
- 选择经验：跨框架、纯请求/响应处理（编码、日志 traceId、鉴权前置）用 Filter；需要 Handler 上下文（权限注解校验、接口耗时归因、返回值后处理）用 Interceptor。

**加分**：AOP 是第三种选择——针对方法级横切（事务、缓存），作用在 Bean 方法上而非 HTTP 链路。

## 题 3：线上接口偶发 406，另一批报 415，分别怎么排查？

**结构化回答**：

1. 先分清方向：406 是**响应**内容协商失败（客户端 `Accept` 服务端满足不了）；415 是**请求**体类型服务端读不了（`Content-Type` 与转换器不匹配）。
2. 406 排查：看 `ContentNegotiatingViewResolver`/`HttpMessageConverter` 的 `supportedMediaTypes`；是否误配了后缀协商或 `Accept` 被网关改写。
3. 415 排查：抓包看真实 `Content-Type`；`@RequestBody` 需要的转换器是否在 classpath（如缺 Jackson 或缺 XML 模块）。
4. 根因治理：统一 API 契约里对 `Content-Type`/`Accept` 的约束，网关侧不要静默改写头部。

## 题 4：为什么团队规范禁止在 Boot 项目里写 `@EnableWebMvc`？

**答题要点**：`@EnableWebMvc` 等价于 `@Import(WebMvcConfigurationSupport.class)`，Boot 的 MVC 自动配置以 `@ConditionalOnMissingBean(WebMvcConfigurationSupport)` 为条件，一旦你引入它就整体退让，导致 `WebMvcProperties`、默认转换器、静态资源、错误页等约定全部失效。正确姿势是实现 `WebMvcConfigurer` 做增量定制。

**追问**：那我确实想完全接管 MVC 呢？→ 可以，但要清楚你放弃了 Boot 约定，需自行承担全部配置——这属于架构决策，要评审。

## 高频追问速答

1. 一次请求会 new 几个 DispatcherServlet？→ 每个 `DispatcherServlet` 是单例，多 Servlet 才会多个（Boot 默认一个主 Servlet）。
2. `@RequestMapping` 匹配冲突怎么定优先级？→ 更具体（路径变量少、字面量多）优先；同级看 `@Order`/注册顺序，需避免歧义。
3. 拦截器能拿到响应体做修改吗？→ 默认不能直接改已序列化 body，需包装 `ContentCachingResponseWrapper` 或用 `ResponseBodyAdvice`。
4. 参数解析和消息转换什么关系？→ `@RequestBody` 的解析器 `RequestResponseBodyMethodProcessor` 内部委托 `HttpMessageConverter` 完成反序列化。
5. `afterCompletion` 一定执行吗？→ 只要 `preHandle` 至少有一个返回过 true，就按逆序执行；`preHandle` 全 false 则不进入。
