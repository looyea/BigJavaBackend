# OTel 架构：API/SDK/Collector 与 OTLP · 面试题

## 题 1：OTel API 和 SDK 为什么分离设计？

- **库/框架作者**：只引 `opentelemetry-api`（极轻 ~100KB），埋 Span/Metric，不关心后端是谁。
- **应用运维**：配置 SDK（Exporter/Sampler）决定数据去向。
- 好处：框架零侵入——Spring Boot/OkHttp 等内置 API 埋点，用户可选是否启用 SDK。

## 题 2：Collector 部署模式有哪几种？

| 模式 | 说明 | 适用 |
|------|------|------|
| Agent | 与应用同 Pod/Sidecar | 低延迟本地处理 |
| Gateway | 集中部署一套 Collector | 多租户/统一策略 |
| 混合 | Agent 收 → Gateway 分发 | 大规模（万+实例） |

## 题 3：OTLP vs Zipkin/Jaeger 原生协议？

- OTLP 是统一格式（含 resource + trace/metric/log）；Zipkin/Jaeger 只有 Trace。
- OTel Collector 可 Receiver:zipkin → Exporter:otlp → 统一管线。
- 迁移建议：新系统直接 OTLP；存量 Zipkin 通过 Collector 适配。

## 题 4：BatchSpanProcessor 参数如何调优？

```java
BatchSpanProcessor.builder(exporter)
    .setMaxQueueSize(2048)       // 结果：内存中最多缓存 Span 数
    .setMaxExportBatchSize(512)  // 说明：每批导出数
    .setScheduleDelayMillis(5000) // 输出：定时 5s 触发一次导出
    .build();
// 错误用法：maxQueueSize 太小 → 高 QPS 溢出丢 Span
// 建议：queue > 峰值 QPS × 平均 span/req × 导出间隔
```

## 题 5：OTel 的 Context Propagation 原理？

```text
当前线程：Context.current() → ThreadLocal → 存 traceId+spanId
跨线程：io.opentelemetry.context.propagation.TextMapSetter → 注入 Header("traceparent")
跨进程：Carrier → W3C traceparent 格式：00-{32hex traceId}-{16hex spanId}-{flags}
```

## 题 6：OTel 与 Prometheus 如何协同？

- OTel SDK 产生 Metric（Histogram/Counter）→ OTLP 导出 → Collector → Prometheus Exporter。
- 或用 `io.opentelemetry.exporter.prometheus` 直接暴露 /metrics → Prometheus scrape。
- Trace 通过 Span Event 关联 Logs：trace_id 注入 MDC → Loki 查询。
