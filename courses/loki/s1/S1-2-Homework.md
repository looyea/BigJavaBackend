# LogQL 与 Grafana 集成 · 作业

## 作业 1：LogQL 五连写（动手题）

**目标**：把 s1-2 的查询骨架用到熟练。

**任务**：针对标签 `{app, env, level}`、JSON 字段 `traceId/duration/msg`，写出并实测：
1. 查 payment 服务 prod 环境近 15 分钟所有 ERROR 行（用结构化过滤，不用子串）；
2. 在 1 基础上排除含 `circuit breaker` 的行；
3. 统计每个 app 近 5 分钟错误速率并按值排序 Top 5；
4. 用 unwrap 算 payment 服务 duration 字段的 5 分钟均值；
5. 从某条错误日志的 traceId 一键跳到 Tempo（配 derived field）。

**验收标准**：5 条查询均可在 Grafana Explore 执行并给合理结果；第 1 条若写成 `|= "ERROR"` 需说明差异；第 4 条要说明"为什么这只是参考不是 SLI"。

**参考解法要点**：3 用 `topk(5, sum by(app)(rate({env="prod"} | json | level="ERROR"[5m])))`；4 用 `avg_over_time({app="payment"}|json|unwrap duration[5m])`，缺失 duration 的行被忽略导致样本偏差。

## 作业 2：值班动线搭建（工程题）

**目标**：闭合"指标告警 → trace 定瓶颈 → 日志看细节"。

**任务**：
1. 在 Grafana 建一个服务健康看板：上半 Prometheus 指标（QPS/错误率/P99），变量 `$app` 驱动；
2. 下半嵌 Loki 面板：用 `$app` 联动日志查询，默认只看 ERROR；
3. 配置 Loki 数据源 derived field 提取 traceId 链接到 Tempo；
4. 写一条 Grafana Alert：错误速率 `sum by(app)(rate(...level="ERROR"[5m]))` 连续 5 分钟 > 阈值告警，通知到 Slack/邮件，附排障动线说明（点告警→看板→trace→日志）。

**验收标准**：改 `$app` 变量时日志面板与告警链接同步；能演示一次"制造错误日志→触发告警→点进 trace→看到对应日志行"的完整链路。

## 作业 3：查询性能诊断（分析题）

给出三条"慢/失败"的 LogQL（① `{app=~".+"} |~ ".*(timeout|fail|error).*" [7d]`；② 无 `limit` 的 `| json` 全字段聚合；③ 超宽窗口 unwrap quantile），分别指出成本来源与改写方案。**验收标准**：每条给出"为什么慢 + 改写 + 若仍要大范围该走哪条链路（该数据是否本就不该进 Loki）"三段式，并提到 query-frontend split/缓存与 `max_query_*` 限额的作用。
