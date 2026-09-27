# 作业题 · 参数解析与返回值处理

## 作业 1：自定义类型转换器（必做）

实现一个 `Converter<String, Money>`（把 `"CNY 12.50"` 解析为 `Money`），注册进 MVC 的 `ConversionService`：

- 让 `@RequestParam Money amount` 与 `@ModelAttribute` 对象里的 `Money` 字段都能自动绑定
- 对比：改用一个 `Formatter<Money>` 实现同样效果，说明 Converter（按类型）与 Formatter（按展示/区域）的适用差异

## 作业 2：@RequestBody 全链路走查（必做，本节核心）

对 `@RequestBody @Valid OrderDto`：

1. 在 `RequestResponseBodyMethodProcessor.resolveArgument` 打断点，观察"选转换器 → 读流反序列化 → 触发校验"三步
2. 分别用错误 `Content-Type`（→415）、非法字段（→400 + `MethodArgumentNotValidException`）复现两类中断
3. 记录 `@ModelAttribute` 校验失败抛的是 `BindException`，与上者区分

**验收标准**：写清 415 / 400 各在链路哪一步、由哪个组件产生。

## 作业 3：统一返回包装（必做）

用 `ResponseBodyAdvice` 给所有业务 JSON 响应自动包成 `{code,success,data,traceId}`：

- `supports()` 限定只作用于你的 `@RestController` 包
- 跳过：`byte[]`/`Resource` 下载、`/actuator`、错误响应（由 advice 处理的）
- traceId 从 MDC 读取
- 验证下载接口不被破坏、错误响应结构一致

## 作业 4：Long 精度与时间格式（选做，架构师向）

金融/电商 ID 用雪花 Long，前端 JS 精度丢失。给出在 MessageConverter 层的统一治理：把 `Long`/`BigInteger` 序列化为 String（自定义 Jackson `SimpleModule`/`ObjectMapper` 定制），并统一 `LocalDateTime` 格式与时区，评估对既有接口契约的影响与灰度方式。

## 作业 5：自定义 ArgumentResolver（选做，架构师向）

实现一个 `@CurrentUser` 注解 + 对应 `HandlerMethodArgumentResolver`，把网关注入的用户上下文自动解析成方法形参 `UserPrincipal`。说明它如何注册进 `RequestMappingHandlerAdapter` 的解析器列表、与内置解析器的先后顺序关系。
