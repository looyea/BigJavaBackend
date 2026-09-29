# 请求处理链路与映射机制

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：吃透 `HandlerMapping` 如何把一个 URL 精确匹配到唯一 `HandlerMethod`，包括路径模式比较器（AntPathMatcher / PathPattern）的排序规则；理解拦截器与 `HandlerAdapter` 的分工；能解释"两个映射都匹配时谁赢"。
> 与 spring-boot 包 S2-2 的分工：Boot 篇讲"九大组件如何被自动装配、请求主干九步"；本节深挖**映射匹配算法本身**——这是 MVC 最容易被忽略却天天踩的内核。

## 一、映射的数据结构：注册期建索引

`@RequestMapping` 在容器启动时由 `RequestMappingHandlerMapping` 解析，每个方法生成一个 `RequestMappingInfo`（含路径、method、params、headers、consumes、produces 条件）存入 `mappingRegistry`。它不是线性扫全表，而是**按维度建索引**：

```flow
URL+method → 先按 path 匹配候选 → 再按 params/headers/consumes/produces 细化 → 用 comparator 排序取最优
```

匹配是"多条件求交 + 排序取第一"，理解排序规则才能解释冲突。

## 二、路径模式与比较器：Spring 5.3+ 默认 PathPattern

两代匹配器：

- **`AntPathMatcher`（老）**：`?`、`*`（单层）、`**`（多层）通配，字符串递归匹配。
- **`PathPatternParser`（Spring 5.3+ / Boot 默认）**：把模式**预编译成 `PathSegment` 树**，匹配更快、更省内存，尤其对大量映射和高并发。`spring.mvc.pathmatch.matching-strategy=path-pattern-parser`（已是默认）。

**排序规则（决定谁赢，面试与实操双高频）**，越"具体"越优先：

1. 字面路径 > 带 `{变量}` 的路径 > 带 `*` 单通配 > 带 `**` 多通配。
2. 捕获变量段之间：普通 `{var}` > `{var:regex}` 视具体规则；段数多者优先。
3. 完全相同的两个映射 → 启动即抛 `IllegalStateException`（ambiguous mapping）。

## 三、不止看路径：RequestMappingInfo 的全维度比较

匹配排序按**各条件的 specificity 逐一比较**（顺序通常：路径 → 方法 → params → headers → consumes → produces）。这解释了实战中的路由：

- 同一 `/orders`，`produces=text/plain` 与 `produces=application/json` 两个方法可共存，按 `Accept` 选择。
- 用 `params="version=2"` 或 headers 做**轻量 API 版本路由**，靠的就是 params/headers 条件的 specificity 参与排序。

## 四、HandlerAdapter：把"调用 Handler"标准化

匹配到 `HandlerMethod` 后，`DispatcherServlet` 不直接反射，而是找对应的 `HandlerAdapter`：

- `RequestMappingHandlerAdapter`：处理 `@RequestMapping` 方法——内部串起参数解析、`@InitBinder`、`@ModelAttribute`、调用、返回值处理（下节 s1-2 详解）。
- `HandlerFunctionAdapter`：函数式端点（WebFlux/routerDSL）。
- `SimpleControllerHandlerAdapter`：实现 `Controller` 接口的老式 Handler。

**为什么要 Adapter**：MVC 支持多种 Handler 形态（注解方法、函数式、接口），用适配器模式把"如何调用"隔离，`DispatcherServlet` 只面向统一接口。

## 五、拦截器链的顺序语义

`getHandler` 返回的是 `HandlerExecutionChain`（Handler + 拦截器数组）。执行：

- `preHandle`：**按注册顺序**正序；任一返回 false 立即中断（且已执行过的拦截器的 `afterCompletion` 会逆序回调）。
- `postHandle`：Handler 正常返回后**逆序**（现在用得少，且对 `@ResponseBody` 时机有坑——body 已写出）。
- `afterCompletion`：整个请求结束（含异常）**逆序**，一定执行，是清理 ThreadLocal/记录耗时的地方。

> 顺序坑：多个 `WebMvcConfigurer` 各自 `addInterceptors` 时，最终顺序取决于 configurer 的 `@Order`；跨 configurer 想精确控序要显式排序。

## 六、例子：映射优先级与歧义冲突（正确用法与错误用法）

```java
// 例子目的：用多个 @GetMapping 展示"越具体越优先"的排序规则与歧义冲突
@RestController
@RequestMapping("/orders")
class OrderController {
    @GetMapping("/latest")                 // 字面路径，specificity 最高
    public String latest() { return "latest"; }
    @GetMapping("/{id}")                    // 带变量，次于字面
    public String byId(@PathVariable String id) { return "id:" + id; }
    @GetMapping(value = "/x", produces = "application/json")  // 同路径不同 produces 可共存，按 Accept 选择
    public String json() { return "{}"; }
    // 正确使用结果：GET /orders/latest 命中 latest()（字面赢变量）；GET /orders/123 命中 byId 返回 id:123
    // 错误用法：再加一个 @GetMapping("/{id}") 放到另一个方法上（与上面完全等价）→ 启动抛 IllegalStateException: ambiguous mapping
    // 错误用法：PathPattern 下写 @GetMapping("/**/foo") → 报 Pattern 编译错误（PathPattern 要求 ** 只能在末尾）
}
```

## 七、动手验证

1. 注册 `/orders/{id}` 与 `/orders/latest` 访问 `/orders/latest`，验证字面量优先于变量匹配。
2. 造两个 `produces` 不同的同路径方法，用不同 `Accept` 头触发，验证 produces 参与路由。
3. 写两个拦截器打印 pre/post/after，让第一个 preHandle 返回 false，观察第二个 preHandle 不执行、但第一个 afterCompletion 是否被调，验证中断语义。
4. 打开 PathPattern 与 AntPathMatcher 两种 `matching-strategy`，对同一批映射观察启动日志与匹配行为差异。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 启动 `ambiguous mapping` | 两个 RequestMappingInfo 完全等价，无排序区分 |
| 预期命中的接口没命中 | 更"具体"的另一映射抢了（变量被字面/正则覆盖判断错） |
| `**` 在 PathPattern 下报错 | PathPattern 要求 `**` 只能在模式末尾 |
| postHandle 改响应体无效 | `@ResponseBody` 已写出，应改 `ResponseBodyAdvice` |
| 拦截器 ThreadLocal 没清 | 只在 preHandle 加、忘了 afterCompletion 清 |

## 八、关联技术栈

- **匹配内核**：`RequestMappingInfo`、`PathPatternParser`、`AntPathMatcher`、比较器
- **组件**：`RequestMappingHandlerMapping`、`RequestMappingHandlerAdapter`、`HandlerExecutionChain`
- **参数/返回**：见 s1-2；Boot 装配视角见 spring-boot S2-2
- **响应式映射**：`RouterFunction`（WebFlux，见 s2-2）
