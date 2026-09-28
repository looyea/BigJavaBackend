# Trace 传播与语义约定 · 面试题

## 题 1：traceparent flags=01 表示什么？如果改成 00 会怎样？

- `01` = sampled（已采样，下游应继续记录 Span）。
- `00` = not sampled（下游不再创建新 Span，只传播 traceId）。
- 实际效果：flags=00 → SDK Sampler 判断 parent not-sampled → 丢弃该请求所有 Span。

## 题 2：Trace 断裂的常见原因？

```text
1. 跨进程：HTTP Header 未注入 traceparent（拦截器缺失/异步丢 Context）
2. 线程池：Context ThreadLocal 未传播（无 TaskDecorator）
3. MQ：消息中未携带 trace 上下文（需 Producer 注入 + Consumer 提取）
4. 采样：上游被 not-sampled → 下游 Span 不记录
```

## 题 3：B3 与 W3C traceparent 的区别？

| 维度 | W3C | B3 (Zipkin) |
|------|-----|-------------|
| Header | 单 `traceparent` | 多 Header（X-B3-TraceId/SpanId/...） |
| traceId 长度 | 固定 128bit | 64bit 或 128bit |
| 采样标志 | flags byte | X-B3-Sampled: 0/1 |
| OTel 支持 | 默认 Propagator | 可配 CompositePropagator |

## 题 4：语义约定版本迁移问题？

- 2022 年属性名大改：`http.method` → `http.request.method`。
- Collector `transform` processor 做兼容映射 → 老后端仍可用。
- 最佳实践：全栈统一升级到新版本属性名 + 后端支持双读。

## 题 5：Span Event 与 Span Attribute 的区别？

```java
// Attribute：Span 最终状态（如 status=200）——一次性覆盖
span.setAttribute("retry.count", 3);  // 结果：最终值为 3
// Event：时间点（如 exception 发生时刻）——多次追加
span.addEvent("retry", Attributes.of(
    AttributeKey.longKey("attempt"), 2L  // 说明：第 2 次重试的时间戳
));  // 输出：时间线可视化
```

## 题 6：如何把 traceId 关联到日志？

```java
// 目的：MDC 注入 traceId → logback pattern %X{trace_id} 输出
// OTel Appender 自动做：Logback/Log4j2 引 otel-logback-appender → 每条日志带 traceId
// 结果：Jaeger 查 Trace → 一键跳转到关联日志（Loki/ES 按 traceId 查）
// 错误用法：手动 MDC.put 但不 remove → 线程复用时 traceId 残留到其他请求
```
