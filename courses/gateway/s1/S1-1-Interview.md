# 网关三大件与全局过滤器 · 面试题

## 题 1：SCG 为什么选 WebFlux 而不是 MVC？

- 网关是 IO 密集型：大量转发等待后端响应。
- WebFlux + Netty：少量 EventLoop 线程处理上万并发连接（非阻塞）。
- MVC + Tomcat：每请求占一个线程 → 高并发下线程爆炸。
- 结论：网关场景天然适合响应式，不需要 Servlet 容器。

## 题 2：GlobalFilter 的 Pre 和 Post 分别在哪个位置执行？

```java
// 目的：一个 Filter 同时做 Pre 和 Post
public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
    // ===== Pre 阶段 =====
    long start = System.currentTimeMillis();  // 说明：记录请求开始时间
    return chain.filter(exchange).then(Mono.fromRunnable(() -> {
        // ===== Post 阶段 =====
        long cost = System.currentTimeMillis() - start;  // 输出：计算耗时
        exchange.getResponse().getHeaders().set("X-Time", cost + "ms");  // 结果：写入响应
    }));
}
// 错误用法：在 return chain.filter() 之后直接写代码 → 不会执行（Reactive 链路丢失）
```

## 题 3：多个 Filter 的执行顺序如何确定？

- 实现 `Ordered` 接口或 `@Order` 注解。
- order 值越小 → Pre 越先执行 → Post 越后执行（洋葱模型）。
- 内置：`NettyWriteResponseFilter(-1)` 最外层确保响应最终写出。

## 题 4：如何实现"某个路径不需要鉴权"？

```java
// 目的：白名单机制
private static final List<String> WHITE_LIST = List.of("/api/auth/**", "/actuator/**");

public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
    String path = exchange.getRequest().getURI().getPath();
    if (AntPathMatcher.match(WHITE_LIST, path)) {
        return chain.filter(exchange);  // 结果：跳过鉴权直接透传
    }
    // ...鉴权逻辑
}
// 错误用法：白名单配了 /api/auth 没加 ** → /api/auth/login 不匹配 → 401
```

## 题 5：SCG 路由匹配失败返回什么？如何自定义？

- 默认：404 Not Found。
- 自定义：实现 `ErrorWebExceptionHandler` 或在 `GlobalFilter` 中检测 `exchange.getAttribute(GATEWAY_ROUTE_ATTR) == null` → 返回自定义 JSON。

## 题 6：网关层如何实现 CORS？

```yaml
spring:
  cloud:
    gateway:
      globalcors:
        cors-configurations:
          '[/**]':
            allowedOrigins: "https://shop.example.com"
            allowedMethods: "*"
            allowCredentials: true  # 结果：前端可带 Cookie 跨域
```

注意：若后端也有 CORS 配置 → 响应 Header 重复 → 浏览器报错。网关统一处理，后端不再加。
