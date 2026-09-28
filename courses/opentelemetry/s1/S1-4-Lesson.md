# 与 SkyWalking/Prometheus 的关系（关联）

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：厘清 OTel 标准与 SkyWalking/Prometheus 产品的分工边界，掌握迁移与共存的落地方案。

## 一、定位差异：标准 vs 产品

```text
OpenTelemetry = 采集与传输的"标准 + 工具链"，不自带存储和查询 UI。
SkyWalking    = 开箱即用的 APM 产品（存储、分析、拓扑 UI 全都有）。
Prometheus    = 指标存储 + 查询引擎（生态以 pull + PromQL 为中心）。
结果：三者不是互斥竞品，最常见形态是"OTel 采集 → 后端任选"。
```

| 维度 | OTel | SkyWalking | Prometheus |
|------|------|-----------|------------|
| 覆盖信号 | Trace/Metric/Log | Trace/Metric/Log/事件 | 仅 Metric |
| 存储/UI | 无（对接任意后端） | BanyoDB/ES + 自带 UI | 本地 TSDB + Grafana |
| 协议 | OTLP | 私有协议(可开 gRPC) | Prom 拉取格式 |
| Java 埋点 | Agent 自动 | 官方 agent 自动 | micrometer 手动 |

## 二、SkyWalking 与 OTel 的互通

```yaml
# 目的：SkyWalking OAP 开启 OTel 接收能力（10.x native protocols）
selector:
  grpc:
    default:
      # 结果：OTel SDK/Agent 的 OTLP 数据可直接进 SkyWalking 后端
      disabled: false
# 说明：SkyWalking 官方支持 sw8 与 OTLP 双协议并收 —— 老服务不改造、新服务用 OTel
# 错误用法：认为"上了 OTel 就必须换掉 SkyWalking UI" → 迁移周期被无限拉长
```

- 概念对齐：SW 的 Segment ≈ OTel 的 Span 批次；sw8 Header ≈ traceparent，二者语义可映射。
- 趋势：SW 社区逐步向 OTLP 靠拢，OTel Collector exporter 也可把数据写入 SW。

## 三、Prometheus 与 OTel 的互通

```yaml
# 方向一：OTel → Prometheus（拉取模式，最稳）
exporters:
  prometheus:                 # Collector 暴露 :8889 指标端点
    endpoint: 0.0.0.0:8889
# 结果：Prometheus scrape 该端点，现有 PromQL/告警完全不变

# 方向二：OTLP push → Prometheus（原生支持）
# 启动参数 --enable-feature=otlp-write 后：
# OTel Collector exporter/prometheusremotewrite 直推 Prometheus
# 目的：统一 push 模型；错误用法：忘开特性开关 → OTLP 请求 404，指标静默丢失
```

- 直方图注意：OTel 显式桶与 Prom `le` 桶可互转，但 SDK 默认桶不一致 → 迁移后 P99 曲线"跳变"，需对齐桶定义。
- 语义差异：OTel 推荐视图（View）可改名/改桶，Prometheus 指标名带 `_total`/`_seconds` 后缀约定，转换层要开启 `prometheus` 兼容翻译。

## 四、迁移与共存路线图

```text
第 1 步：双探针并行 —— 存量 SW agent 不动，新服务用 OTel Agent。
第 2 步：Collector 统一入口 —— OTLP 进、按信号分发：Trace→ Tempo/SW，Metric→ Prom。
第 3 步：语义与桶对齐 —— 统一指标命名、直方图桶、 Exemplars 打通 Trace↔Metric。
第 4 步：收敛 —— 老服务逐步换 OTel Agent，后端 UI 视团队习惯保留。
反例：一次性全量替换 → 双份数据断裂 + 无人能排障，项目烂尾的最常见原因。
```

## 五、关联技术

- Exemplars：Prometheus 2.26+ 支持在指标点上挂 traceId，点击曲线直达 Trace（OTel 全链路采集后可用）。
- Grafana 是三者共同的展示层：Prom(QL) + Tempo(Trace) + Loki(Log) 组成 LGTM 栈。
- 与 OpenTracing/OpenCensus 的关系：两者已合并入 OTel，旧库仅做兼容层维护。
