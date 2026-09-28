# OTel 架构：API/SDK/Collector 与 OTLP · 作业

## 作业 1：SDK 手动埋点导出到 Jaeger

**目标**：Java 应用集成 OTel SDK 发送 Trace 到 Jaeger。

1. 引入 `opentelemetry-sdk` + `opentelemetry-exporter-otlp`。
2. 初始化 SdkTracerProvider → BatchSpanProcessor → OtlpGrpcSpanExporter(localhost:4317)。
3. 在 main 中创建 Span → end → 3s 后 Jaeger UI 可搜索到 trace。
4. 添加 Attribute/Event 并在 UI 中确认展示。

## 作业 2：Collector Pipeline 配置

**目标**：部署 OTel Collector 做 Trace+Metric 分流。

1. Docker 启动 collector，配置 OTLP Receiver(:4317)。
2. Trace pipeline → Exporter: otlp → Jaeger。
3. Metric pipeline → Exporter: prometheus(:9464)。
4. Prometheus 添加 scrape target 指向 Collector :9464 → Grafana 查指标。

## 作业 3：Resource Attributes 验证

**目标**：配置 service.name 并在 Jaeger 区分服务。

1. SDK 初始化时 setResource(service.name="order-service-v1")。
2. 启动另一个应用(service.name="payment-service")。
3. Jaeger UI "Service" 下拉出现两个独立名称。
4. 错误实验：不设 service.name → 默认 "unknown_service:java" → 难以区分。
