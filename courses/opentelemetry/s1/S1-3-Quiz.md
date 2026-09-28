# Java Agent 无侵入埋点与采样 · 小测

### 1. OTel Java Agent 的埋点实现机制是？（6分）

- A. 修改业务源码
- B. javaagent + ClassFileTransformer 在类加载时用字节码增强插入埋点
- C. AOP 动态代理所有 Bean
- D. Java Agent 只能增强 main 方法

> 答案：B
> 解析：premain 注册 transformer，类加载时 ASM/ByteBuddy 改写目标框架的类，业务零改动。

### 2. 启用 OTel Java Agent 的正确 JVM 参数是？（6分）

- A. -agent:otel
- B. -javaagent:/path/opentelemetry-javaagent.jar
- C. -Dotel.agent=on
- D. -Xotel:/path/agent.jar

> 答案：B
> 解析：标准 -javaagent 触发 premain；仅 -Dotel.* 只是配置项，不加载 Agent。

### 3. parentbased_traceidratio 采样器中 parent 的含义是？（6分）

- A. 父类 Span 的类名
- B. 上游传入 traceparent flags 的采样决策，下游必须尊重
- C. 进程 ID
- D. 随机数种子

> 答案：B
> 解析：有 parent 时跟随其 sampled 标志，无 parent（入口）才按 ratio 决策 → 保证链路完整。

### 4. 尾部采样（Tail Sampling）必须部署在哪里？（6分）

- A. 应用 JVM 内
- B. Collector（需缓冲完整 Trace 后再决策）
- C. 负载均衡器
- D. 消息队列

> 答案：B
> 解析：只有收齐整条 Trace 才知道"是否出错/是否慢"，应用侧创建 Span 时结果尚未发生。

### 5. 网关 100% 采样、下游服务各自 1% 独立随机采样，后果是？（6分）

- A. 完全正常
- B. 同一 Trace 只留下零散片段（子 Span 被丢弃）→ 链路残缺误导排障
- C. 存储翻倍
- D. 采样率自动协调

> 答案：B
> 解析：违反 ParentBased 一致性：下游丢弃被采 Trace 的 Span → 输出半截链路。

### 6. OTEL_INSTRUMENTATION_JDBC_ENABLED=false 的作用是？（6分）

- A. 关闭整个 Agent
- B. 单独禁用 JDBC 埋点模块，其他埋点不受影响
- C. 切换采样算法
- D. 禁用日志导出

> 答案：B
> 解析：Agent 按模块粒度开关，用于裁剪低价值/高开销埋点。

### 7. Collector tail_sampling 的 decision_wait 参数含义是？（6分）

- A. Trace 最大时长
- B. 等待 Trace 到齐的缓冲时间，超时则提前决策
- C. 导出重试间隔
- D. Span 数量上限

> 答案：B
> 解析：等待窗口越长决策越完整，但 Collector 内存占用越高。

### 8. 关于 OTel Agent 的性能开销，正确的做法有（多选）？（9分）

- A. 高 QPS 服务关闭细粒度埋点（如 Redis 命令级）
- B. 所有埋点无论价值一律开启
- C. 用采样控制导出量而非关闭埋点
- D. 压测对比开/关 Agent 的 RT 与 CPU 差异后再定策略

> 答案：A、C、D
> 解析：B 会放大开销；先量化再裁剪是标准流程，典型 overhead 5%~10%。

### 9. 以下哪些属于 OTel Agent 可以自动增强的组件（多选）？（9分）

- A. Spring MVC / WebFlux
- B. JDBC / MyBatis 底层连接
- C. Kafka / RabbitMQ 客户端
- D. 业务自定义的私有 RPC 框架（无扩展开发时）

> 答案：A、B、C
> 解析：D 需要自写 Extension 模块（ByteBuddy Matcher + Instrumentation），预置库不认识私有框架。

### 10. 简答题：为一个 50 个微服务的系统设计 Trace 采样方案，说明决策依据与配置要点。（40分）

- 要点1：入口统一决策——网关侧 parentbased_traceidratio，正常流量采 5%~10%，说明：保证链路从入口一致
- 要点2：下游服务全部 ParentBased 跟随，禁止独立 ratio 采样，结果：不再出现半截 Trace
- 要点3：Collector 尾部采样兜底——error 与 latency>1s 的 Trace 100% 保留，输出：排障关键样本不丢
- 要点4：多副本 Collector 前置 load balancing exporter 按 traceId 路由，目的：同 Trace 落同一实例决策
- 要点5：日志注入 trace_id 且日志采样策略与 Trace 解耦（错误日志全量），说明：Trace 未采时日志仍可反查

> 答案：见要点
> 解析：核心矛盾是"存储成本 vs 排障完整性"，头部比例控量 + 尾部异常全留是业界标准组合。
