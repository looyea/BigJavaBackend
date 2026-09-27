# Feign 调用链与超时重试陷阱

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：掌握 OpenFeign 调用全链路、超时配置层级、重试陷阱及连接池优化。

## 一、Feign 调用全链路

```text
@FeignClient 接口 → FeignInvocationHandler → LoadBalancer 选实例 → HTTP Client 发请求 → 响应解码
```

```java
// 目的：声明式 HTTP 客户端
@FeignClient(name = "order-service", fallback = OrderClientFallback.class)
public interface OrderClient {
    @GetMapping("/orders/{id}")
    OrderDTO getOrder(@PathVariable("id") Long id);  // 结果：自动映射 HTTP 调用
}
// 说明：调用 orderClient.getOrder(1L) → 实际发 GET http://order-service/orders/1
// 错误用法：@PathVariable 不写 value → 编译后参数名丢失 → 404
```

## 二、超时配置层级

```yaml
# 目的：Feign 超时 = connectTimeout + readTimeout
feign:
  client:
    config:
      order-service:          # 说明：针对特定 FeignClient
        connectTimeout: 2000  # 结果：连接超时 2s
        readTimeout: 5000     # 输出：读取超时 5s
      default:                # 全局默认
        connectTimeout: 1000
        readTimeout: 3000
```

超时链路：`调用方 timeout > 被调方处理时间`，否则永远超时。

## 三、重试陷阱

### 3.1 Feign Retryer 默认不重试

```java
// 目的：开启 Feign 重试（需配合 LoadBalancer）
@Bean
public Retryer feignRetryer() {
    // 说明：period=100ms, maxPeriod=500ms, maxAttempts=3
    return new Retryer.Default(100, 500, 3);  // 结果：最多重试 3 次
}
```

### 3.2 Ribbon/LoadBalancer 重试叠加

```yaml
spring:
  cloud:
    loadbalancer:
      retry:
        max-attempts: 3       # 说明：LB 层重试 3 次
        max-retries-on-same-service-instance: 0  # 结果：同实例不重试
```

**陷阱**：Feign Retryer(3) × LB Retry(3) = 最多 9 次实际请求 → 非幂等接口（如扣款）重复执行！

## 四、连接池配置

```yaml
# 目的：默认 HttpURLConnection 无连接池 → 改用 Apache HttpClient
feign:
  httpclient:
    enabled: true             # 结果：启用连接池
    max-connections: 200      # 说明：总最大连接
    max-connections-per-route: 50  # 输出：每个目标服务最大 50
```

```java
// 目的：OkHttp 方案
feign:
  okhttp:
    enabled: true             // 结果：替换默认 Client
// 错误用法：不设连接池 → 高并发时大量 TIME_WAIT → 端口耗尽
```

## 五、Feign 拦截器

```java
// 目的：统一传递 Token / traceId
@Component
public class FeignRequestInterceptor implements RequestInterceptor {
    @Override
    public void apply(RequestTemplate template) {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest request = attrs.getRequest();
            template.header("Authorization", request.getHeader("Authorization"));  // 结果：透传 Token
            template.header("X-Trace-Id", MDC.get("traceId"));                     // 输出：链路 ID
        }
        // 错误用法：异步线程（@Async）中 RequestContextHolder 为空 → Token 丢失
    }
}
```

## 六、日志级别

```yaml
feign:
  client:
    config:
      order-service:
        loggerLevel: FULL  # 说明：NONE/BASIC/HEADERS/FULL；结果：打印完整请求响应
```

## 七、关联技术

- Feign + Sentinel：Sentinel 自动包装 Feign 作为资源，触发降级走 fallback。
- Feign + Seata：AT 模式下需 `seata-enabled: true`（自动传播 xid Header）。
- Spring Cloud OpenFeign 4.x：移除 Ribbon → 只用 LoadBalancer。
- 虚拟线程（Java 21）：Feign 阻塞模型天然适配虚拟线程，不再担心线程数。
