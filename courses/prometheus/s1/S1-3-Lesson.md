# 服务发现、Exporter 与长期存储

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：掌握 Prometheus 服务发现机制与 relabel 流程、常用 Exporter 体系，以及 remote_write/Thanos/Mimir 长期存储选型。

## 一、服务发现（SD）：targets 从哪来

```yaml
# 目的：K8s 下用 Pod 注解自动发现抓取目标，扩缩容零改配置
scrape_configs:
  - job_name: spring-apps
    kubernetes_sd_configs:
      - role: pod                     # 说明：可选 node/pod/service/endpoints 等角色
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: "true"                 # 结果：只保留带 prometheus.io/scrape=true 注解的 Pod
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__ # 目的：注解自定义指标路径
        regex: (.+)
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)  # 输出：Pod label 转成指标标签 app=xxx
```

- SD 类型：static / file / kubernetes / consul / eureka / ec2 …（约 40 种）。
- 流程：SD 产出全量候选目标（带 `__meta_*` 标签）→ relabel 阶段过滤/改写 → 最终 targets。
- 错误用法：不做 keep 过滤直接抓全部 Pod → kubelet/CNI 等无关端点混入，序列翻三倍且疯狂报错。

## 二、relabel 三兄弟场景

```yaml
# 场景1：脱敏 —— 删除高基数标签
- action: labeldrop
  regex: "pod_name"
# 场景2：抓取出站改写 —— 改 host/端口（如经 kube-proxy 代理）
- source_labels: [__address__]
  target_label: __metrics_path__
  replacement: /metrics             # 说明：路径整体替换
# 场景3：modulus 采样 —— 只对 1/10 实例抓取（超大规模控成本）
- source_labels: [__address__]
  action: hashmod
  modulus: 10
- source_labels: [__tmp_hash]
  action: keep
  regex: "1"                        # 结果：稳定散列采样，扩缩容不抖动
# 反例：把 labeldrop 写进 relabel_configs（目标级）→ 样本真实标签不在 target 标签里 → 不起作用，应放 metric_relabel_configs
```

## 三、Exporter 体系

| Exporter | 采集对象 | 备注 |
|----------|----------|------|
| node_exporter | 主机 CPU/内存/磁盘/网络 | 每节点一个，Dcgm 管 GPU |
| mysqld_exporter | MySQL 状态/慢查询计数 | 需只读账号 |
| kafka_exporter | Broker/Topic/Lag | 消费组滞后监控 |
| blackbox_exporter | HTTP/TCP/ICMP 拨测 | 探活与证书到期 |
| jmx_exporter | 无埋点老应用的 JMX 指标 | javaagent 模式注入 |
| micrometer | Spring Boot 内嵌暴露 | 应用侧 SDK 而非独立进程 |

- 白名单原则：`--collector.*` 关掉用不到的采集器（node_exporter 全开约 1500 序列）。
- 结果：一个 blackbox 拨测替代"每个服务装探针"，公网入口可用性用 `probe_success` 度量。

## 四、长期存储与高可用

```text
单机 Prom 边界：本地磁盘保留期有限、无全局视图、重建即丢历史。
方案：remote_write 把样本异步推给远端：
  ├─ VictoriaMetrics：单二进制、省内存、PromQL 兼容（中小团队首选）
  ├─ Thanos：Sidecar 上传对象存储 + StoreAPI 全局查询（Prom 原生生态）
  └─ Mimir：多租户水平扩展（大规模/对外提供监控服务）
高可用：双 Prom 同配置独立抓取 + 前端去重（MergeDNS/Query 层），单机挂不掉监控。
错误示例：只跑一个 Prom 且 remote endpoint 写死 localhost → 主机故障=监控与历史双灭。
```

- 降采样：Thanos/Mimir 支持 5m→1h 压缩，一年趋势存储成本降 90%。
- 配置示例：

```yaml
remote_write:
  - url: http://vm:8428/api/v1/write   # 目的：推给 VictoriaMetrics 做长期存储
    queue_config: { max_samples_per_send: 10000 }  # 输出：批量降低网络开销
```

## 五、关联技术

- Push 替代形态：vmagent / Grafana Alloy 承担抓取+remote_write，Prom 只做查询（职责拆分）。
- 服务发现与注册中心复用：Consul/Eureka SD 让非 K8s 集群同样自动化。
- 下一小节：Alertmanager —— 把 `up == 0` 这类查询变成可靠的通知链。
