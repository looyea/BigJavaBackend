# Java Agent 无侵入埋点与采样 · 面试题

## 题 1：-javaagent 的底层原理？和 AgentLoader（attach API）有何区别？

```text
-javaagent：JVM 启动时执行 premain()，早于 main，可在类首次加载时转换字节码。
attach API：运行时 agentmain()，可对已启动 JVM 动态挂 Agent（Arthas/JPDA 同理）。
区别：启动后 attach 时部分类已加载完，若未开 CanRetransformClasses 则这些类不会被增强
结果：运行时 attach 的埋点覆盖不全，生产标准做法仍是启动参数挂载。
```

## 题 2：头部采样和尾部采样如何选型？

| 场景 | 推荐 | 原因 |
|------|------|------|
| 流量巨大、只看趋势 | 头部 ratio | 成本低，SDK 即弃 |
| 排障要求高（错误/慢必留） | 尾部采样 | 决策时已知结果 |
| 金融交易链路审计 | 全采或按业务键采样 | 合规不允许丢 |

- 陷阱：尾部采样要求同一 Trace 的 Span 落到同一个 Collector 实例 → 前面必须加按 traceId 一致性哈希的负载均衡，否则决策错乱丢 Span。

## 题 3：Agent 埋了 80+ 框架，为什么还要关心"埋点开关"？

```java
// 示例：高 QPS 网关开启 lettuce 命令级埋点，Span 量暴涨 10 倍
// 目的：只保留 Redis 连接级指标，关命令级 Span
OTEL_INSTRUMENTATION_LETTUCE_ENABLED=false
// 结果：Span 量降一个数量级，Redis 慢问题改由 micrometer 指标 + 采样日志兜底
// 错误做法：全量开启所有模块 → 导出带宽与存储费用失控 → 反而把关键 Trace 挤掉
```

## 题 4：采样标记在链路中如何传递？未采样的 Trace 完全消失吗？

- traceparent flags 位：`01`=sampled、`00`=not sampled，随 Header 全程传播。
- 未采样的 Trace：SDK 仍创建 Span 对象（NonRecordingSpan）以维持上下文传播，但不导出。
- 说明：这就是"propagation 与 sampling 解耦"——链路不断，只是不留数据。

## 题 5：如何让日志与 Trace 关联？Agent 模式下要做什么？

```xml
<!-- 目的：pattern 输出 trace_id/span_id，Logback 引 otel-mdc 或 appender 自动注入 -->
<pattern>%d{HH:mm:ss} [%X{trace_id} %X{span_id}] %-5level %logger - %msg%n</pattern>
<!-- 输出：每条日志带 32 位 traceId，Loki/ES 可按其反查 -->
<!-- 错误用法：只配 pattern 不引 MDC 注入组件 → %X{trace_id} 恒为空 -->
```

## 题 6：Agent 版本号为什么要和 Collector/后端一起规划升级？

- 语义约定随版本演进（如 `http.method` → `http.request.method`），Agent 太新而后端仪表盘太旧 → 面板无数据。
- 采样、propagator 默认值也可能变化；升级前先在预发对比一批 Trace 的属性 diff，结果确认无误再灰度。
- 反例说明：生产直接全量升 Agent 大版本 → 告警规则引用的旧属性名全部失配 → 监控"假健康"。
