# 网关限流、熔断与统一认证

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：在 SCG 上落地 RequestRateLimiter 限流、Sentinel 熔断和 OAuth2/JWT 统一认证。

## 一、RequestRateLimiter 限流

```yaml
# 目的：基于 Redis 令牌桶的网关限流
spring:
  cloud:
    gateway:
      routes:
        - id: order-route
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 100  # 说明：每秒填充 100 个令牌
                redis-rate-limiter.burstCapacity: 200  # 结果：桶容量 200（允许短时突发）
                key-resolver: "#{@ipKeyResolver}"       # 输出：按 IP 限流
```

```java
// 目的：自定义 KeyResolver——按用户 ID 限流
@Bean
public KeyResolver userKeyResolver() {
    return exchange -> {
        String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
        return Mono.justOrEmpty(userId).defaultIfEmpty("anonymous");  // 结果：每用户独立桶
    };
}
// 错误用法：burstCapacity 太小(=replenishRate) → 稍有并发就 429 → 误伤正常流量
```

## 二、Sentinel 网关流控集成

```xml
<!-- 目的：引入 sentinel-spring-cloud-gateway-adapter -->
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-spring-cloud-gateway-adapter</artifactId>
    <version>1.8.6</version>
</dependency>
```

```java
// 目的：自定义 BlockHandler——限流触发时返回友好 JSON
@Component
public class GatewayBlockHandler implements RequestOriginParser {
    public Mono<Void> handle(HttpServletRequest req, HttpServletResponse resp, BlockException ex) {
        resp.setStatus(429);
        resp.setContentType("application/json;charset=UTF-8");
        resp.getWriter().write("{\"code\":429,\"msg\":\"请求过于频繁\"}");  // 输出
        return Mono.empty();  // 结果：不转发到后端
    }
    // parseOrigin：从 Header 提取来源标识（用于热点参数限流）
}
// 错误用法：未注册 BlockRequestHandler → 默认返回空 429 → 前端无法解析错误
```

## 三、SCG + CircuitBreaker 熔断

```yaml
# 目的：路由级熔断配置
spring:
  cloud:
    gateway:
      routes:
        - id: inventory-route
          uri: lb://inventory-service
          predicates:
            - Path=/api/inventory/**
          filters:
            - name: CircuitBreaker
              args:
                name: inventoryCB
                fallbackUri: forward:/fallback/inventory  # 结果：熔断后走降级
```

```java
// 目的：降级 Controller
@RestController
public class FallbackController {
    @RequestMapping("/fallback/inventory")
    public Mono<ResponseEntity<Map<String,Object>>> inventoryFallback() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of("code", 503, "msg", "库存服务暂时不可用")));  // 输出：友好降级
    }
}
// 错误用法：fallbackUri 路径未在 Spring 中注册 → 抛 500 而非降级
```

## 四、OAuth2/JWT 统一认证

```text
登录流程：Client → /oauth/token (Auth Server) → 返回 JWT
请求流程：Client → Gateway(验 JWT) → 透传 X-User-Id → 后端服务
```

```java
// 目的：Gateway Security 集成（资源服务器模式）
@EnableWebFluxSecurity
public class SecurityConfig {
    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        http.oauth2ResourceServer().jwt()  // 说明：JWT 验证
            .and().and()
            .authorizeExchange()
            .pathMatchers("/api/auth/**").permitAll()     // 结果：登录接口放行
            .anyExchange().authenticated()                // 输出：其余需认证
            .and().csrf().disable();
        return http.build();
    }
}
// 错误用法：忘记配置 jwk-set-uri → JWT 签名无法验证 → 所有请求 401
```

## 五、三者组合执行顺序

```text
请求 → CORS → Security(认证) → Sentinel/RateLimiter(限流) → CircuitBreaker(熔断) → 转发
```

- Security 最外层：未认证直接 401。
- 限流在认证之后：避免未授权请求消耗令牌。
- 熔断在最内层：只对已转发的请求做错误率判断。

## 六、关联技术

- 网关集群多实例：限流计数器用 Redis 共享（单机 Bucket 不准确）。
- 认证下沉 vs 网关统一：BFF 层做认证 → 后端服务信任 X-User-Id（需网关注入 + 后端不再暴露外网）。
- 限流维度：IP/用户/接口/全局——不同业务组合 KeyResolver。
- 可观测：网关层打 access log（traceId + route + status + latency）→ 接 ELK。
