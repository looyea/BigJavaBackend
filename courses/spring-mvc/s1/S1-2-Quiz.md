# 小测验 · 参数解析与返回值处理

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. `@RequestBody` 把 JSON 反序列化成对象，依赖的是哪个组件？（20分）

- A. `HandlerMapping`
- B. `HttpMessageConverter`（如 Jackson 的 `MappingJackson2HttpMessageConverter`）
- C. `ViewResolver`
- D. `LocaleResolver`

> 答案：B
> 解析：`RequestResponseBodyMethodProcessor` 委托 `HttpMessageConverter` 完成读/写序列化。

### 2. `@RequestBody` 收到请求体但找不到能 `canRead` 该类型的转换器，返回？（20分）

- A. 404
- B. 406
- C. 415 Unsupported Media Type
- D. 500

> 答案：C
> 解析：请求侧读不了 → 415；响应侧写不出（Accept 无匹配）才是 406。

### 3.（多选）要把方法返回值统一包成 `{code,data,traceId}`，关于 `ResponseBodyAdvice` 说法正确的有？（25分）

- A. 在序列化前通过 `beforeBodyWrite` 包装返回值
- B. 需与 `@RestControllerAdvice` 类配合生效
- C. 应加白名单跳过 `byte[]`/`/actuator`/OpenAPI 等非业务 JSON 响应
- D. 它能拦截并修改任意 `HttpServletRequest` 头

> 答案：ABC
> 解析：D 错，它处理的是响应 body 包装，不改请求头；ABC 是其正确用法与注意事项。

### 4. 入参 `@RequestParam LocalDate date` 能自动从字符串转换，靠的是？（15分）

- A. Jackson
- B. `ConversionService`/`Formatter`（配合 `@DateTimeFormat`）
- C. MessageConverter
- D. 反射直接赋值

> 答案：B
> 解析：类型/格式转换由 WebDataBinder 的 ConversionService/Formatter 完成，而非消息转换器。

### 5. 判断题：返回 `ResponseEntity<T>` 时，body 的序列化仍由合适的 `HttpMessageConverter` 完成。（20分）

- A. 正确
- B. 错误

> 答案：A
> 解析：`HttpEntityMethodProcessor` 处理头/状态，body 依旧走 MessageConverter 写。
