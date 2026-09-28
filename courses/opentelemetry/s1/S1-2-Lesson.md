# Trace 传播与语义约定

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：掌握 W3C traceparent 传播格式、Span 语义约定规范及跨进程上下文传递实现。

## 一、W3C Trace Context

```text
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             │  │                                │                │
             │  ├ traceId (32 hex)               ├ spanId (16 hex)├ flags(采样)
             └ version

tracestate: vendor1=xxx,vendor2=yyy  ← 厂商自定义扩展
```

```java
// 目的：Feign 拦截器注入 traceparent（跨进程传播）
@Component
public class TracePropagationInterceptor implements RequestInterceptor {
    @Autowired
    private TextMapPropagator propagator;  // OTel 全局 Propagator
    public void apply(RequestTemplate template) {
        propagator.inject(Context.current(), template,
            (carrier, key, value) -> carrier.header(key, value));  // 结果：写入 HTTP Header
    }
}
// 错误用法：只传 traceId 不传 spanId → 下游 parent 丢失 → Trace 断裂成两段
```

## 二、Span 语义约定（Semantic Conventions）

```text
OTel 规定统一 Attribute Key，避免各团队自造：
- HTTP: http.request.method, http.response.status_code, url.path
- DB: db.system, db.statement, db.name
- Messaging: messaging.system, messaging.destination.name
- RPC: rpc.system, rpc.method, rpc.service
- 通用: exception.type, exception.message
```

```java
// 目的：HTTP Server Span 按语义约定设属性
span.setAttribute(HttpAttributes.HTTP_REQUEST_METHOD, "GET");       // 输出：方法
span.setAttribute(HttpAttributes.HTTP_RESPONSE_STATUS_CODE, 200);    // 结果：状态码
span.setAttribute(HttpAttributes.URL_PATH, "/api/orders/123");       // 说明：路径
span.setAttribute(SemanticAttributes.HTTP_ROUTE, "/api/orders/{id}");// 结果：路由模板
// 错误用法：自造 "method"="GET" → 后端 UI 无法识别 → 不显示 HTTP 面板
```

## 三、跨线程传播

```java
// 目的：@Async / CompletableFuture 中保持 Trace 上下文
Executor otelExecutor = ContextPropagatingTaskDecorator.wrap(threadPool);
// 说明：wrap 后提交任务自动携带当前 Context → 子线程拿到 parent Span
CompletableFuture.supplyAsync(() -> {
    Span current = Span.current();  // 输出：能拿到正确的 parent spanId
    // ... 业务逻辑
}, otelExecutor);
// 错误用法：裸 new Thread / Executors → Context ThreadLocal 丢失 → Span 无 parent
```

## 四、SpanKind 与父子关系

| Kind | 含义 | 典型场景 |
|------|------|----------|
| SERVER | 接收请求的服务端 | HTTP Controller |
| CLIENT | 发起调用的客户端 | Feign/Dubbo 出 |
| INTERNAL | 内部逻辑 | 业务方法 |
| PRODUCER | 发消息 | MQ send |
| CONSUMER | 消费消息 | MQ consume |

## 五、Baggage 跨进程传递

```text
baggage: userId=alice,region=cn-east
OTel Baggage API → 写入/读取 → 注入 HTTP Header → 下游可读 → 关联到 Span Attribute
```

## 六、关联技术

- traceId 注入 MDC → 日志关联 Trace。
- Span Link：异步关联（MQ 生产者与消费者非同父）。
- Collector `attributes` processor 可统一修正不合规属性。
