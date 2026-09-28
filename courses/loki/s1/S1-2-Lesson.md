# LogQL 与 Grafana 集成

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：能写 LogQL 的两类查询（日志流查询与指标查询），用 parser 做字段提取与过滤，在 Grafana 里配置 derived field 实现日志→链路跳转，并基于 LogQL 搭出可用的告警。

## 一、两类查询一个语法树

LogQL = **日志查询**（返回行）与在其外包一层的**指标查询**（返回序列）。骨架：

```text
图目的：LogQL 语法骨架——先选流（索引），再过滤行（扫描），最后可选地聚合为指标
{app="payment", env="prod"}        # 1 选择器：只走标签索引，圈定流
  |= "timeout"                     # 2 行过滤：对圈定流的正文逐行匹配（扫描成本）
  | json                           # 3 解析器：把行解析成字段（json/logfmt/regexp）
  | level="ERROR"                  # 4 显式过滤器：对解析出的字段做条件
  → 外层: rate(... [5m]) / count_over_time(...) / unwrap 聚合 → 指标
```

执行顺序就是成本顺序：**选择器进索引，其余全部是扫描**——写查询时先想"标签能圈多小"。

## 二、日志查询实战

```logql
# 目的：四个由浅入深的排障查询，注意每行的成本来源
# 1) 最便宜：标签 + 子串（Grafana Explore 的常用形态）
{namespace="prod", app=~"payment|order"} |= "ORDER_PAID" | limit 50   # 日志查询用 limit 收敛回传量，排序交给 Grafana 面板

# 2) 行过滤组合：AND 语义竖线串联；!= 与正则 =~ !~
{app="payment-gateway"} |= "timeout" |!~ "retry succeeded" | json

# 3) 指标型：json 解析后按字段过滤，unwrap 抽数值字段再聚合
avg_over_time({app="payment-gateway"} | json | level="ERROR" | unwrap duration [5m]) by (method)

# 4) 错误用法：无选择器直接全文——语法不合法（LogQL 必须以 {selector} 开头），
#    以及 {app=~".+"} 匹配所有流，扫描量失控，异常表现：query 被 max_query_length/并行度拒绝
```

- 解析器三件套：`| json`（结构化日志首选）、`| logfmt`（key=value 文本）、`| regexp "..."`（兜底，最贵）；
- `| detect_labels` 能把 logfmt 里的 key 临时提成标签用于过滤而**不改变流**——排查时好用，别养成依赖。

## 三、指标查询：从日志算出可告警的序列

- `count_over_time({app="x"} |= "ERROR" [5m])`：数行数；
- `rate(...[5m])`：行/秒，做错误率分子；
- `avg_over_time({app="x"} | json | unwrap latency [5m]) by (method)`：从日志字段抽数值再聚合（**前提**：字段一致且低基数分组，否则等价于把 Loki 当 ES 用）；
- `quantile_over_time(0.99, ...)` 可做 P99 近似，但精度受采样窗口与 unwrap 缺失值影响，重要 SLI 仍应以指标系统为准——日志派生指标是"没有打点时的补救"。

## 四、Grafana 集成三要素

1. **数据源与 Explore**：Loki 数据源指向 query-frontend；为值班建 Explore 快捷查询（saved queries）与"点服务名下钻日志"的 dashboard 变量联动（`$app` 模板变量喂给选择器）。
2. **derived fields（日志→Trace）**：数据源映射里加 derived field，正则从行中取 `traceId=(\w+)`，配 Tempo/Jaeger 链接——排障动线"指标告警 → trace 定位慢服务 → 一键跳该服务该时间窗日志"就闭合了。
3. **告警（Grafana Alerting）**：查询类型选 LogQL，条件如 `err_count > 50 for 5m`；注意 at-least-once 链路重放会瞬时抬行数——阈值型告警优先用 `rate` 而非裸 `count_over_time`，并给告警查询设 `limit` 防扫描风暴。

## 五、性能与表达力边界

- 宽窗口 + 高扇出 = 超时：用 query-frontend 的 split by interval 自动切片，配合结果缓存（历史时段不可变，缓存友好——这是 Loki 比 ES 天然的优势之一）；
- 全文能力缺失是模型决定的：`|~` 是逐行正则不是索引；高频"任意词检索"需求要么改日志结构（把关键词变成低基数标签/字段），要么该流迁去 ELK（呼应 [ELK vs Loki](../../elk/s1/S1-3-Lesson.md)）；
- 聚合看板克制使用 unwrap：60 服务 × 全量日志的数值聚合扫描成本会反超预期，业务指标请回 Prometheus。

## 六、关联技术

标签模型与基数护栏见 [Loki 架构与标签模型](S1-1-Lesson.md)；选型对照见 [与 ELK 选型对比](S1-3-Lesson.md)；日志→Trace 跳转的另一半依赖链路上下文，见 [OpenTelemetry 分布式追踪](../../opentelemetry/s1/S1-1-Lesson.md)（traceId 贯通与采样策略）。
