# 与 OpenTelemetry 集成及选型（关联）

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：掌握 SkyWalking 接收 OTLP 数据的配置方式、双栈共存架构，并能给出 APM 选型的决策框架。

## 一、SkyWalking 侧：原生 OTLP 接收

```yaml
# 目的：OAP application.yml 开启 OTLP receiver —— OTel SDK/Collector 数据直入
receiver-otel:
  selector:
    otlpHTTP:
      metrics:
        enabled: true            # 结果：OTLP/HTTP 指标可收（经 OAL 函数转换入库）
    otlpGRPC:
      traces:
        enabled: true            # 说明：OTLP gRPC :4317 收 Trace
      logs:
        enabled: true
      metrics:
        enabled: true
# 注意：需为 OTel 流量配置 service 归组规则（agent-analyzer 的 OTel 定义），否则服务名取不到
# 错误用法：只开 traces 不开对应 analyzer 定义 → 数据进了 OAP 但 UI 空白（静默丢弃）
```

- 映射关系：OTel Span → SW Segment/Span（traceId/spanId/parent 语义对齐后入原流水线）。
- 好处：非 Java 语言（Go/Python/Node）用 OTel SDK，Java 用 SW Agent，一个后端两套探针。

## 二、OTel Collector 侧：导出到 SkyWalking

```yaml
# 目的：已有 OTel 采集体系，把 Trace 转投 SW 后端
exporters:
  otlp:
    endpoint: oap:11800          # 说明：直接用 OTLP exporter 指到 OAP（方向一）
  # 或 skywalking exporter（老方案，sw8 原生通道）：
  skywalking:
    endpoint: oap:11800
```

- 双向都通 —— 集成方向取决于"谁是事实标准层"：OTel 为主则 SW 只当后端；SW 为主则 OTLP 只是接入协议之一。

## 三、上下文传播的边界问题

```text
混编链路最大坑：SW 用 sw8、OTel 用 traceparent，两种格式并存的跳点必须转换。
方案A：边界服务双 Propagator（OTel CompositePropagator 加 sw8 扩展 / SW toolkit 读 traceparent）。
方案B：全部收敛到 W3C traceparent —— SW 9.x 支持配置传播头，新链路统一标准格式。
反例：中间服务只透传一种 → 链路在第二段断裂，两侧各自成 Trace（错误示例复现）。
```

## 四、选型决策框架

| 维度 | 选 SkyWalking | 选 OTel 栈（Tempo/Prom/Loki） |
|------|--------------|------------------------------|
| 团队画像 | Java 为主、要现成 UI/拓扑/告警 | 多语言、平台工程团队、愿自建 |
| 查询自由度 | 内置模型为主 | PromQL/TraceQL 全定制 |
| 厂商锁定 | 低（Apache 开源） | 最低（标准本身） |
| 存储运维 | ES/BanyanDB 二选一 | 各后端分散选型 |
| 云托管替代 | 各家商业版 | Datadog/阿里云 ARMS 等 SaaS |

```text
决策主线：
1. "买产品还是建标准" —— 无平台团队 → SW/商业 APM 直达；有平台团队 → OTel 采集 + 可换后端。
2. 拓扑/火焰图等产品能力刚需 → SW 省事；指标体系已深度 Prom 化 → OTel+Tempo 更连贯。
3. 折中（大厂常见终态）：OTel 统一采集层，Trace 后端灰度可换（SW/Tempo 双写对拍一个季度再定）。
```

## 五、迁移演练清单

```text
SW → OTel（或反向）切换前的验证项：
① 语义对齐：SW layer/endpoint 概念 ↔ OTel http.route/rpc.service 映射表评审；
② 指标连续性：切换期双写，对比 service_cpm 与 http.server.duration 聚合值（偏差<2% 过关）；
③ 告警平移：SW alarm 规则 ↔ Prom rules 一一对应，静默期内新旧并行只旧侧发声；
④ UI 习惯：给值班组 2 周新栈演练 + 保留旧入口（结果：以 MTTR 数据决定去留）。
错误做法：宣布"星期一切换"一步到位 —— 值班集体失能的最大来源。
```

## 六、关联技术

- SW 的 `receiver-zipkin`/`receiver-jaeger` 同类并存：多协议接收是 OAP 常态能力。
- OTel Semantic Conventions 与 SW 端点命名规范冲突时，以 Collector transform 统一纠偏（单点修复原则）。
- 回看本分区 opentelemetry s1-4：两边视角互补，选型章节建议对照阅读。
