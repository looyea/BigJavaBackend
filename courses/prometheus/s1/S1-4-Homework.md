# Alertmanager 告警与 Grafana 看板（关联） · 作业

## 作业 1：搭建 Prom → AM → IM 通知链

**目标**：跑通一条真实触达的 critical 告警。

1. 部署 Alertmanager（单节点），配 webhook receiver 指向自建 echo 服务，日志打印收到的告警 JSON（输出验证分组结构）。
2. 写规则：`up == 0` for 1m severity=critical；停掉一个 exporter 验证 pending→firing 两阶段（说明时间点）。
3. 恢复后再触发 3 个不同 job 的告警，观察 group_by 生效：一条聚合通知包含 3 个告警实例。
4. 反例：matchers 写 `severity=critical` 而规则标签是 `severity: Critical`（大小写不同）→ 不路由，记录排查过程。

## 作业 2：抑制与静默演练

**目标**：模拟机房故障，验证噪音治理。

1. 造两条规则：NodeDown（instance 级）与 ClusterDown（`count(up==0) by (cluster) > 3`）。
2. 配 inhibit_rule：ClusterDown 压制同 cluster 的 NodeDown；批量停 5 个 target。
3. 验收：通知里只出现 1 条 ClusterDown（结果检查），恢复后子告警重新可见。
4. 用 `amtool silence add cluster=test -c "演练" --duration=30m` 屏蔽演练流量，到期自动解除（说明留痕）。

## 作业 3：RED 服务看板工程化

**目标**：一个 JSON 支撑全部微服务的标准看板。

1. 建模板变量 `$service`（label_values 来自 http_requests_total）。
2. 三个面板：QPS=`sum(rate(...{service=~"$service"}[5m]))`、错误率、P50/P95/P99 三线图；开启 Repeat by service 生成对比行。
3. 面板 Links 添加 Tempo/ Jaeger traceId 跳转（exemplar 或变量拼接），点击延迟毛刺可查 Trace。
4. 同一 PromQL 派生告警规则并在通知 annotation 中放本面板深链（含 var-service），验收：从通知点开即定位到该服务视图。
