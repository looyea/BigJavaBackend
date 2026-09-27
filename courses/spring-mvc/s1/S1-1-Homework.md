# 作业题 · 请求处理链路与映射机制

## 作业 1：映射优先级实证（必做）

在同一个 Controller 注册下列组合，逐一请求并记录命中：

- `/api/orders/{id}` 与 `/api/orders/count`
- `/api/**` 与 `/api/users/{id}`
- 两个仅 `produces` 不同的 `/api/info`

**产出**：一张"哪个模式赢 + 为什么"的排序表，验证 specificity 规则。

## 作业 2：拆解 ambiguous mapping（必做，本节核心）

故意写两个 method+path+params+headers+produces 全同的映射复现启动异常，然后分别用四种手段消歧并验证：① 加 `method` 区分；② 加 `params="v=1"`；③ 加 header 版本；④ 改路径。写清每种对 REST 语义的影响。

## 作业 3：拦截器链顺序与中断实验（必做）

写三个 `HandlerInterceptor`（A/B/C），每个 pre/post/after 打点：

1. 默认注册顺序执行正常请求，记录完整调用序列
2. 让 B 的 preHandle 返回 false，观察 A 执行、B 之后中断、A 的 afterCompletion 是否触发
3. 用两个 `WebMvcConfigurer` 分别注册并加 `@Order`，验证跨 configurer 的相对顺序可控

## 作业 4：轻量版本路由设计（选做，架构师向）

不引入 Spring HATEOAS/URI 版本，用 `params` 或 `headers` 的 specificity 设计一套"同一 URL、按 `X-API-VERSION` 头路由到不同实现"的电商开放接口，说明相比 URI 版本化的优劣与灰度用法。

## 作业 5：匹配器性能对比（选做，架构师向）

构造含上千映射的应用，分别在 `AntPathMatcher` 与 `PathPatternParser` 下测：启动注册耗时、单次匹配 P99（用微基准）。解释 PathPattern 为何在高并发/多映射下更优，以及 `**` 使用限制的由来。
