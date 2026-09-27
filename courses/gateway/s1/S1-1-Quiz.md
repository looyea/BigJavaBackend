# 网关三大件与全局过滤器 · 小测

### 1. Spring Cloud Gateway 的三大核心组件是？（6分）

- A. Server、Client、Proxy
- B. Route、Predicate、Filter
- C. Gateway、Router、Balancer
- D. Handler、Interceptor、Adapter

> 答案：B
> 解析：Route 定义路由规则，Predicate 判断是否匹配，Filter 处理请求/响应。

### 2. SCG 底层使用的网络框架是？（6分）

- A. Tomcat
- B. Undertow
- C. Netty（WebFlux）
- D. Jetty

> 答案：C
> 解析：SCG 基于 Spring WebFlux + Reactor Netty，全异步非阻塞。

### 3. GlobalFilter 与 GatewayFilter 的区别是？（6分）

- A. 无区别
- B. GlobalFilter 作用于所有路由，GatewayFilter 只作用于绑定的路由
- C. GlobalFilter 只能做鉴权
- D. GatewayFilter 不能修改 Header

> 答案：B
> 解析：GlobalFilter 注册为 Bean 即全局生效；GatewayFilter 配在具体 route.filters 下。

### 4. Ordered.getOrder() 值越小意味着？（6分）

- A. 越后执行
- B. 越先执行
- C. 优先级越低
- D. 随机

> 答案：B
> 解析：order 越小优先级越高，Pre 阶段越先执行。

### 5. lb:// 前缀的含义是？（6分）

- A. 静态 IP 直连
- B. 通过 LoadBalancerClient 从注册中心获取实例列表
- C. 本地缓存路由
- D. 日志级别

> 答案：B
> 解析：`lb://service-name` 触发 `LoadBalancerClientFilter`，从 Nacos/Eureka 获取健康实例。

### 6. StripPrefix=1 的效果是？（6分）

- A. 去掉最后一段路径
- B. 去掉路径第一段（如 /api/orders → /orders）
- C. 添加前缀
- D. 重写整个 URL

> 答案：B
> 解析：StripPrefix=N 去掉前 N 段路径；/api/orders/list StripPrefix=1 → /orders/list。

### 7. 鉴权 Filter 中 `return exchange.getResponse().setComplete()` 的作用是？（6分）

- A. 转发到后端
- B. 短路——直接返回响应不再继续过滤器链
- C. 记录日志
- D. 重试请求

> 答案：B
> 解析：不调用 chain.filter() 而是 setComplete() → 请求被拦截 → 未授权请求到不了后端。

### 8. 以下属于 SCG 内置 Predicate 的有（多选）？（9分）

- A. Path
- B. Weight
- C. After
- D. CircuitBreaker

> 答案：A、B、C
> 解析：D 是 Filter 不是 Predicate。

### 9. 关于 SCG 动态路由说法正确的是（多选）？（9分）

- A. 通过 RouteDefinitionWriter 可编程增删路由
- B. 可从配置中心监听变更实时刷新
- C. 修改路由必须重启网关
- D. 内置 Redis 消息总线通知多实例同步

> 答案：A、B
> 解析：C 错——动态路由核心就是热更新；D 非内置，需自行集成消息机制。

### 10. 简答题：写一个 SCG 全局过滤器实现"请求耗时统计"并解释执行链路。（40分）

- 要点1：实现 GlobalFilter + Ordered，order 设为最小确保最先进入
- 要点2：Pre 阶段：exchange.getAttributes().put("startTime", System.currentTimeMillis())
- 要点3：Post 阶段：在 chain.filter(exchange).then(Mono.fromRunnable(...)) 中计算耗时
- 要点4：将耗时写入响应 Header X-Response-Time 或上报 Micrometer Timer
- 要点5：说明为什么不能用 blocking（SCG 是 Reactive，阻塞会卡 Netty EventLoop）

> 答案：见要点
> 解析：响应式网关中统计耗时需在 Mono 链路 then 回调中完成。
