# Loki 架构与标签模型

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：能画出 Loki 写入/查询两条路径上各组件的职责，说清"流（stream）"与标签集的关系，制定不炸基数的标签规范，并给出 Promtail/Alloy 采集 Spring Boot 日志的落地配置。

## 一、Loki 的数据模型：流 + chunk + 标签索引

Loki 把日志组织成**流（stream）**：一组共享同一标签集（label set）的日志行。标签集相同 → 同一条流；任何一个标签值不同 → 新流（等价于 Prometheus 的 series 概念）。流内日志按时间切成 **chunk**（默认 ~24h 或 1.5MB 关闭），压缩后整体放进对象存储。**索引里只存标签集到 chunk 的映射，正文永远不进索引**——这就是上一课"便宜"的根源。

## 二、组件与两条路径

```text
图目的：Loki 的写入路径与查询路径，以及各组件职责与常见瓶颈位
写入: Promtail/Alloy → Distributor(校验标签/按流哈希) → Ingester×3副本(内存WAL→flush)
                                    ↑ 瓶颈位: 标签基数校验、副本数×内存
查询: Grafana → Querier/Query-Frontend(拆队列/缓存) → 读 chunk(对象存储)+索引(chunk index)
                                    ↑ 瓶颈位: 扫描字节数、缓存命中率
```

- **Distributor**：接 push（Loki 是推模型），校验标签合法性，按"流哈希环"把同一条流恒定路由到同一组 ingester，保证流内时序；
- **Ingester**：内存里攒流与 chunk，WAL 防丢，周期性 flush 到对象存储；3 副本（RF=3）是生产默认——查询时以最新副本为主读；
- **Query-Frontend + Scheduler + Querier**：大查询拆分片（split by time/size）、合并结果、缓存——宽窗口慢查询的治理都在这一层；
- **compactor**：对已 flush 的 chunk 做去冗余/归并，并执行保留期（retention）删除。
- 部署形态两档：`single-binary`（开发）与 microservices/Helm 分布式（生产）；中间态 `simple-scalable` 常从小团队起步。

## 三、标签纪律：Loki 的第一军规

标签只放**低基数维度**（每个值的组合都会开一条新流）：

| 放标签 ✅ | 放正文/结构化元数据 ❌ |
|-----------|----------------------|
| app/service、namespace、env、pod（随部署有界）、level、container | trace_id、user_id、order_id、URL 带参数、时间戳 |

- trace_id 这类关联键放 **structured metadata**（可点击跳转但不参与流标识），或干脆留在日志行里由 LogQL 行过滤命中；
- 基数护栏：`-distributor.max-global-streams-count`、per-user 速率限制、以及 Grafana 里观察 active streams 曲线——异常陡增即有人在打爆标签；
- 与 ES 的镜像关系：ES 怕 mapping 字段爆炸，Loki 怕流爆炸，本质都是"高基数进了索引结构"。

## 四、采集端落地（Alloy/Promtail + Spring Boot）

```yaml
# promtail 配置片段：目的——从 K8s 发现 payment-gateway 的 Pod 日志，只保留低基数标签
scrape_configs:
  - job_name: payment-gateway
    kubernetes_sd_configs:
      - roles: [pod]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: payment-gateway            # 结果：只采目标服务的 Pod
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace           # 说明：白名单搬运标签，防业务 label 直通流标签
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod                 # pod 名随部署有界，基数可控
    pipeline_stages:
      - json:
          expressions: { level: level, traceId: traceId }   # logback JSON 行提取字段
      - labels:
          level:                          # 错误做法：把 traceId 也放进 labels → 流基数失控
      - structured_metadata:
          traceId:                        # 正确：可跳转但不参与流标识
```

同一原理适用于 VM 场景：Alloy 的 `tail` + `stage.labels`。**推送侧要点**：Loki 是推模型，采集器挂了日志就断（无 Kafka 式缓冲），对可靠性敏感的场景给 Alloy 开本地 WAL/文件缓冲，或前置 Kafka（Loki 有 kafka front-end 写入通道）。

## 五、多租户与保留

标签集之外，每条数据还带 `X-Scope-OrgID` 租户头——按 team/env 隔离查询与配额（per-tenant 速率与保留期可不同）；单团队可固定 `single-tenant`。保留期由 compactor 按租户策略删 chunk（如平台日志 14 天、审计流 180 天），**删的是对象存储里的 chunk，索引随之收敛**——与 ES 按索引删除相比粒度更粗、无需 ILM 状态机。

## 六、关联技术

查询语言与 Grafana 联动在下一节 [LogQL 与 Grafana 集成](S1-2-Lesson.md)；与 ELK 的成本/能力对照见 [ELK vs Loki](../../elk/s1/S1-3-Lesson.md)；K8s 服务发现与 Pod 标签规范回到 [Kubernetes](../../kubernetes/s1/S1-1-Lesson.md)。
