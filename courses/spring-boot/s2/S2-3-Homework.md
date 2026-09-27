# 作业题 · Actuator 与可观测性

## 作业 1：端点安全加固（必做）

给一个 Boot 工程完成生产级 Actuator 配置：

- 独立管理端口 `management.server.port=9091`
- 仅暴露 `health,info,prometheus,metrics`；显式关闭 `heapdump,shutdown,env,configprops`
- `health` 的 details 设为 `when-authorized`
- 用 Spring Security 对管理端口做鉴权

**验收标准**：业务端口访问不到任何 `/actuator/*`；管理端口未鉴权访问 `/env` 返回 401/403，`/health` 返回聚合但不泄露细节。

## 作业 2：liveness / readiness 分组（必做，本节核心）

配置 `management.endpoint.health.probes.enabled=true` 与两个 health group：

- `liveness` 只含 `livenessState`
- `readiness` 含 `readinessState,db,redis`

**验证**：手动停掉本地 Redis/DB，`curl /actuator/health/liveness` 仍为 UP、`/actuator/health/readiness` 变 DOWN，并写出对应 K8s 探针 yml 片段。

## 作业 3：一个业务 Timer 与高基数规避（必做）

用 Micrometer 给"下单服务方法"埋一个 Timer（或 `@Timed`）：

- tag 只放低基数维度（`channel`、`result`），**不得**把 orderId/userId 作为 tag
- 开启 `publishPercentileHistogram`
- 在 Prometheus 里写出：QPS、错误率、P99 三个查询表达式

**验收标准**：说明为什么把 orderId 当 tag 会出事（基数爆炸），并给出正确归一方式。

## 作业 4：traceId 贯穿日志（选做，架构师向）

接入 Micrometer Tracing，让一次跨两个服务的调用共享同一 traceId，并在 Logback pattern 中输出：

- 给出日志行样例（含 traceId、spanId、appName）
- 说明在 ELK/Loki 中如何仅凭 traceId 拉出这条链路的全部日志
- 讨论采样率设 100% 与降采样的取舍（成本 vs 排障完整性）

## 作业 5：告警阈值设计（选做，架构师向）

基于 `http_server_requests_seconds`，为"电力计量网关"设计三条告警：错误率、P99 延迟、QPS 突降。给出每条的 PromQL 思路、阈值理由、以及"告警风暴抑制/静默窗口"的策略。
