# 服务发现、Exporter 与长期存储 · 面试题

## 题 1：为什么 Prometheus 选择 pull 而不是 push？和 SD 的关系？

- pull + SD 组合让"目标生命周期"由 Prom 单侧管理：应用上线路即被自动发现抓取，无需任何注册动作（结果：接入零侵入）。
- push 模型（Telegraf/StatsD 式）需要每个应用维护 endpoint 配置，K8s 高频伸缩下配置漂移严重。
- 追问：什么时候必须 push？答：短任务（Pushgateway）、跨云网络单向（Prom 出不去）。

## 题 2：relabel 和 metric_relabel 的区别？

```yaml
relabel_configs:        # 目标级：作用于抓取前的 target 标签（__address__ 等）
  - action: keep ...    # 决定"抓不抓、抓哪里"
metric_relabel_configs: # 样本级：作用于抓取后、入库前（真实指标标签）
  - source_labels: [http_path]
    regex: "/actuator/.*"
    action: drop        # 目的：丢弃整条无价值序列（如健康检查路径的 histogram）
# 结果：relabel 管"发现"，metric_relabel 管"入库闸门"（基数治理主力是后者）
# 反例：把 __address__ 改写写进 metric_relabel_configs（样本级）→ 目标级标签在此已不可见 → 配置静默无效
```

## 题 3：一个 Pod 同时被 Service 和 Pod 两种 SD 角色发现，会发生什么？

- 两条 job 抓同一端点 → 同一样本以不同 job 标签各存一份，`sum` 时翻倍（典型"QPS 莫名其妙×2"事故）。
- 处理：统一入口用 endpointslice SD；或 metric_relabel 按 job 去重；或 hashmod 抽样。
- 说明：抓多份不是 Prom 报错而是配置语义问题，TARGETS 页要定期审计重复 address。

## 题 4：Thanos、Mimir、VictoriaMetrics 三者怎么选？

| 维度 | Thanos | Mimir | VictoriaMetrics |
|------|--------|-------|-----------------|
| 架构 | Prom Sidecar + 对象存储 | 微服务化、多租户 | 单二进制集群可选 |
| 适用 | 已有大量 Prom、要全局视图 | 超大规模/多团队 | 中小规模省资源首选 |
| 成本 | 中（组件多） | 高（运维复杂） | 低（内存压缩强） |
- 追问：数据已全在 S3 为什么还要降采样？答：一年 15s 精度全量扫描成本不可控，趋势查询用 5m/1h 级足够。

## 题 5：remote_write 会不会丢数据？如何度量？

- 语义 at-least-once：WAL 保留窗口内重试；远端长期不可用超出保留期才会真丢。
- 监控三件套：`prometheus_remote_storage_samples_pending`（积压）、`..._failed_total`（拒绝）、`..._shards`（自动分片数）。
- 落地：给 pending 设告警（如 > 5min 数据量），结果：在真丢之前人工介入。

## 题 6：exporter 挂了和真实故障如何区分？（可观测性的可观测性）

1. `up{job="mysql"} == 0` 只能说明"抓不到"，不能说明"MySQL 挂了"——需双信号交叉：exporter 所在节点 ssh 探活 + 应用侧连接池指标。
2. blackbox 从多站点拨测，区分"服务挂"与"网络/抓取挂"。
3. 规范：exporter 与目标同生命周期部署（DaemonSet），并给 exporter 自身配 `alert`（元监控），说明：监控系统也是被监控对象。
