# Spring MVC 请求处理全链路（Boot 视角）

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：能画出一个 HTTP 请求从进入 `DispatcherServlet` 到返回响应的完整链路；说得清 Boot 自动装配的九大组件各自职责与扩展点；能定位"404/406/415/参数绑定不上"这类问题落在链路的哪一环。
> 与 spring-mvc 包的分工：本包讲 **Boot 如何把 MVC 装配起来、如何在自动配置之上做工程集成**；框架内核（映射算法、参数解析器源码细节）在「Spring MVC 深入」包深挖，此处不重复。

## 一、一条请求的主干：`doDispatch` 的九步

Boot 启动时把 `DispatcherServlet` 注册为处理所有请求的前置控制器（Front Controller）。它的 `doDispatch()` 就是整条链路的心脏：

```flow
HTTP 请求 → Filter 链 → DispatcherServlet.doDispatch
→ getHandler()（HandlerMapping 匹配 HandlerMethod + 拦截器链）
→ getHandlerAdapter()（选对 Adapter）
→ applyPreHandle（Interceptor.preHandle）
→ HandlerAdapter.handle()：参数解析 → 调用 Controller → 返回值处理（视图/消息转换）
→ processDispatchResult（异常解析 / 视图渲染）→ applyPostHandle（Interceptor.afterCompletion）
→ 写回响应
```

- **Filter 与 Interceptor 的区别**是高频考点：Filter 是 Servlet 规范、在 `DispatcherServlet` 之前、拿不到 Handler 信息；Interceptor 是 Spring 的、能拿到 `HandlerMethod`，且分 `preHandle/postHandle/afterCompletion` 三段，只有 `preHandle` 返回 true 后续才执行。
- **异常在哪处理**：Controller 抛出的异常先被 `HandlerExceptionResolver` 捕获，解析成 `ModelAndView` 或（REST 下）直接写响应体——这就是 `@RestControllerAdvice` 生效的位置。

## 二、九大组件与 Boot 的自动装配

`DispatcherServlet` 初始化时从容器按类型加载一组策略 Bean（`initStrategies()`）。Boot 的 `WebMvcAutoConfiguration` + `EnableWebMvcConfiguration` 已为它们提供了默认实现：

| 组件 | 默认实现 | 职责 | 常见扩展点 |
| --- | --- | --- | --- |
| HandlerMapping | `RequestMappingHandlerMapping` | URL→Handler 匹配 | 加自定义 `HandlerMapping` 做动态路由 |
| HandlerAdapter | `RequestMappingHandlerAdapter` | 适配并调用 Handler | 定制参数解析器/返回值处理器 |
| HandlerExceptionResolver | `ExceptionHandlerExceptionResolver` 等链 | 异常→响应 | `@ControllerAdvice` |
| ViewResolver | `ContentNegotiatingViewResolver` | 逻辑视图→物理视图 | `@Configuration` 里加 `ViewResolver` |
| MessageConverters | `MappingJackson2HttpMessageConverter` 等 | 请求/响应体序列化 | 换 ObjectMapper、加 XML/Protobuf |
| MultipartResolver | `StandardServletMultipartResolver` | 文件上传 | 大小限制配置 |
| ThemeResolver / LocaleResolver / RequestToViewNameTranslator | 默认 | 主题/国际化/视图名 | `LocaleResolver` 配合 i18n |

**关键认知**：在 Boot 里这些不是 XML 配的，而是 `@ConditionalOnMissingBean` 提供的默认 Bean——你想要差异化，就自己声明同类型 Bean 覆盖，而不是去改框架。这是"约定优于配置"在 Web 层的落地。

## 三、内容协商：406 与 415 的根源

- **406 Not Acceptable**：客户端 `Accept` 头声明的媒体类型，服务端没有匹配的 `HttpMessageConverter` 能产出。排查方向：`ContentNegotiatingViewResolver` / 转换器的 `supportedMediaTypes`。
- **415 Unsupported Media Type**：请求 `Content-Type` 与某个参数解析器（`@RequestBody` 依赖的转换器）支持的类型不符。常见于 `Content-Type` 写成 `text/plain` 却发 JSON body。
- Boot 里给 Jackson 加 `MappingJackson2HttpMessageConverter` 的自定义定制，用 `Jackson2ObjectMapperBuilderCustomizer`，别自己去 `extendMessageConverters` 里 hard-remove，容易误伤默认转换器。

## 四、把链路接进工程：Boot 提供的三块粘合

1. **内嵌容器**：`spring-boot-starter-web` 默认 Tomcat；换 Undertow/Jetty 是排除 + 引入对应 starter，链路本身不变，变的只是 `ServerHttpRequest` 的实现。
2. **`WebMvcConfigurer`**：Boot 推荐的定制入口——加拦截器（`addInterceptors`）、CORS（`addCorsMappings`）、格式化器、视图控制器，都是往这个接口上挂，**不要用 `@EnableWebMvc`**（它会关掉 Boot 的 MVC 自动配置）。
3. **错误页/错误属性**：非 MVC 直接异常由 `ErrorMvcAutoConfiguration` 兜底（`/error` → `BasicErrorController`），这就是默认"白页 500"或 JSON 错误体的来源。

## 五、例子：用 WebMvcConfigurer 注册拦截器（正确用法与错误用法）

```java
// 例子目的：展示 Boot 推荐的 MVC 定制入口——往 WebMvcConfigurer 挂拦截器，不破坏自动配置
import org.springframework.web.servlet.*; import org.springframework.web.servlet.config.annotation.*;
@Component
class TimingInterceptor implements HandlerInterceptor {
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        req.setAttribute("t0", System.nanoTime());   // 拿到 HandlerMethod，可做鉴权/埋点
        return true;                                 // 正确用法：返回 true 才继续进 Controller
    }
    public void afterCompletion(HttpServletRequest req, HttpServletResponse res, Object h, Exception ex) {
        long cost = System.nanoTime() - (long) req.getAttribute("t0"); // 无论成败都回调，适合清理/计时
    }
}
@Configuration
class WebConfig implements WebMvcConfigurer {        // 正确用法：实现 WebMvcConfigurer，Boot 默认 MVC 配置仍生效
    public void addInterceptors(InterceptorRegistry reg) {
        reg.addInterceptor(new TimingInterceptor()).addPathPatterns("/**"); // 通过它注册才生效
    }
}
// 错误用法：preHandle 返回 false → Controller 不被调用（用于拦截未登录），但 afterCompletion 仍会执行
// 错误用法：不用 WebMvcConfigurer 而手动 new Interceptor 不注册→ 拦截器根本不生效
// 错误用法：在配置类上加 @EnableWebMvc → 关掉 Boot 的 WebMvcAutoConfiguration，默认 HttpMessageConverter/静态资源映射全失效（常见事故）
```

## 六、动手验证

1. 在 `RequestMappingHandlerMapping.getHandler()` 打断点，用一个带路径变量的 `GET /orders/{id}` 走完一次请求，观察 `HandlerExecutionChain` 里 HandlerMethod 与拦截器列表。
2. 故意给 `@RequestBody` 接口发 `Content-Type: text/plain` 的 JSON，复现 415；改回 `application/json` 消除，理解 `HttpMessageConverter.canRead` 的作用。
3. 写一个 `WebMvcConfigurer` 注册打印耗时拦截器，验证 `preHandle` 返回 false 时 Controller 不被调用、`afterCompletion` 仍执行。

## 七、常见线上问题

| 现象 | 根因定位到链路哪一环 |
| --- | --- |
| 加了 `@EnableWebMvc` 后自动配置全失效 | 你显式接管了 MVC 配置，Boot 默认 Bean 不再提供 |
| 拦截器没生效 | 没通过 `WebMvcConfigurer` 注册，或路径 pattern 没匹配上 |
| 返回 Date 字段时区不对 | 消息转换器用的 ObjectMapper 序列化配置，与 MVC 无关但常被误判 |
| 大文件上传 413 | `MultipartResolver` 与容器两层的大小限制 |
| 同一 URL 两个 Controller 偶发命中 | `HandlerMapping` 的 order 冲突 |

## 八、关联技术栈

- **框架层**：Servlet 规范（Filter/HttpServletRequest）、Spring Framework Web MVC 内核
- **Boot 层**：`WebMvcAutoConfiguration`、`ErrorMvcAutoConfiguration`、内嵌容器 starter
- **序列化层**：Jackson、内容协商、`HttpMessageConverter`
- **可观测层**：拦截器埋点、Micrometer WebMetrics（见 s2-3）
- **安全层**：Spring Security 的 Filter 链在 `DispatcherServlet` 之前，与本链路串联
