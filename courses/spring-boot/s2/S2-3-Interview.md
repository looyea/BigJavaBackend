# 实际面试题 · Actuator 与可观测性

## 题 1：你们线上怎么用 Actuator？哪些端点会暴露？

**考察层次**：初级只会开 `include=*`；中级知道安全边界；高级能把端点、探针、指标采集串成一套方案。

**参考答法**：

1. Actuator 定位是"暴露运行时端点"，本身不做采集告警，要接 Prometheus + Grafana + 日志平台。
2. 生产只放开 `health`、`info`、`metrics`、`prometheus`，且走**独立管理端口**并鉴权；`env`、`configprops`、`heapdump`、`shutdown` 一律关闭或强鉴权。
3. health 做 liveness/readiness 分组，对接 K8s 探针；details 设 `when-authorized` 防泄露依赖信息。
4. 指标经 Micrometer 统一，Web 层 `http.server.requests` 提供 QPS/延迟/错误率，注意 tag 归一防高基数。

**追问**：为什么不把 `/health` 直接当 liveness？→ 它聚合了 DB 等外部依赖，下游抖动会引发误杀重启雪崩。

## 题 2：Counter、Gauge、Timer 分别什么时候用？

**答题要点**：

- Counter：累计只增事件（请求数、错误数、消费消息数），配合 `rate()` 得速率。
- Gauge：可上可下的瞬时值（线程池活跃数、队列长度、堆用量、库存量），采样时刻读数。
- Timer：记录耗时分布，产出 count/total/max 和百分位；算子/接口 P99 用它。DistributionSummary 是"非时长"版（如响应体大小）。

**加分**：能说出 Prometheus 侧 Counter 重命名/重启导致 rate 异常的处理（counter 重置），以及 histogram bucket 设计对 P99 精度影响。

## 题 3：Pod 一直重启，你怀疑探针配错了，怎么定位与修复？

**结构化回答**：

1. `kubectl describe pod` 看是哪个探针失败（liveness 失败→重启，readiness 失败→摘流量不重启）。
2. 若 liveness 失败：区分是"进程真卡死/启动慢"还是"探针依赖了外部"。启动慢用 startupProbe 兜住窗口；依赖外部应把它移出 liveness。
3. 校验健康分组配置：liveness 只含 `livenessState`，readiness 才含 db/redis。
4. 复现验证：临时让 DB 不可用，确认只 readiness 变 DOWN、liveness 仍 UP、Pod 不再被杀。
5. 固化：把探针配置纳入发布 checklist，配合实测启动耗时设 `initialDelaySeconds`。

## 题 4：可观测性三大支柱是什么？只有指标够不够？

**答题要点**：Metrics（趋势与告警，低成本可聚合）、Tracing（一次请求跨服务的调用链，定位慢在哪一跳）、Logging（明细与上下文）。三者靠 traceId 关联才形成闭环。只有指标能发现"P99 涨了"，但答不出"哪个下游哪次调用慢"——那要靠 trace + log。Boot 3 用 Micrometer Tracing 统一抽象，后端可换 Zipkin/OTLP。

## 高频追问速答

1. 管理端点和业务端点为什么要分端口？→ 网络隔离、独立鉴权、防止业务流量打满导致运维探活也失败。
2. 什么是指标高基数，为什么危险？→ 单个指标 tag 组合过多（如把 userId/orderId 当 tag），时序暴涨拖垮 Prometheus 内存。
3. `/actuator/loggers` 改的级别会持久吗？→ 不会，重启失效；适合临时排障。
4. metrics 和 prometheus 端点区别？→ `/metrics` 是 JSON 概览，`/prometheus` 是 exposition 文本格式供抓取。
5. 优雅下线用 Actuator 吗？→ 配合 K8s preStop + readiness 置 DOWN 摘流量，`/shutdown` 一般不用（风险高），靠容器 SIGTERM。
