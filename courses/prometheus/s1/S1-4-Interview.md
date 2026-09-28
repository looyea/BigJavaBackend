# Alertmanager 告警与 Grafana 看板（关联） · 面试题

## 题 1：Prometheus 告警和 Grafana 告警，用哪个？

```text
Prom rules + Alertmanager：
  优势 —— 与抓取同源、生态成熟（inhibit/silence/分级的最佳实践多）、promtool 可测。
Grafana Unified Alerting：
  优势 —— 跨数据源（CloudWatch/Loki/ES 混查）、权限与看板一体。
结论：指标告警主力放 Prom/AM；需要"日志+指标混合判定"或已全 Grafana 化时收敛到 UA。
反例：两边同时开同一判定 → 双份通知互相矛盾（真实事故来源）。
```

## 题 2：pending 和 firing 的区别？告警恢复后为什么还收到通知？

- pending：表达式满足但 `for` 时长未满；firing：已越过 for，进入通知链路。
- 恢复后仍收到的是 resolved 通知：AM 默认发送状态翻转消息，用于确认"自愈 or 需要复盘"。
- 说明：`repeat_interval` 控制的是未解决告警的重复提醒节奏，与 resolved 是两回事。

## 题 3：如何设计"告警必须可行动"的规则评审流程？

1. 每条规则强制 annotation：action（做什么）+ runbook（怎么做）+ dashboard（去哪看）。
2. 月度噪音报表：按 fired 次数 × 处理动作统计，无动作率 >50% 的规则进下线评审（结果驱动）。
3. 新告警上线前跑 `promtool test rules` 单测：给定输入序列断言触发时机，防止表达式手误。
4. 反例说明：阈值"拍脑袋 90%"上线 → 每天 200 条 → 团队整体开始无视告警（告警疲劳比漏报更致命）。

## 题 4：值班收到"错误率 5% 告警"，标准的 5 分钟处置动线？

```text
1. 点开通知深链 → Grafana 确认影响面（哪些 service/接口/地域，错误率曲线形态）。
2. 看时间相关性：panel annotation 是否有发布/配置变更 → 有则先回滚。
3. exemplar/Trace 钻取：抽 3 条 5xx Trace 看共性（下游超时 or 某实例 500）。
4. 处置动作执行并在群内同步状态；恢复后开 silence 保护修复窗口（说明：防修复期轰炸）。
5. 事后：告警标记 acknowledged + 复盘单，输出规则是否需要调 for/阈值。
```

## 题 5：Grafana 看板加载很慢，从数据源到面板有哪些优化点？

- 查询层：rate 窗口过大、`.*` 全匹配、面板并发 30+ 查询 → 合并同源查询、用 recording rule 结果。
- 数据源层：Prom 跨长区间查原始精度 → 指向降采样数据源（5m 精度）。
- 面板层：time range 默认 7d 改 6h、开启面板级缓存（`min interval` 与 scrape 对齐避免过采）。
- 结果验证：Grafana `/metrics` 与浏览器 Network 面板看 query 耗时分布，逐条治理 Top5。

## 题 6：为什么"监控系统自身"必须被监控？举三个元监控点。

1. 双 Prom 互相 `blackbox` 拨测对方 `/-/healthy`（AM 集群同理）——监控系统挂 = 全员失明。
2. remote_write 积压、规则评估延迟（`prometheus_rule_evaluation_duration_seconds`）——监控"监控的 SLA"。
3. AM 通知成功率 webhook 打点：通知链路断 3 天没人发现，是最隐蔽的事故放大器（错误案例：网关证书过期静默失败）。
