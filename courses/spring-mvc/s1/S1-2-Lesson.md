# 参数解析与返回值处理

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：讲清 `HandlerMethodArgumentResolver` 如何把 HTTP 世界的数据变成方法形参、`HandlerMethodReturnValueHandler` 如何把返回值写回响应；理解 `@RequestBody`/`@ResponseBody` 背后 `HttpMessageConverter` 的两段式工作；能定制类型转换与全局响应包装。

## 一、入参：RequestResponseBodyMethodProcessor 之前的分工

调用 Controller 前，`RequestMappingHandlerAdapter` 对**每个方法形参**问一遍"谁能解析它"——每个解析器声明 `supportsParameter` 与 `resolveArgument`。常见内置解析器与对应注解：

| 形参写法 | 解析器 | 数据来源 |
| --- | --- | --- |
| `@PathVariable` | `PathVariableMethodArgumentResolver` | URI 模板变量 |
| `@RequestParam` | `RequestParamMethodArgumentResolver` | query/form 参数 |
| `@RequestBody` | `RequestResponseBodyMethodProcessor` | 请求体（走 MessageConverter 反序列化） |
| `@RequestHeader` | `RequestHeaderMethodArgumentResolver` | 请求头 |
| `@ModelAttribute` | `ModelAttributeMethodProcessor` | 表单/查询参数绑定到对象 |
| `HttpServletRequest` 等 | `ServletRequestMethodArgumentResolver` | 容器原生对象直接给 |

**执行链**：解析出的值若要做类型/格式转换（如 `String`→`LocalDate`、`"1,2,3"`→`List<Long>`），交给 `WebDataBinder` + `ConversionService`/`Formatter`。这就是为什么加了 `@DateTimeFormat` 或自定义 `Converter` 后入参能自动转型。

## 二、`@RequestBody` 的两段式：先选转换器再反序列化

```flow
读 Content-Type → 在配置的 HttpMessageConverter 列表里找 canRead(type, mediaType) 的第一个
→ 该 converter 用 InputStream 反序列化为目标对象 → （若配 @Valid）触发校验
```

- Jackson 的 `MappingJackson2HttpMessageConverter` 处理 `application/json`。找不到匹配的读转换器 → **415**（呼应 spring-boot S2-2 内容协商）。
- 泛型集合坑：`List<Order>` 直接接没问题，但要正确拿到泛型元素类型依赖 `MethodParameter`；历史上用 `@RequestBody Map<String,Object>` 再手动转是规避手段。

## 三、返回值：ReturnValueHandler 与 `@ResponseBody`

方法返回后，按返回类型选 `HandlerMethodReturnValueHandler`：

- `@ResponseBody` / `@RestController` → `RequestResponseBodyMethodProcessor`：找 `canWrite(type, 协商后的 mediaType)` 的 MessageConverter 序列化写响应体。找不到 → **406**。
- 返回 `String`（无 `@ResponseBody`）→ `ViewNameMethodReturnValueHandler`，当视图名。
- 返回 `View`/`ModelAndView` → 对应 handler 走视图渲染。
- 返回 `ResponseEntity<T>` → `HttpEntityMethodProcessor`，可完全掌控状态码/头/body。

**内容协商**：写哪个 converter 由 `ContentNegotiationManager` 依据 `Accept`、路径后缀、参数等决出 mediaType，再挑 converter。

## 四、统一返回包装与全局响应增强

电商/金融接口常要求所有响应包成 `{code, success, data, traceId}`。两种做法：

1. Controller 手动返回 `Result<T>` —— 侵入、啰嗦。
2. **`ResponseBodyAdvice`（推荐）**：实现 `beforeBodyWrite`，在序列化前把任意返回值统一包装；配合 `@RestControllerAdvice` 只作用于指定包/注解。这样业务方法只管返回"纯数据"，包装在框架层横切完成。

> 坑：`ResponseBodyAdvice` 会拦到错误响应、`/actuator`、文件下载/`byte[]`、OpenAPI 的 swagger json——要按 converter 类型/返回类型加白名单跳过，否则把二进制也包成 JSON。

## 五、例子：@RequestBody 校验与统一响应包装（正确用法与错误用法）

```java
// 例子目的：串联入参校验与 ResponseBodyAdvice 全局包装，并暴露精度/误伤陷阱
import org.springframework.web.bind.annotation.*; import org.springframework.core.MethodParameter;
@RestController
class OrderApi {
    @PostMapping("/orders")
    public Order create(@RequestBody @Valid OrderDto dto) { // @RequestBody 走 MessageConverter 反序列化，@Valid 触发校验
        return orderService.save(dto);                      // 正确用法：只返回"纯数据"，包装交给框架
    }
    // 错误用法：submit 非法体（name=null 违反 @NotNull）→ 抛 MethodArgumentNotValidException → 400（无全局处理则返回默认错误体）
    // 错误用法：前端 Content-Type 写成 text/plain 却发 JSON → 无 canRead 的转换器 → 415
}
@RestControllerAdvice
class WrapAdvice implements ResponseBodyAdvice<Object> {
    public boolean supports(MethodParameter ret, Class conv) { return true; }
    public Object beforeBodyWrite(Object body, MethodParameter ret, MediaType type, Class conv, ServerHttpRequest rq, ServerHttpResponse rs) {
        if (body instanceof Result || body instanceof byte[]) return body; // 正确用法：跳过已包装体与二进制下载，避免误伤
        return Result.ok(body).withTraceId(MDC.get("traceId"));            // 统一包装为 {code,success,data,traceId}
    }
    // 错误用法：不加白名单→ 把 swagger json、actuator、byte[] 下载也包成 JSON → 接口损坏/文件乱码
}
// 错误用法：DTO 里 Long 雪花 id 直接返回→ 前端 JS Number 精度丢失（应在 Jackson 层把 Long 序列化为 String）
```

## 六、动手验证

1. 写一个 `Converter<String, Money>`，注册进 `ConversionService`，让 `@RequestParam Money price` 能自动把 `"12.50"` 转成 `Money`。
2. `@RequestBody @Valid OrderDto` 里字段加 `@NotNull`，提交非法体复现 400 + 绑定错误，观察是 `MethodArgumentNotValidException`（`@RequestBody`）还是 `BindException`（`@ModelAttribute`）——两者对应不同异常处理（见 s2-1）。
3. 实现一个 `ResponseBodyAdvice` 给所有 JSON 响应加 `traceId`，并验证它不误伤 `byte[]` 下载接口。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 大 JSON 入参字段丢失/为 null | DTO 字段无 setter/非 public、或 Jackson `FAIL_ON_UNKNOWN` 配置 |
| `LocalDateTime` 反序列化格式对不上 | 未配 `@JsonFormat`/全局 ObjectMapper 时间模块 |
| Long 精度在前端丢失 | 未在 MessageConverter 层把 Long 序列化成 String |
| 文件下载被统一包装成 JSON | ResponseBodyAdvice 没跳过非 JSON converter |
| 表单参数绑不进对象 | 缺 `@ModelAttribute` 语义/字段名不匹配/无默认构造 |

## 八、关联技术栈

- **入参**：`HandlerMethodArgumentResolver`、`WebDataBinder`、`ConversionService`/`Formatter`
- **序列化**：`HttpMessageConverter`、Jackson `ObjectMapper`、`MappingJackson2HttpMessageConverter`
- **出参**：`HandlerMethodReturnValueHandler`、`ResponseBodyAdvice`、`ContentNegotiationManager`
- **校验**：JSR-380 `@Valid`、`MethodArgumentNotValidException`（见 s2-1 全局异常）
- **Boot 装配**：`Jackson2ObjectMapperBuilderCustomizer`（spring-boot S2-2）
