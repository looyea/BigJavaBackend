# 与 SkyWalking/Prometheus 的关系（关联） · 作业

## 作业 1：三产品能力对照调研

**目标**：用一张表说清 OTel/SkyWalking/Prometheus 的边界。

1. 分别列出三者在"采集、传输、存储、查询、告警、UI"六个环节支持与否，输出对照表。
2. 标注哪些环节存在替代关系（如 OTel Agent vs SW Agent）、哪些是互补（OTel Collector → Prom）。
3. 验收标准：能对"我们已经买了 SW 还需要 OTel 吗"给出 3 条有依据的回答。

## 作业 2：OTel → Prometheus 双通路验证

**目标**：打通 pull 与 push 两条指标链路并对比差异。

1. 部署 Collector `prometheus` exporter，配 Prometheus scrape :8889，Grafana 出曲线（说明：这是 pull 通路）。
2. Prometheus 开 `--enable-feature=otlp-write`，Collector 改用 `prometheusremotewrite` exporter 直推（结果：push 通路）。
3. 同一压测流量下对比两条通路的指标名、`_total` 后缀、直方图桶是否一致，输出 diff 报告。
4. 故意关闭 otlp-write 特性再推一次 → 观察 Collector 报 404 且指标缺失，说明静默失败的排查方法。

## 作业 3：Exemplar 打通 Metric → Trace

**目标**：点击 P99 毛刺直接跳转对应 Trace。

1. OTel Java SDK 采 Trace 入 Tempo，Prometheus 抓 micrometer 指标并开 exemplar 拉取（`--enable-feature=exemplar-storage`）。
2. Grafana 面板 Configure trace 集成指向 Tempo 数据源。
3. 压测注入一次慢请求，在指标图上出现 exemplar 点，点击验证跳转 Trace（输出：traceId 一致）。
4. 反例检查：SDK 未开采样联动时 exemplar 为空 —— 说明指标与 Trace 必须共享同一 traceId 才能打通。
