# 网关三大件与全局过滤器

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：掌握 Spring Cloud Gateway 的 Route/Predicate/Filter 三大件模型及 GlobalFilter 执行链路。

## 一、核心模型

```text
Client → Gateway:
  Route（路由） = id + uri + predicates[] + filters[]
  Predicate（断言）= 匹配条件（Path/Method/Header/Query/Weight/Time）
  Filter（过滤器）= 请求/响应拦截（修改 Header/限流/熔断/重写路径）
```

```yaml
# 目的：YAML 配置一条完整路由
spring:
  cloud:
    gateway:
      routes:
        - id: order-route                        # 说明：路由唯一标识
          uri: lb://order-service                # 结果：负载均衡到 Nacos 注册的服务
          predicates:
            - Path=/api/orders/**                # 输出：匹配路径
            - Method=GET,POST                    # 结果：只允许 GET/POST
          filters:
            - StripPrefix=1                      # 说明：去掉 /api 前缀
            - AddRequestHeader=X-Gateway, scg    # 结果：添加标记 Header
```

## 二、常用 Predicate

| 断言 | 示例 | 说明 |
|------|------|------|
| Path | `/api/**` | Ant 风格路径 |
| Method | GET,POST | HTTP 方法白名单 |
| Header | `X-Token`, regex | 匹配请求头（含正则） |
| Query | `page`, `\d+` | URL 参数匹配 |
| Weight | `group=blue, weight=80` | 灰度权重路由 |
| After/Before | `2026-01-01` | 时间窗口 |

## 三、Filter 分两类

### 3.1 GatewayFilter（路由级）

```yaml
filters:
  - RewritePath=/api/(?<seg>.*), /$\{seg}  # 结果：路径重写
  - RequestRateLimiter=                    # 说明：限流（需 Redis）
```

### 3.2 GlobalFilter（全局）

```java
// 目的：全局鉴权——所有路由都经过
@Component
public class AuthGlobalFilter implements GlobalFilter, Ordered {
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String token = exchange.getRequest().getHeaders().getFirst("Authorization");
        if (token == null || !jwtUtil.validate(token)) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);  // 输出：401
            return exchange.getResponse().setComplete();                    // 结果：短路返回
        }
        // 说明：校验通过 → 解析 userId 写入下游 Header
        exchange.mutate().request(r -> r.header("X-User-Id", jwtUtil.getUserId(token)));
        return chain.filter(exchange);  // 继续过滤器链
    }
    @Override
    public int getOrder() { return -100; }  // 结果：优先级高，先执行
}
// 错误用法：不在鉴权失败时 return setComplete() → 继续 chain → 未授权请求穿透到后端
```

## 四、GlobalFilter 执行链路

```text
Request → Pre-GlobalFilters(按 order 升序) → Route GatewayFilter → 转发到后端
Response ← Post-GlobalFilters(按 order 降序) ← Route GatewayFilter ← 后端响应
```

- 内置 GlobalFilter：`RouteToRequestUrlFilter`(10000)、`LoadBalancerClientFilter`(10100)、`NettyWriteResponseFilter`(-1)。

## 五、自定义 Predicate

```java
// 目的：基于请求 Header 中 version 字段做灰度路由
public class VersionRoutePredicateFactory extends AbstractRoutePredicateFactory<VersionRoutePredicateFactory.Config> {
    @Override
    public Predicate<ServerWebExchange> apply(Config config) {
        return exchange -> {
            String ver = exchange.getRequest().getHeaders().getFirst("X-Version");
            return config.getVersion().equals(ver);  // 结果：匹配则路由到此 Route
        };
    }
    // 错误用法：未注册到 Spring → Gateway 不识别 "Version=..." → 启动报错
}
```

## 六、关联技术

- SCG vs Zuul 1.x：SCG 响应式（Netty）高并发；Zuul 1.x 阻塞（Tomcat）。
- SCG + Sentinel：`SentinelSCGAdapter` 自动识别 Route 作为资源限流。
- SCG + OAuth2 Resource Server：Security 集成做 Token 校验。
- SCG 动态路由：从 Nacos 读路由 JSON → `RouteDefinitionWriter` 热加载。
