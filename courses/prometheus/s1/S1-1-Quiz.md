# 数据模型与四种指标类型 · 小测

### 1. Prometheus 一条时间序列的唯一标识是？（6分）

- A. 只有指标名
- B. 指标名 + 完整标签集（label set）
- C. 实例 IP
- D. 时间戳

> 答案：B
> 解析：同名指标不同标签 = 不同序列；`{__name__="x",env="prod"}` 与 env="dev" 是两条。

### 2. Prometheus 采集指标的网络方向是？（6分）

- A. 应用主动 push 到 Prom
- B. Prom 主动 pull 应用的 /metrics 端点（Pushgateway 除外）
- C. 双向 gRPC 流
- D. 依赖 Kafka 中转

> 答案：B
> 解析：pull 模型集中控节奏、天然产出 up 存活指标；短任务才走 Pushgateway。

### 3. 进程重启导致 Counter 归零，rate() 会怎样？（6分）

- A. 算出负数
- B. Prom 自动识别 counter reset，按归零前值补算，结果不失真
- C. 必须手动重置窗口
- D. 直接报 NaN

> 答案：B
> 解析：rate 检测到值下降即视为 reset，把下降段按"从 0 起算"处理。

### 4. 监控"消息队列当前积压深度"应选的类型是？（6分）

- A. Counter
- B. Gauge
- C. Histogram
- D. Summary

> 答案：B
> 解析：积压量可增可减是瞬时值 → Gauge；Counter 只增不减表达不了"降回去"。

### 5. 多实例服务要聚合全局 P99 延迟，应选？（6分）

- A. Summary，把各实例 quantile 求平均
- B. Histogram，聚合 _bucket 后再 histogram_quantile
- C. Counter
- D. 任意类型都可以

> 答案：B
> 解析：分位数不可平均（数学错误）；Histogram 桶计数可 sum 后再算分位。

### 6. Pushgateway 的正确使用场景是？（6分）

- A. 所有微服务统一改 push 模式
- B. 短生命周期批处理任务，push 结果由 Prom 来拉
- C. 替代服务发现
- D. 存储历史数据

> 答案：B
> 解析：短任务活不过一个 scrape 周期才需要中转；滥用会让旧值永不更新（冻结）。

### 7. 以下哪个标签设计会触发高基数风险？（6分）

- A. status="200|500"（枚举几个值）
- B. path="/api/orders/{id}" 路由模板
- C. userId=每个登录用户
- D. region=华东/华北等 5 个值

> 答案：C
> 解析：userId 基数 = 用户量级，序列数爆炸；个体维度应查 Trace/Log。

### 8. Histogram 类型暴露的派生序列包括（多选）？（9分）

- A. 指标名_bucket{le=...}
- B. 指标名_sum
- C. 指标名_count
- D. 指标名_quantile{q="0.99"}

> 答案：A、B、C
> 解析：D 是 Summary 的输出形态；Histogram 的分位在查询侧由 histogram_quantile 计算。

### 9. 关于 pull 模型优缺点，正确的说法有（多选）？（9分）

- A. 目标机器无需配置 Prom 地址，安全方向统一出站
- B. 天然通过 up 指标感知目标存活
- C. 对 Autoscaling 频繁伸缩场景必须配合服务发现
- D. push 模型在过载时更容易导致雪崩，所以 pull 无任何缺点

> 答案：A、B、C
> 解析：D 前半句成立但"无缺点"错误——pull 有实时性受 scrape_interval 限制、内网穿透方向等问题。

### 10. 简答题：为一个电商下单接口设计指标集，说明类型选择与标签方案，并指出两个必须避免的坑。（40分）

- 要点1：order_create_total{path,code} Counter，查询 rate 得 QPS、按 code 算错误率，说明：Counter+rate 是流量类唯一正解
- 要点2：order_create_seconds Histogram（桶覆盖 5ms~2s），跨实例 sum(bucket) 后算 P99，目的：延迟分布可聚合
- 要点3：stock_lock_active Gauge 表达锁库存并发瞬时值，结果：随升降双向变化符合语义
- 要点4：标签只用低基数维度（路由模板 /order/create，禁止带 orderId、userId），反例：个体 ID 入标签 → 序列爆炸
- 要点5：坑一 = 用 Summary 做集群分位（不可平均）；坑二 = 看板直接画 Counter 原始累计线（应画 rate，否则重启归零看着像"错误恢复"）

> 答案：见要点
> 解析：考察类型语义理解与基数红线意识，这两点决定 Prom 能否长期活下去。
