# 数据源与面板/查询编辑 · 作业

## 作业 1：三数据源接入与验证

**目标**：跑通 Prom + Loki（或 ES）+ MySQL 三类数据源。

1. Docker Compose 起 grafana，依次接入三个数据源，全部通过 Save & test。
2. 各用 Explore 跑一条真实查询（Prom 查 up、Loki 查 count_over_time、MySQL 查一条表统计），输出截图/结果说明。
3. 故意把 Prom URL 写成 `http://localhost:9090`（Grafana 在容器内）→ 复现"健康检查失败"，再改为服务名修复（说明容器网络原因）。

## 作业 2：RED 面板 + 变量联动

**目标**：一个页面管所有服务。

1. 建 Query 变量 `$service` = `label_values(http_requests_total, service)`，开启 Multi 与 All。
2. 三面板：QPS、错误率、P99，查询全部注入 `service=~"$service"`；P99 面板用 Repeat by service 自动生成每服务小图。
3. rate 窗口改用 `[$__interval]`，缩放 1h→7d 观察步长自适应（说明点数变化）。
4. 验收：URL 分享带 `var-service=order`，他人打开直接锁定下单视图（结果验证）。

## 作业 3：Transforms 组装复合指标

**目标**：PromQL 不动，面板层算"每实例平均负载排名"。

1. Query A：`sum by (instance) (rate(cpu_seconds_total[5m]))`（Format: Table）。
2. Query B：`count by (instance) (http_requests_total)`。
3. 用 Join by field(instance) + Add field from calculation（A/B）生成"每请求 CPU 成本"列，Organize 隐藏原始列并按其排序，输出 Top10。
4. 反思题：同样的 Join 若放在 recording rule 里做，有什么利弊？写 3 行（提示：口径复用 vs 存储成本）。
