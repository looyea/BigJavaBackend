# 数据模型与四种指标类型 · 面试题

## 题 1：Counter 和 Gauge 的本质区别？为什么不能反过来用？

- Counter 单调递增，语义是"累计发生了多少次"，速率由 rate 派生。
- Gauge 可增可减，语义是"现在是多少"。
- 反用后果：把"在线人数"做成 Counter → 只能加不能减，永远高估；把"请求总数"做成 Gauge → 重启归零 + 无法算速率，告警逻辑全崩。

## 题 2：rate() 和 increase() 的关系与使用窗口？

```text
rate(x[m])   = 每秒平均增速；increase(x[m]) = rate(x[m]) * 窗口秒数 = 区间增量。
窗口选择：至少覆盖 4 个 scrape 点，否则样本稀疏 → 曲线锯齿/丢数（结果不准）。
追问：为什么告警常用 [5m] 不用 [1m]？答：[1m] 抖动大易误报，[5m] 更平滑。
```

## 题 3：为什么"分位数不能求平均"？

```text
反例：实例A 100 请求 P99=10ms，实例B 10 请求 P99=1000ms。
求平均 (10+1000)/2=505ms —— 忽略了样本量权重，严重失真。
正解：Histogram 把请求按桶计数，sum 后再在合并分布上算分位 → 数学正确。
```

## 题 4：Prometheus 存全量历史吗？如何做长期存储？

- 本地 TSDB 默认只保留 15 天（`--storage.tsdb.retention.time`），非全量。
- 长期：远端写 remote_write → Thanos / Mimir / VictoriaMetrics（对象存储、降采样）。
- 说明：Prom 定位"近期高精度 + 告警"，历史趋势交给远端长期存储层。

## 题 5：一个 /metrics 端点返回很慢或超大，可能什么问题？

```text
1. 高基数：序列数过多 → 序列化耗时（用 scrape_samples_scraped 定位）。
2. Gauge 回调里做重活：micrometer 抓取时才执行 lambda（如扫全表统计）→ 阻塞抓取。
结果：scrape timeout，up=0，看似服务挂了其实是埋点写错。
修正：重计算异步刷新到缓存值，Gauge 只读缓存。
```

## 题 6：标签命名与指标命名有哪些规范？

- 名用 `snake_case`，单位后缀标准化：`_seconds`、`_bytes`、`_total`（Counter）。
- 标签基数从低到高排列思维：job/instance 由 Prom 注入，业务标签保持枚举级。
- 目的：与 Exporter 生态、Grafana 模板、告警规则保持一致，降低查询心智负担。
- 反例：同一含义多种写法（`code`/`status`/`http_status`混用）→ 聚合查询漏序列。
