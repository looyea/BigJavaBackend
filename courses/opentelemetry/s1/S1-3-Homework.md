# Java Agent 无侵入埋点与采样 · 作业

## 作业 1：Agent 挂载与覆盖率验证

**目标**：不写一行埋点代码，让 Spring Boot 应用全链路出 Span。

1. 下载 opentelemetry-javaagent.jar，用 `-javaagent` 参数启动订单服务。
2. 配置 `-Dotel.service.name` 与 OTLP endpoint，请求后在 Jaeger/Tempo 检查 Span 列表。
3. 对照清单：HTTP SERVER、JDBC、Redis、Kafka 四类 Span 是否齐全，输出覆盖率报告。
4. 故意去掉 `-Dotel.exporter.otlp.endpoint` → 观察默认 localhost:4317 连接失败日志，说明 Collector 未起时的表现。

## 作业 2：采样策略对比实验

**目标**：直观理解头部采样与尾部采样的差异。

1. Agent 侧设 `parentbased_traceidratio=0.1`，压测 1000 请求，统计 Jaeger 中完整 Trace 数（说明：应约 100 条且条条完整）。
2. 改错为"网关不传 flags、各服务独立 ratio 0.1" → 再压测，观察半截 Trace 数量激增（结果验证一致性陷阱）。
3. 部署 Collector tail_sampling：error 全采 + 其余 1%；注入 5% 错误请求。
4. 验证：Jaeger 中错误 Trace 占比 ≈100% 保留、正常 Trace ≈1%，输出采样后日均 Span 量估算。

## 作业 3：私有框架扩展埋点

**目标**：为公司内部 RPC 框架写一个最小 Agent Extension。

1. 新建模块依赖 `opentelemetry-sdk` 与 ByteBuddy，实现 `AgentExtension`。
2. 用 `TypeElementMatcher` 匹配框架的 `RpcClient#invoke`，前后插入 Span 创建/结束逻辑。
3. 注入 traceparent 到 RPC 附件（attachment），下游提取续链。
4. 打包后用 `OTEL_JAVAAGENT_EXTENSIONS` 挂载，验证跨服务 Trace 打通；反例检查：忘记 continue root scope → Span 层级全部平铺（说明 scope 泄漏的后果）。
