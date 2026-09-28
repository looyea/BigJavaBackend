# OTel 架构：API/SDK/Collector 与 OTLP · 小测

### 1. OpenTelemetry 由哪两个项目合并而来？（6分）

- A. Zipkin + Prometheus
- B. OpenTracing + OpenCensus
- C. Jaeger + Grafana
- D. SkyWalking + Datadog

> 答案：B
> 解析：2019 年 OpenTracing（API 标准）与 OpenCensus（SDK+采集）合并为 OTel。

### 2. OTel 三支柱不包括？（6分）

- A. Trace
- B. Metric
- C. Log
- D. Event

> 答案：D
> 解析：Event 不是独立信号（作为 Span Event 或 Log Record 承载）。

### 3. API 层的定位是？（6分）

- A. 提供完整实现
- B. 纯接口——库作者依赖不绑后端实现
- C. 只做 Exporter
- D. 替代 Collector

> 答案：B
> 解析：API=NoOp/Factory 接口；SDK=真正的 Processor/Exporter。

### 4. Collector Pipeline 的三段式是？（6分）

- A. Input/Process/Output
- B. Receiver/Processor/Exporter
- C. Agent/Server/Database
- D. Producer/Broker/Consumer

> 答案：B
> 解析：Receiver 收 → Processor 处理（batch/filter/transform）→ Exporter 导出。

### 5. OTLP 默认 gRPC 端口是？（6分）

- A. 8080
- B. 4317
- C. 9090
- D. 9411

> 答案：B
> 解析：OTLP gRPC=4317，OTLP HTTP=4318。

### 6. Span.end() 不调用会怎样？（6分）

- A. 自动结束
- B. Span 永远不会被 Processor 收集导出
- C. 抛异常
- D. 被 GC 回收

> 答案：B
> 解析：SDK 的 BatchSpanProcessor 只处理 end() 后的 Span——不调 end = 数据丢失。

### 7. OTel 的 Resource Attributes 包含什么？（6分）

- A. 只有 traceId
- B. service.name/deployment.environment 等全局标识
- C. HTTP 响应码
- D. 数据库连接串

> 答案：B
> 解析：Resource 描述"谁产生的数据"——所有 Span/Metric/Log 共享。

### 8. Collector 的 Processor 可做哪些操作？（多选）（9分）

- A. 批量（batch）
- B. 内存限制保护（memory_limiter）
- C. 属性过滤/重命名（transform）
- D. 数据持久化到磁盘

> 答案：A、B、C
> 解析：D 非 Processor 职责——持久化在 Exporter/后端。

### 9. OTel SDK 与 Agent 的关系是（多选）？（9分）

- A. SDK 需手动配置 TracerProvider
- B. Java Agent 自动注入 SDK 并增强框架调用
- C. 有 Agent 就不需要 SDK jar
- D. Agent 本质是 premain + ByteBuddy 修改字节码

> 答案：A、B、D
> 解析：C 错——Agent 内部仍使用 SDK，只是用户无需手动初始化。

### 10. 简答题：描述一个 Span 从创建到最终出现在 Jaeger UI 的完整链路。（40分）

- 要点1：业务代码调 API 层 tracer.spanBuilder → SDK 创建 ReadableSpan
- 要点2：span.end() → SdkSpan 传给 SpanProcessor
- 要点3：BatchSpanProcessor 攒批 → 定时/满阈值 → 通过 OtlpGrpcSpanExporter 发 OTLP
- 要点4：Collector Receiver 接收 → Processor(batch) → Exporter(otlp) 转发给 Jaeger
- 要点5：Jaeger 后端存储 → UI 查询展示完整 Trace 瀑布图

> 答案：见要点
> 解析：理解全链路有助于定位"Trace 丢失""延迟大"等采集问题。
