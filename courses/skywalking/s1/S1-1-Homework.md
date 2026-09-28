# SkyWalking 架构与探针原理 · 作业

## 作业 1：Docker Compose 全家桶 + 双服务链路

**目标**：跑通 Agent→OAP→ES→UI 最小闭环。

1. Compose 起 oap、ui、elasticsearch 与两个 Spring Boot 服务（A 调 B，B 查 MySQL）。
2. 两服务分别挂 skywalking-agent，配 `SW_AGENT_NAME` 与 collector 地址启动。
3. 发一个请求，UI Trace 页按条件查询：验证 1 Trace = 2+ Segments，节点涵盖 HTTP/Dubbo 或 Feign/JDBC Span（输出结构截图描述）。
4. 关掉 B 的 Agent 重启 → 观察拓扑里 B 从"下游"消失、A 出现孤儿 Exit Span，说明上下半段各自成 Trace 的断链形态。

## 作业 2：sw8 传播与断链定位

**目标**：亲手制造并修复三种断链。

1. 网关转发处删除 sw8 Header → 下游新 TraceId（结果复现）。
2. A 服务把 Feign 调用改为裸 `new Thread` 异步执行 → 子线程 Segment 失联；用 `@TraceCrossThread` 或 Skywalking agent 的 spring async 插件修复。
3. Kafka 发送/消费各建独立 Trace → 确认 kafka 插件启用后消息属性携带 sw8、消费端 refs 挂接（说明 PRODUCER/CONSUMER 关联原理）。
4. 输出一份"断链排查 checklist"：Header 白名单→探针插件清单→异步线程→MQ 属性，每步给验证命令。

## 作业 3：Agent 开销与配置调优

**目标**：量化探针成本并形成配置基线。

1. 压测同一接口：无 Agent / 默认 Agent / 开启 spring-annotation optional 插件三组，记录 RT、CPU、GC 差异（输出对比表）。
2. 配置 `SW_TRACE_IGNORE_PATHS` 屏蔽 /actuator 后，统计 Span 量下降比例。
3. 调整采样 `SW_AGENT_SAMPLE`（每 3 秒 N 个 Trace）观察 UI Trace 密度变化，说明"采样只影响存储不影响拓扑指标精度"的机制。
4. 产出团队 agent.config 基线：服务名规范、namespace、忽略路径、采样、日志级别，附每行注释说明。
