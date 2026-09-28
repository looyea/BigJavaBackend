# LogQL 与 Grafana 集成 · 面试题

## 题 1：LogQL 的一条查询是怎么被执行的？成本在哪？

- 三段：`{标签选择器}` 走索引圈定流 → 行过滤/parser/显式过滤在圈定流上做扫描 → 可选外层聚合转指标；
- 成本几乎全在"扫描"这一段：标签圈得越宽、时间窗越大、正则越复杂，扫描字节越多；
- 结论口诀：**先想标签能圈多小**，再谈其它；这与 ES "词项命中倒排"的成本模型相反。

## 题 2：`|= "ERROR"` 和 `| json | level="ERROR"` 你会选哪个？

- 首选结构化：JSON 日志用 `| json | level="ERROR"` 精确按字段过滤，避免正文里"ERROR"字样（如堆栈、业务码）误命中；
- 子串过滤留给"字段未结构化或就是要在全文找"的场景，且它比 json 解析更省（不用逐行建字段）；
- 加分：说出解析器三件套成本排序 json/logfmt < regexp，以及 detect_labels 临时提标签不改变流。

## 题 3：怎么用日志算错误率告警？要注意什么坑？

- `sum by(app)(rate({env="prod"} | json | level="ERROR"[5m]))` 做分子，配合请求量指标做分母或直接阈值行数；
- 坑一：at-least-once 重放/回填让行数瞬时突刺误报——用 rate + for 持续窗口抑制；
- 坑二：分母若也用日志 count_over_time 会放大扫描，业务 QPS 应取 Prometheus；
- 加分：Grafana Unified Alerting 对 LogQL 原生支持，告警查询设 limit 防扫描风暴。

## 题 4：unwrap 能从日志算 P99 延迟，还要 Prometheus 吗？

- 能算但定位是"没打点时的补救"：`quantile_over_time(0.99, {...|json|unwrap duration[5m]))`；
- 三个短板：缺失字段的行被丢弃造成样本偏差、扫描成本高不适合看板常驻、精度受窗口与分桶限制；
- 正确分工：SLI/SLO 用指标系统，日志派生序列做临时分析；否则等于把 Loki 当 ES 用，成本模型崩。

## 题 5：日志→Trace→指标怎么串起来？

- 三支柱关联靠 traceId 贯通：logback MDC 注 traceId（OpenTelemetry 注入）→ Loki derived field 正则提 traceId 生成 Tempo 链接 → Tempo exemplar/指标反查；
- Grafana 数据源间 linking 配置是落地动作，值班动线"告警→trace 定瓶颈服务→一键看该服务该窗口日志"；
- 加分：说明 traceId 不能进 Loki 标签（基数爆炸），只能作为正文字段/structured metadata + derived field。

## 题 6：一个查询在生产把 Loki 拖慢了，你的处置顺序？

- 立即：Grafana 侧 kill 该查询、加 `limit`、缩窗口——止血；
- 定位：看是"标签过宽（流扇出大）"还是"正则回溯"还是"跨冷存储取数"，对应改查询或加缓存；
- 治理：query-frontend split by interval、结果缓存、`max_query_parallelism`/`rejected`限额、必要时把该高频全文需求迁去 ELK；
- 复盘：把"危险查询形状"写进值班规范，看板预置安全查询模板。
