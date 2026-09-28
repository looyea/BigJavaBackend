# Trace 传播与语义约定 · 作业

## 作业 1：跨服务 Trace 传播验证

**目标**：Gateway → OrderService → PaymentService 完整链路。

1. 三服务均引 OTel SDK + Agent。
2. 发一个请求 → Jaeger 搜索 traceId → 应看到 3 个服务 6 个 Span（每对 CLIENT+SERVER）。
3. 手动去掉 Feign 拦截器 → 重新请求 → 观察 PaymentService 变成新 Trace（断裂）。
4. 恢复拦截器 → 链路完整。

## 作业 2：语义约定合规检查

**目标**：Span Attribute 名符合官方规范。

1. 检查 HTTP Span：有 `http.request.method` + `http.response.status_code` + `url.path`。
2. 检查 DB Span：有 `db.system=mysql` + `db.statement`。
3. 故意用旧属性 `http.method` → Jaeger 仍兼容但告警。
4. Collector transform processor 统一修正为新版属性名。

## 作业 3：异步线程 Trace 不丢失

**目标**：@Async 方法中的 Span 仍是同一 Trace。

1. 主线程创建 Span → 调用 @Async → 异步方法内 Span.current().getSpanContext()。
2. 裸线程池：traceId 变化（断裂）。
3. 用 OTel `Context.wrap(executor)` 包装线程池 → 异步 traceId 与主线程一致。
