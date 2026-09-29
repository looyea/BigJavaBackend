# OTel 架构：API/SDK/Collector 与 OTLP

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：理解 OpenTelemetry 三支柱数据模型、API/SDK 分层设计与 Collector Pipeline 架构。

## 一、OTel 定位

```text
OpenTelemetry = CNCF 标准（原 OpenTracing + OpenCensus 合并）
目标：一套 API/SDK 采集 Trace + Metric + Log → OTLP 导出 → 任意后端
```

## 二、三支柱数据模型

| 信号 | 核心概念 | 导出目标 |
|------|----------|----------|
| Trace | Span(traceId, spanId, parent, attrs, events, links) | Jaeger/Tempo/SkyWalking |
| Metric | Metric(name, type, dataPoints, attributes) | Prometheus/OTLP-Metrics |
| Log | LogRecord(timestamp, severity, body, traceContext) | Loki/ES/ClickHouse |

## 三、API vs SDK 分层

```java
// 目的：API 层——零依赖，库/框架只引 API 不绑实现
import io.opentelemetry.api.trace.Tracer;
Tracer tracer = GlobalOpenTelemetry.getTracer("order-service");
Span span = tracer.spanBuilder("createOrder").startSpan();  // 结果：创建 Span
try (Scope scope = span.makeCurrent()) {
    span.setAttribute("order.id", 12345L);  // 说明：业务属性
    doBusiness();                           // 输出：执行逻辑
} catch (Exception e) {
    span.recordException(e);                // 结果：记录异常
    span.setStatus(StatusCode.ERROR, e.getMessage());
} finally {
    span.end();  // 必须 end → SDK 收集并导出
}
// 错误用法：不引 SDK 只用 API → Span 创建但不导出（NoOpTracer）
```

- **API**：接口定义（`opentelemetry-api`），库作者只依赖此。
- **SDK**：实现（`opentelemetry-sdk`），应用启动时配置 Sampler/Exporter/Processor。

## 四、Collector 架构

```text
Agent/SDK → OTLP(gRPC/HTTP) → Collector:
  Receiver → Processor → Exporter
  (接收)     (批处理/过滤/变换)  (导出到 Jaeger/Prometheus/Loki/...)
```

```yaml
# 目的：Collector 配置 Pipeline
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317  # 说明：OTLP gRPC 端口
processors:
  batch:
    timeout: 5s                 # 结果：5s 或攒满一批发一次
exporters:
  otlp/jaeger:
    endpoint: jaeger:4317       # 输出：Trace 到 Jaeger
  prometheus:
    endpoint: 0.0.0.0:9464      # 说明：Metric 暴露给 Prometheus
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/jaeger]  # 结果：Trace pipeline
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]   # 输出：Metric pipeline
```

## 五、OTLP 协议

```text
OTLP = OpenTelemetry Protocol
传输：gRPC(:4317) 或 HTTP+Protobuf/JSON(:4318)
自描述：含 resource attributes(service.name/env) + scope + signal data
```

## 六、Java SDK 初始化

```java
// 目的：应用启动时配置完整 SDK 管线
SdkTracerProvider provider = SdkTracerProvider.builder()
    .addSpanProcessor(BatchSpanProcessor.builder(
        OtlpGrpcSpanExporter.builder()
            .setEndpoint("otel-collector:4317")  // 说明：Collector 地址
            .build()).build())
    .setResource(Resource.getDefault().toBuilder()
        .put(ServiceAttributes.SERVICE_NAME, "order-service")  // 结果：标识服务
        .build())
    .build();
OpenTelemetrySdk.builder().setTracerProvider(provider)
    .buildAndRegisterGlobal();  // 输出：注册全局 → API 层可用
// 错误用法：未调 buildAndRegisterGlobal → GlobalOpenTelemetry 返回 NoOp → 无数据
```

## 七、关联技术

- OTel 不实现后端（无存储/UI），只做采集标准。
- 与 Prometheus 互补：OTel SDK 采指标 → Collector 转 OTLP → 导给 Prometheus remote_write。
- 与 SkyWalking 关系：SkyWalking 可作为 OTLP Receiver 接收 OTel 数据。
