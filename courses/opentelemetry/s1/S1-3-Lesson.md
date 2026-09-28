# Java Agent 无侵入埋点与采样

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：掌握 OTel Java Agent 的字节码增强原理、常用配置方式，并能设计头部/尾部采样策略。

## 一、为什么需要无侵入埋点

```text
手动埋点（SDK）：每个框架都要写拦截器 → 工作量大、升级易漏。
自动埋点（Agent）：一个 -javaagent 参数 → 80+ 常用组件（HTTP/DB/MQ/线程池）自动出 Span。
结果：业务代码零改动，Trace 覆盖率从"核心链路"提升到"全链路"。
```

## 二、字节码增强原理

```text
JVM 启动 → java.lang.instrument.Instrumentation 注册 ClassFileTransformer
        → 类加载时 ASM/ByteBuddy 修改字节码 → 在方法前后插入埋点代码
OTel Agent 预置 instrumentation 模块：每个模块针对一个框架（如 spring-webmvc、jdbc）
```

```bash
# 目的：挂载 Agent 启动 Spring Boot 应用
java -javaagent:/opt/opentelemetry-javaagent.jar \
     -Dotel.service.name=order-service \
     -Dotel.exporter.otlp.endpoint=http://otel-collector:4317 \
     -jar order-service.jar
# 输出：日志出现 "opentelemetry-javaagent - version: x.x.x" → Agent 生效
# 错误用法：-javaagent 写成 -agentlib → JVM 找不到 premain 入口 → 启动直接抛错退出
```

## 三、以环境变量为中心的配置

```yaml
# 目的：K8s 中用环境变量注入 Agent 配置，不改镜像
env:
  - name: OTEL_JAVAAGENT_EXTENSIONS        # 说明：指向自定义扩展 jar
    value: "/ext/otlppayload.jar"
  - name: OTEL_PROPAGATORS
    value: "tracecontext,baggage"           # 结果：W3C 双 Header 传播
  - name: OTEL_TRACES_SAMPLER
    value: "parentbased_traceidratio"       # 说明：父子一致 + 按比例
  - name: OTEL_TRACES_SAMPLER_ARG
    value: "0.1"                            # 输出：新 Trace 只采 10%
  - name: OTEL_INSTRUMENTATION_JDBC_ENABLED
    value: "false"                          # 目的：DB 埋点有性能顾虑时单独关闭
```

## 四、头部采样 vs 尾部采样

| 维度 | 头部采样（Head） | 尾部采样（Tail） |
|------|------------------|------------------|
| 决策时机 | Span 创建时（SDK/Agent） | Trace 收齐后（Collector） |
| 是否知道全貌 | 不知道（错误还没发生） | 知道（可按 error/慢 Trace 全留） |
| 成本 | 极低 | Collector 需缓冲整条 Trace、多副本要按 traceId 路由 |
| 典型策略 | TraceIdRatioBased | 错误必采 + P99 超阈值必采 + 其余 1% |

```yaml
# 目的：Collector tail_sampling processor —— 错误与慢调用 100% 保留
processors:
  tail_sampling:
    decision_wait: 10s                 # 说明：等 10 秒凑齐 Trace 再决策
    policies:
      - name: keep-error
        type: status_code              # 结果：status=ERROR 的 Trace 全采
        status_code: { status_codes: [ERROR] }
      - name: keep-slow
        type: latency
        latency: { threshold_ms: 1000 } # 输出：超 1s 的 Trace 全采
      - name: sample-rest
        type: probabilistic
        probabilistic: { sampling_percentage: 1 }  # 目的：其余仅 1%，控制成本
```

## 五、采样的一致性陷阱

```text
规则：采样决策必须跟随 parent（ParentBased）——
上游采了、下游不采 → Trace 半截缺失，排障时误导。
traceparent flags=01 一旦写入，链路上所有服务都应尊重该决策。
错误示例：网关 100% 采、服务自己又 1% 独立 ratio 采 → 输出大量"孤儿片段"。
```

## 六、关联技术

- Agent 附带 logback/log4j2 appender 自动把 trace_id 注入日志行。
- 自定义 instrumentation 模块：写 Extension + ByteBuddy Matcher 埋内部框架。
- 性能：典型 overhead 5%~10%，高 QPS 场景优先关掉低价值埋点（如 lettuce 命令级）。
