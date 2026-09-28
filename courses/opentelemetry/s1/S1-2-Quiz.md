# Trace 传播与语义约定 · 小测

### 1. W3C traceparent Header 包含哪些字段？（6分）

- A. traceId, spanId, flags, version
- B. traceId, parentId
- C. spanId, status
- D. 只有 traceId

> 答案：A
> 解析：格式 `version-traceId-spanId-flags`，flags 表示采样决策。

### 2. 语义约定（Semantic Conventions）的目的是？（6分）

- A. 加密传输
- B. 统一 Attribute Key 名，使各后端可正确解析展示
- C. 压缩 Span 体积
- D. 定义 RPC 方法

> 答案：B
> 解析：统一命名 → Jaeger/Grafana Tempo/Datadog 等都能识别 HTTP/DB 指标面板。

### 3. SpanKind.SERVER 表示？（6分）

- A. 发起外部调用
- B. 接收并处理请求的服务端 Span
- C. 内部方法
- D. 发 MQ 消息

> 答案：B
> 解析：SERVER = 被调用入口（如 Spring MVC Controller 入口创建的 Span）。

### 4. 跨线程传播失败最常见的后果是？（6分）

- A. 性能变慢
- B. 子线程创建新 Trace（parentSpanId 丢失）→ Trace 断裂
- C. 程序崩溃
- D. 重复 Span

> 答案：B
> 解析：ThreadLocal Context 不随线程池迁移 → Span.current() 为空 → 新 TraceId。

### 5. Baggage 与 Trace 的区别是？（6分）

- A. 完全相同
- B. Baggage 是用户自定义 KV 跨进程传递，Trace 是调用链
- C. Baggage 只能传数字
- D. Baggage 不随 Header 传递

> 答案：B
> 解析：Baggage = "业务上下文"（如 userId），Trace = "调用链上下文"（traceId/spanId）。

### 6. MQ 场景用什么关联 Producer 和 Consumer？（6分）

- A. parent-child
- B. Span Link（异步场景无父子关系）
- C. Baggage
- D. traceId 相同即可

> 答案：B
> 解析：Producer Span 与 Consumer Span 时间跨度大，用 Link 关联而非 parent。

### 7. http.route 属性的作用是？（6分）

- A. 实际请求 URL
- B. 路由模板（/orders/{id}），聚合指标避免高基数
- C. IP 地址
- D. 服务名

> 答案：B
> 解析：若用实际 URL → 百万 Span 标签 → Prometheus 高基数爆炸。

### 8. 以下哪些是合法的 OTel Propagator？（多选）（9分）

- A. W3C TraceContext
- B. B3（Zipkin）
- C. Jaeger
- D. AWS X-Ray

> 答案：A、B、C、D
> 解析：OTel SDK 内置四种 + CompositePropagator 混用。

### 9. 语义约定中 exception 相关属性包括（多选）？（9分）

- A. exception.type
- B. exception.message
- C. exception.stacktrace
- D. exception.handler

> 答案：A、B、C
> 解析：D 非标准约定字段。

### 10. 简答题：一次 HTTP 请求从 Gateway 到 Service-A 再到 DB，描述 traceparent 的传播和 Span 层级关系。（40分）

- 要点1：Gateway 收到请求 → 创建 SERVER Span（spanId=S1），从入站 header 提取 traceId=T1
- 要点2：Gateway 调 Service-A → CLIENT Span（spanId=S2, parent=S1）→ 注入 traceparent:00-T1-S2-01
- 要点3：Service-A 入口 → SERVER Span（spanId=S3, parent=S2）从 header 提取
- 要点4：Service-A 查 DB → INTERNAL/CLIENT Span（spanId=S4, parent=S3），带 db.system 属性
- 要点5：最终层级 S1→S2→S3→S4，全部同 traceId=T1，Jaeger 渲染瀑布图

> 答案：见要点
> 解析：理解传播链路是排查 Trace 断裂（缺 header/线程切换丢 Context）的基础。
