# 服务拓扑、指标与分析、告警

> 本节难度：★★★★☆
> 重要程度：★★★☆☆
> 学习产出：掌握 SkyWalking 三级指标模型（服务/实例/端点）、自动拓扑生成原理、LAL 日志分析与告警规则配置。

## 一、三级指标模型：Service → ServiceInstance → Endpoint

```text
每个层级都有标准 METRIC 家族（OAP 内置遥测定义）：
- service_cpm / service_sla / service_resp_time_percentile（P50/75/90/95/99）
- service_instance_* 与 service_instance_endpoint_* 同族下钻
维度关系：服务看面 → 实例看点（哪台机器）→ 端点看入口（哪个接口）。
错误排障路径：直接翻 Trace 大海捞针；正确路径：三级指标逐层收窄再跳 Trace。
```

- 端点自动发现：从 Entry Span 的 operationName 收集，新端点 15 分钟内进指标（可配刷新）。
- `service_top_n_metrics` 支持"最慢 TOP N 服务/端点"榜单开箱即用。

## 二、自动服务拓扑

```text
生成原理：不是配置出来的，是从 Trace refs + Metric 关系流聚合：
  调用边（client→server service）→ 边上的 cpm/resp_time/sla 指标
  节点 = 服务；外部依赖（DB/MQ/第三方 HTTP）自动挂为依赖节点。
两套视图：
  Service Topology     —— 服务间
  Service Instance Topology —— 实例间（Dubbo/SkyWalking 探针才有人到人的边）
Virtual Service / Database / MQ 节点：未装探针的第三方以"虚拟服务"入图（目的：拓扑完整不失真）。
```

- 追问点：拓扑边延迟是“调用发起方视角”的耗时（含客户端序列化与网络往返），不等于服务端处理耗时 —— 两者差值恰好可用于定位网络问题。

## 三、分析功能族

| 功能 | 数据来源 | 用途 |
|------|----------|------|
| 慢 SQL 追踪 | mysql 插件 Statement Span | 按耗时排行定位烂 SQL |
| 端点压力分析 | endpoint 流量分布 | 识别热点接口/异常突刺 |
| Profiling（线程级） | Agent 按需触发采样 | 方法耗时火焰图，无需重启 |
| Log 关联 | logappender / FileCollector | TraceId ↔ 日志双向跳转 |
| 事件（Event） | Kafka/Webhook 注入发布事件 | 曲线上的变更标记 |

```java
// 目的：Logback 接 SKYWALKING traceId —— 日志 Appender 方案
<appender name="grpc-log" class="org.apache.skywalking.apm.toolkit.log.logback.v1.x.log.GRPCLogClientAppender">
    <encoder><pattern>%msg</pattern></encoder>   <!-- 说明：traceId 由 OAP 侧关联，不用写 %X -->
</appender>
// 错误用法：自己 MDC.put(traceId) 去查 ES —— 两套体系，UI 无法一键跳转
```

## 四、LAL：日志分析语言

```yaml
# 目的：从"结构化日志流"里再算指标（如按错误码聚合计数）
rules:
  - name: payment-log
    watch:
      - source: { name: [payment-service] }     # 绑定服务
      - filter: { and: [ { tag: level == "ERROR" } ] }
    detector:
      - pattern: { on: "content", regex: "CODE:(\\d+)" }   # 提取错误码维度
    metrics:
      - name: payment_error_cpm
        function: { cpm: {} }
        # 输出：新指标进 UI 可查询、可被告警引用
```

- LAL 与"原生指标"同一套 Aggregation 引擎，区别只是 source 是 Log 流。
- 反例：所有解析逻辑塞 Groovy script 无人维护 —— pattern 层可解释优先（结果可读性）。

## 五、告警（Alarm）

```yaml
# 目的：alarm-settings.yml —— 规则即配置，评估在 OAP 内完成
rules:
  service_sla_rule:
    metrics-name: service_sla          # 指标名（三级模型任意指标）
    threshold: 9800                    # 单位是 ‱（SLA 98% = 9800）
    op: <
    period: 10                         # 说明：最近 10 分钟窗口
    silence-period: 5                  # 结果：触发后 5 分钟内不重复轰炸
    message: "订单服务 SLA 跌破 98%"
  service_resp_time_percentile_rule:
    metrics-name: service_percentile
    value: 99                          # P99
    threshold: 1000
```

- 通知渠道插件化：webhook / 钉钉 / 企微 / Slack / 邮件；Webhook 可再转 Alertmanager 统一治理。
- 与 Prometheus 告警差异：SW 无 PromQL，规则表达式 = 指标+阈值+算子；复杂跨指标逻辑要靠 LAL 先合成指标。

## 六、关联技术

- Mesh Adapter / SW-Adapter 可把拓扑指标推给 Prometheus 生态，Grafana 画 SW 数据。
- Profiling API 可脚本触发（对单端点采样 N 分钟），大促压测标配。
- 下一小节：与 OpenTelemetry 集成及选型 —— sw8 与 OTLP 双轨世界的取舍。
