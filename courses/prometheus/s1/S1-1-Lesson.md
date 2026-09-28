# 数据模型与四种指标类型

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：掌握 Prometheus 时序数据模型、pull 拉取机制与 Counter/Gauge/Histogram/Summary 的正确选型。

## 一、数据模型：带标签的时间序列

```text
一条时间序列 = 指标名 + 标签键值对（label set）+ 一系列 (时间戳, 浮点值) 样本
http_requests_total{method="GET",path="/api/orders",status="200",instance="10.1.2.3:8080",job="order-svc"}
                 └─────────── 业务标签（埋点时定义）──────────┘└────── Target 标签（采集时附加）─────┘
目的：用标签维度表达"哪台机器、哪个接口、什么状态码"，查询时按任意维度聚合切片。
```

- 样本格式：`(timestamp_ms, float64_value)`，只存追加，不更新历史。
- 存储：2 小时一个 block，压缩后约 1~2 字节/样本（Gorilla XOR 编码）。

## 二、pull 拉取模型

```yaml
# 目的：Prometheus 每 15s 抓一次 /metrics 端点（scrape_config）
scrape_configs:
  - job_name: order-svc
    static_configs:
      - targets: ['10.1.2.3:8080', '10.1.2.4:8080']
    scrape_interval: 15s          # 说明：抓取周期，过密浪费资源、过疏丢失尖峰
    # 结果：up{job="order-svc",instance=...} 1=抓取成功 0=失败 —— 存活指标白送
```

- 优点：集中管理采集节奏、天然服务发现、目标无需知道 Prom 地址（方向：出站在目标侧为零配置）。
- 短生命周期任务（跑 30s 的批处理）来不及被抓 → 用 Pushgateway 中转。
- 错误用法：把 Pushgateway 当常规 push 通道 → 旧值永不衰减，指标"冻结"在最后一次推送。

## 三、四种指标类型

| 类型 | 语义 | 特点 | 典型场景 |
|------|------|------|----------|
| Counter | 只增不减 | 配合 rate() 看增速；重启归零由 Prom 自动处理 | 请求数、错误数、字节数 |
| Gauge | 可增可减 | 直接看瞬时值，不可用 rate | 队列长度、内存、活跃连接数 |
| Histogram | 分桶计数 | 服务端算桶，可聚合、可算分位 | RPC 延迟、请求大小 |
| Summary | 客户端算分位 | 预计算 quantile，不可跨实例聚合 | 单机精确分位（少用） |

```java
// 目的：micrometer 定义三种常用指标（Spring Boot Actuator 暴露 /actuator/prometheus）
Counter errors = Counter.builder("order_create_failures")
    .tag("reason", "inventory")            // 说明：维度标签，低基数才合法
    .register(registry);                    // 输出：errors_total 暴露给抓取
Gauge poolActive = Gauge.builder("hikari_connections_active", pool, HikariPoolMXBean::getActiveConnections)
    .register(registry);                    // 结果：瞬时值，随连接升降
DistributionSummary.builder("order_amount").publishPercentileHistogram()  // → Histogram 型
    .register(registry);
// 错误用法：把"当前在线用户数"做成 Counter → 只增不减，数值永远是错的（类型语义用反）
```

## 四、Histogram vs Summary 抉择

```text
Histogram 暴露：_bucket{le="0.01"} / _sum / _count 三条派生序列。
  → histogram_quantile(0.99, sum(rate(..._bucket[5m])) by (le)) 可跨实例聚合。
Summary 暴露：直接给出 quantile="0.99" 的值（滑动窗口客户端计算）。
  → 多实例时只能各算各的分位再平均 —— 数学上错误（分位数不可平均）。
结论：默认选 Histogram；Summary 仅单机且需要精确分位时用。
```

## 五、基数（Cardinality）红线

```text
序列数 = 各标签基数的笛卡尔积。
示例：path 有 200 个值 × status 5 个 × instance 300 个 = 30 万条序列（可接受）。
反例：把 userId 加进标签 → 千万用户 × 300 实例 → 内存爆炸、抓取超时（Prom 崩溃头号原因）。
结果：高基数进 Trace/Log，不进 Metrics；查询用 topk(10, count({__name__=~".+"})) 监控序列总数。
```

## 六、关联技术

- 指标名规范：`<域>_<对象>_<单位后缀>`，Counter 以 `_total` 结尾（micrometer/OTel 自动加）。
- 每次抓取会自动生成 `scrape_samples_scraped` 元指标，可审计单目标的序列量。
- PromQL 查询与分位计算见下一小节「PromQL 与直方图分位计算」。
