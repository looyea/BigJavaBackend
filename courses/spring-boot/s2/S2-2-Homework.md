# 作业题 · Spring MVC 请求处理全链路（Boot 视角）

## 作业 1：断点走查 doDispatch（必做）

在一个 Boot Web 工程的 `DispatcherServlet.doDispatch` 里，对以下几行分别打断点并记录当时的对象状态：

1. `MappedHandler handler = getHandler(...)` 之后
2. `HandlerAdapter adapter = getModelAndView(...)` 之前的适配器选择
3. `applyPreHandle` 拦截器链执行
4. `adapter.handle(...)` 进入参数解析与 Controller 调用
5. `processDispatchResult` 异常/视图处理

**产出**：手绘一张"请求生命周期时序图"，标注 Filter、Interceptor、Controller、ExceptionResolver、MessageConverter 各在什么时刻介入。

## 作业 2：复现并修复内容协商错误（必做）

写一个 `@PostMapping` 接收 `@RequestBody OrderDto` 的接口。

1. 用 `Content-Type: text/plain` 发送 JSON，复现 **415**，说明命中了 `HttpMessageConverter.canRead` 的哪个判断。
2. 给同一接口用浏览器发 `Accept: application/xml`，若服务端无 XML 转换器，复现 **406**。
3. 分别用正确请求头消除两个错误，并总结 406 与 415 的区分口诀。

## 作业 3：写一个链路埋点拦截器（必做，本节核心）

实现 `WebMvcConfigurer#addInterceptors`，注册一个 `HandlerInterceptor`：

- `preHandle` 记录 `startNanos` 并写入 request 属性
- `afterCompletion` 计算耗时，按 `HandlerMethod` 类名+方法名打印，超过阈值打 WARN
- 演示：让某接口 `preHandle` 返回 `false`，验证 Controller 未被调用、`afterCompletion` 仍执行

**验收标准**：日志形如 `GET /orders/{id} -> OrderController#get cost=12ms`；不注册时 Controller 正常、注册后不影响功能。

## 作业 4：@EnableWebMvc 破坏实验（必做，架构师向）

在能正常返回默认 JSON 错误体的工程上加 `@EnableWebMvc`，观察：

1. `application.yml` 里配置的 `server.error.*`、静态资源、消息转换器定制是否失效
2. 解释为什么失效（提示：`DelegatingWebMvcConfiguration` 与 Boot 自动配置的条件退让）
3. 移除注解改用 `WebMvcConfigurer` 定制，验证自动配置恢复

## 作业 5：异常解析链优先级分析（选做，架构师向）

同时配置 `@RestControllerAdvice`、`ErrorMvcAutoConfiguration` 兜底、以及一个自定义 `HandlerExceptionResolver`（设置不同 order），构造一个会抛异常的接口，判断最终响应由谁产出，写出 `HandlerExceptionResolver` 链按 order 依次尝试的规则，并给出"电商下单接口希望异常统一返回 {code,msg} 而非白页"的推荐配置。
