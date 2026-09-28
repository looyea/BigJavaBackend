# PromQL 与直方图分位计算 · 小测

### 1. rate() 能作用于哪种指标类型？（6分）

- A. Gauge
- B. Counter（区间向量作参数）
- C. Histogram 的 _sum
- D. 任意类型结果都有意义

> 答案：B
> 解析：rate 语义是"累计值增速"；对 Gauge 用 rate 数学可算但业务无意义（应用 delta/直接看值）。

### 2. irate 与 rate 的区别是？（6分）

- A. irate 更快
- B. irate 只取窗口内最后两个样本，尖峰敏感适合调试；rate 用全窗口平均适合告警
- C. irate 只用于 Gauge
- D. 两者等价

> 答案：B
> 解析：告警用 irate 会因单点毛刺误报，看板排障用它才看得见瞬时突刺。

### 3. 计算服务级 QPS 的正确写法是？（6分）

- A. rate(sum(http_requests_total[5m]))
- B. sum(rate(http_requests_total[5m]))
- C. sum(http_requests_total) / 300
- D. rate(http_requests_total) * 5

> 答案：B
> 解析：先对每条序列求速率再求和；A 中 sum 在内先把序列加掉，rate 拿不到 reset 信息且语法也错。

### 4. histogram_quantile 的输入参数要求是？（6分）

- A. 原始 Histogram 对象
- B. 带 le 标签的速率向量（通常 sum by (le)(rate(_bucket[m]))）
- C. _count 序列
- D. 任意两个向量

> 答案：B
> 解析：必须保留 le 标签构造累计分布；漏掉 by (le) → le 被聚合掉 → 函数原样返回输入（经典错误）。

### 5. P99 落在最大有限桶与 +Inf 之间时，输出值是？（6分）

- A. 真实 P99
- B. 只能给到最大有限桶附近的插值/下界近似，精度失控
- C. NaN
- D. 自动扩桶

> 答案：B
> 解析：+Inf 桶无宽度可插值；说明尾部桶必须覆盖真实延迟上界，否则告警阈值形同虚设。

### 6. 两个向量相除报 "incompatible types for arithmetic operation / many-to-one" 首选处理？（6分）

- A. 重启 Prometheus
- B. 两侧用相同的 on(...) 标签匹配，多对一时显式 group_left
- C. 改用 offset
- D. 把窗口加大

> 答案：B
> 解析：默认要求一一匹配；聚合对齐标签或 group_left 声明多对一方向即可。

### 7. 查看"与上周同期相比的流量倍数"可用的语法是？（6分）

- A. http_requests_total last_week
- B. sum(rate(x[5m])) / sum(rate(x[5m] offset 1w))
- C. compare(x, 7d)
- D. window(x, 1w)

> 答案：B
> 解析：offset 修饰符把整条求值时刻平移，是大促容量对比的常用式子。

### 8. 关于 recording rules，正确的说法有（多选）？（9分）

- A. 把高开销聚合预计算成新序列（如 job:x:rate5m）
- B. 告警表达式引用预计算结果可显著降低评估开销
- C. 每次查询都会重新执行原始表达式
- D. 命名惯例用冒号分层：level:metric:operations

> 答案：A、B、D
> 解析：C 说反了——rules 按 evaluation_interval 周期预算，查询时直接读结果。

### 9. 均值(sum/count)可能掩盖真实劣化的场景包括（多选）？（9分）

- A. 长尾占比变化：慢请求变少但更慢，均值不变
- B. 双峰分布：一半 5ms 一半 500ms，均值 252ms 两侧都不准
- C. 流量整体翻倍
- D. 全部请求等比例变慢

> 答案：A、B
> 解析：均值对分布形状不敏感是本质缺陷；D 均值会同步变化所以能发现。C 与延迟无关。

### 10. 简答题：写出"订单服务 5 分钟错误率 >1% 且 QPS>10 才告警"的完整 PromQL，并解释每个片段的目的。（40分）

- 要点1：错误率 = sum by (service)(rate(http_requests_total{service="order",code=~"5.."}[5m])) / sum by (service)(rate(http_requests_total{service="order"}[5m]))，说明：分子分母同窗口同聚合标签才能相除
- 要点2：QPS 条件 = sum by (service)(rate(http_requests_total{service="order"}[5m])) > 10，目的：低峰期 1 个错误就 100% 误报，流量门槛过滤
- 要点3：组合表达式 `(错误率 > 0.01) and (QPS > 10)`，结果：and 按标签取交集，两侧都 by (service) 才可匹配
- 要点4：告警规则中再加 `for: 2m`，说明：持续 2 分钟才触发，消除瞬时抖动
- 要点5：窗口 [5m] ≥ 4 倍抓取间隔（15s），反例：[30s] 窗口遇一次抓取延迟即出现 no data 空洞

> 答案：见要点
> 解析：完整覆盖向量匹配、布尔过滤、and 交集与告警稳定性四个实战知识点。
