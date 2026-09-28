# 与 SkyWalking/Prometheus 的关系（关联） · 面试题

## 题 1：公司已有 SkyWalking，为什么还想引入 OTel？怎么答值不值？

```text
值得的场景：
1. 多云/多后端锁定 —— OTLP 标准出口，换后端不改埋点（结果：避免 APM 厂商绑定）。
2. 非 Java 生态与新组件 —— 部分框架只有 OTel 自动埋点没有 SW 探针。
3. 统一三支柱采集 —— Trace/Metric/Log 一套 Agent + Collector，替代多套探针叠加。
不值得的场景：团队只用 SW 且 UI 满意、无预算做双栈运维 → 强行迁移纯增加复杂度。
```

## 题 2：OTel 会取代 Prometheus 吗？

- 不会取代查询与存储：PromQL 生态、告警规则、TSDB 仍是指标事实标准。
- OTel 取代的是"指标采集/传输碎片化"：SDK + Collector 可替代部分 exporter/micrometer 注册表场景。
- 官方定位：OTel metrics 与 Prom 双向兼容（prometheus exporter / otlp-write），结论：共生而非替代。

## 题 3：pull 与 push 模型在迁移中如何取舍？

| 维度 | pull（Prom scrape） | push（OTLP/remotewrite） |
|------|--------------------|--------------------------|
| 服务发现 | Prom 侧集中管理 | 应用配置 endpoint |
| 短生命周期任务 | 易丢数据（需 Pushgateway） | 天然友好 |
| 网络方向 | Prom → 应用（出站在内网友好） | 应用 → 收集器 |
| 过载保护 | 拉取限速直观 | 需 Collector 背压设计 |

- 追问：K8s 大规模集群为什么仍以 pull 为主？结果：SD 集成完善、无 endpoint 配置漂移。

## 题 4：sw8 与 traceparent 双 Header 并存会有什么问题？

```text
场景：网关只认 traceparent，下游 SW 服务只认 sw8。
后果：跨协议边界 Trace 断裂 —— 两侧各自成新 traceId（错误示例）。
处理：在边界服务（或 Collector）做转换：提取一种格式 → 注入另一种；
说明：OTel 的 CompositePropagator（tracecontext,baggage,sw8 扩展）可原生完成互注。
```

## 题 5：迁移期间如何证明"新链路没有丢数据"？

- 双写对拍：同流量下比较 SW 与 Tempo 的 Trace 数、span 平均深度、error 率（输出偏差 <1% 达标）。
- 指标对侧：新旧采集链路的 QPS/RT 曲线叠加展示，桶与命名先归一化再比。
- 演练验证：随机抽 20 个线上告警走新链路排障，统计定位耗时是否退化（用结果数据说话）。

## 题 6：为什么"语义约定"是跨产品互通的最大隐患？

- 各产品字段名演进不同步：`http.status_code` vs `http.response.status_code`，UI 面板查不到数据。
- 单位/后缀差异：Prom 惯例 `_seconds`、OTel 视图可配 unit → 转换层丢配则数值差 1000 倍。
- 落地建议：把语义约定写进团队 CR 检查清单，并在 Collector 用 transform processor 做集中纠偏，目的：单点修复而不是 50 个服务各改一遍。
