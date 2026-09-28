# 数据模型与四种指标类型 · 作业

## 作业 1：暴露三种类型指标

**目标**：在一个 Spring Boot 服务上用 micrometer 暴露 Counter/Gauge/Histogram 各一。

1. 引 `micrometer-registry-prometheus` + Actuator，访问 `/actuator/prometheus` 确认端点输出。
2. 定义下单 Counter（含 `code` 标签）、Hikari 活跃连接 Gauge、下单耗时 Histogram。
3. 制造不同 code 请求与不同耗时请求，curl 端点核对 `http_requests_total` / `_bucket` 序列变化（输出验证）。
4. 反例实验：新增 `orderId` 标签并发 100 单，观察端点序列数暴涨，说明高基数后果。

## 作业 2：pull 模型与 up 指标

**目标**：理解抓取节奏与存活判定。

1. 配 Prometheus `scrape_interval: 5s` 抓该服务，图上看 `up{job=...}`。
2. 停掉服务进程，观察 `up` 在下一个抓取点由 1 变 0（结果：约 5~10s 内告警可见）。
3. 记录 `scrape_samples_scraped` 数值，估算单实例序列总量。
4. 思考题：为什么 Counter 中途重启，rate 曲线仍是连续的？用 `rate(...[1m])` 验证。

## 作业 3：Histogram 与 Summary 对比

**目标**：用数据证明"Summary 不能跨实例聚合"。

1. 同一接口分别埋 Histogram 与 Summary（`publishPercentiles`）。
2. 起 3 个实例、让延迟分布各不相同，用两种方法各算集群 P99。
3. 对比：Histogram 走 `sum(_bucket) by (le)` 得到的 P99，与"把 3 个 Summary quantile 求平均"的偏差（说明后者系统性偏离）。
4. 输出结论段落：何时无脑选 Histogram，Summary 唯一合理场景是什么。
