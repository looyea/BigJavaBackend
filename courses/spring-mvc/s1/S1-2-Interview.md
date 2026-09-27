# 实际面试题 · 参数解析与返回值处理

## 题 1：Controller 方法的一堆参数（@PathVariable/@RequestParam/@RequestBody）是怎么被填进去的？

**考察层次**：初级只知注解作用；中级能说出 ArgumentResolver 机制；高级能讲类型转换与校验的接力。

**参考答法**：

1. `RequestMappingHandlerAdapter` 调用方法前，对每个形参遍历一组 `HandlerMethodArgumentResolver`，谁的 `supportsParameter` 返回 true 谁来 `resolveArgument`。
2. `@PathVariable` 从 URI 模板取、`@RequestParam` 从 query/form 取、`@RequestBody` 交给 `RequestResponseBodyMethodProcessor` → 用 `HttpMessageConverter` 反序列化请求体。
3. 拿到的原始值需要转型（String→日期/枚举/自定义类型）时走 `ConversionService`/`Formatter`；若标了 `@Valid` 触发 JSR-380 校验，失败抛 `MethodArgumentNotValidException`（body）或 `BindException`（表单）。

**追问**：想支持一个自定义类型自动绑定怎么做？→ 写 `Converter` 注册进 ConversionService，或写专用 ArgumentResolver。

## 题 2：@RequestBody 和 @ModelAttribute 有什么区别？

**答题要点**：

- `@RequestBody`：整个 HTTP body 按 `Content-Type` 用 MessageConverter 反序列化成对象（典型 JSON）。
- `@ModelAttribute`：把多个请求参数（query/form）按字段名绑定到对象，走的是数据绑定 + 类型转换，不读 JSON body。
- 校验失败异常不同：前者 `MethodArgumentNotValidException`，后者 `BindException`——全局异常处理要分别对待才能给出正确 400 结构。

## 题 3：接口返回 406，请求参数没问题，可能哪出的错？

**结构化回答**：

1. 406 发生在**写响应**阶段：内容协商出的 mediaType 没有 `canWrite` 的 MessageConverter。
2. 排查：客户端 `Accept` 是否被限制成服务端不支持的类型；返回的自定义类型是否有对应转换器；是否缺 Jackson 模块。
3. 与 415 区分：415 是读请求体时找不到转换器（Content-Type 问题），406 是写响应时找不到（Accept 问题）。
4. 治理：统一 API 契约的 Content-Type/Accept，网关别乱改头。

## 题 4：全公司要求统一响应体，你怎么设计才既省心又不误伤？

**答题要点**：用 `ResponseBodyAdvice.beforeBodyWrite` 做横切包装，`supports()` 精确限定作用范围（包/注解），必须排除：二进制/`Resource` 下载、`/actuator`、OpenAPI swagger json、以及已由异常处理产生的标准错误体（避免二次包装）。traceId 从 MDC 注入。强调"业务方法返回纯数据、包装下沉框架层"，但要有明确白名单，否则下载接口被包成 JSON 是经典事故。

## 高频追问速答

1. `@RequestParam List<Long> ids` 传 `ids=1,2,3` 能自动拆吗？→ 能，ConversionService 把逗号串转 List；或多次 `ids=1&ids=2`。
2. 返回 `String` 有时会当视图名、有时会直接写 body，区别？→ 有无 `@ResponseBody`/`@RestController`；无则当视图名交 ViewResolver。
3. 文件下载用哪个返回值？→ `ResponseEntity<Resource>`/`Resource`，由 `ResourceHttpMessageConverter` 写，别被统一包装拦住。
4. Jackson 未知字段报错怎么控制？→ `DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES`（Boot 默认关），按需全局或字段级 `@JsonIgnoreProperties`。
5. ArgumentResolver 与 MessageConverter 谁调用谁？→ Resolver（如 RequestBody 的）内部委托 MessageConverter 完成反序列化，两层职责不同。
