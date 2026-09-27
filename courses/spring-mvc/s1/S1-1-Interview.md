# 实际面试题 · 请求处理链路与映射机制

## 题 1：一个 URL 是怎么被匹配到具体 Controller 方法的？

**考察层次**：初级答"按 @RequestMapping 找"；中级能讲 RequestMappingInfo 多条件与排序；高级能讲 PathPattern 与冲突消解。

**参考答法**：

1. 启动期 `RequestMappingHandlerMapping` 把每个 `@RequestMapping` 解析成 `RequestMappingInfo`（path/method/params/headers/consumes/produces）建索引。
2. 请求来时先按路径找候选，再用其它条件求交，最后用一系列 comparator 按 specificity 排序，取第一个作为 `HandlerMethod`，包进 `HandlerExecutionChain`（含拦截器）。
3. 匹配器 Spring 5.3+ 默认 PathPatternParser（预编译段树，更快），排序遵循"越具体越优先"。

**追问**：路径变量和字面量都匹配谁赢？→ 字面量优先（更具体）。

## 题 2：两个接口路径冲突会怎样？怎么排查？

**答题要点**：

- 完全等价（所有条件都一样）→ 启动即 `IllegalStateException: Ambiguous mapping`，直接暴露。
- 有条件可区分 → 按 specificity 选一个，可能"你以为命中 A 实际命中 B"，排查看 `RequestMappingHandlerMapping` 日志、或用 `/actuator/mappings`（Boot）列出全部映射。
- 消歧：用 method、params、headers、produces 或更精确路径区分。

## 题 3：HandlerMapping 和 HandlerAdapter 为什么要分开？

**答题要点**：职责分离——Mapping 负责"找到哪个 Handler"，Adapter 负责"怎么调用这个 Handler"。因为 Handler 有多种形态（注解方法、实现 `Controller` 接口、函数式 `HandlerFunction`），用适配器模式让 `DispatcherServlet` 不必知道具体如何反射/调用，新增 Handler 类型只需加 Adapter，符合开闭原则。

## 题 4：拦截器的三个方法都什么时候执行？postHandle 有什么坑？

**答题要点**：preHandle 正序（false 即中断，已执行的 afterCompletion 逆序回调）、postHandle 逆序（Handler 正常返回后、视图渲染前）、afterCompletion 逆序（含异常，整个请求末尾，必执行）。坑：对 `@ResponseBody`/REST，响应体在 Handler 内部已由 MessageConverter 写出，postHandle 再改 response body 已无意义——要改响应内容用 `ResponseBodyAdvice`，做收尾/清理放 afterCompletion。

## 高频追问速答

1. `**` 能放在路径中间吗？→ PathPattern 下 `**` 只能作为模式最后一段，中间用会报错。
2. 跨 HandlerMapping（如同时有 MVC 和自定义）怎么定序？→ 各 HandlerMapping 有 `order`，`getHandler` 按 order 逐个问，先返回非空者胜。
3. `@RequestMapping` 在类上和方法上怎么组合？→ 类上映射作为前缀，方法路径拼接在其后。
4. 请求 method 不匹配是 404 还是 405？→ 路径能匹配到但方法不行 → 405 Method Not Allowed；路径完全无匹配 → 404。
5. 想让某接口不被任何拦截器拦截怎么办？→ `addInterceptor(...).excludePathPatterns(...)`，或把它放到不经过该拦截器路径的空间。
