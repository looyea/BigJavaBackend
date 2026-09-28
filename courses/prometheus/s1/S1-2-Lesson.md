# PromQL 与直方图分位计算

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：熟练运用 rate/irate 与向量匹配，掌握 histogram_quantile 原理、桶设计及平均耗时陷阱。

## 一、四种数据类型与语法速览

```text
即时向量 instant vector：某时刻的一组 (labels, value)   → http_requests_total
区间向量 range vector：  一段时间窗口内的样本集合        → http_requests_total[5m]（只能做函数参数）
标量 scalar：            纯数字                          → 15
字符串 vector：          常量串（少用）
运算符：= == != =~(正则) !~；聚合：sum/avg/min/max/count/topk/quantile + by/without
```

## 二、rate 家族

```promql
rate(http_requests_total[5m])    # 每秒增速：QPS 标准算法（ Counter 专用 ）
irate(http_requests_total[5m])   # 只用最后两个样本：对尖峰敏感，适合调试不适合告警
increase(http_requests_total[1h])# 一小时内增量：如"今天登录失败次数"
# 结果对比：流量突刺时 rate 曲线被 5m 窗口抹平、irate 立刻打尖 —— 选哪个取决于用途
# 错误用法：sum(rate(a[5m])) / sum(rate(b[1m])) —— 窗口不一致，比率抖动失真
```

- 窗口经验值：`[5m]` ≥ 4×scrape_interval，且不小于告警 for 时长的评估敏感区。
- `rate` 返回的是"该序列的每秒均值"，聚合前先 rate 再 sum（速率先算后加），顺序反了结果错。

## 三、向量匹配

```promql
# 错误率 = 5xx 速率 / 总速率，两侧标签必须对齐
sum by (service) (rate(http_requests_total{code=~"5.."}[5m]))
/
sum by (service) (rate(http_requests_total[5m]))
# 说明：两边都 by (service) 聚合掉 instance/code 等差异标签 → 一一对应可除

# 标签不齐时的显式匹配：
left * on(instance) group_left(service) kube_pod_info
# 目的：把元数据标签"贴"到指标上；错误用法：漏 group_left → many-to-one 直接抛错
```

## 四、histogram_quantile 原理

```promql
histogram_quantile(0.99,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
)
```

```text
计算过程（线性插值）：
1. 每个桶是累计计数：le="0.1" 包含所有 ≤100ms 的请求。
2. rate 后按 le 聚合成全局累计分布曲线。
3. 找 0.99 分位落点：在曲线上定位 + 桶内线性插值 → 输出估算值。
两个天生缺陷（面试高频）：
① 精度受桶宽限制：真值 123ms 落在 (0.1, 0.25] 桶 → 只能报 0.1~0.25 之间的插值。
② 超出最大桶不可见：所有请求都 <0.05s 时，P99 只能在 (0, 0.05] 内插 → 系统性偏差；
   反过来 P99 落在 +Inf 桶时输出=最大桶边界，结果只能当近似看。
```

## 五、桶设计与平均耗时陷阱

```java
// 目的：按 SLO 布桶 —— 承诺 P99<500ms，就要在 250ms~1s 之间布密桶
Timer.builder("http_request_duration")
     .serviceLevelObjectives(                       // 结果：SLO 附近桶精度最高
         Duration.ofMillis(100), Duration.ofMillis(250),
         Duration.ofMillis(500), Duration.ofMillis(1000))
     .register(registry);
```

```promql
# 平均耗时的正确算法与陷阱：
sum(rate(..._sum[5m])) / sum(rate(..._count[5m]))   # 均值 = Δ总量/Δ总数
# 陷阱示例：P50 从 20ms 恶化到 60ms，但 1% 长尾变少使均值纹丝不动 → 只看均值会漏掉劣化
# 结论：延迟看分位（P50/P95/P99 三线同屏），均值只做容量参考
```

## 六、常用实战查询

```promql
topk(5, sum by (pod) (rate(http_requests_total[5m])))          # 输出：QPS 前 5 的 Pod
avg_over_time(jvm_memory_used_bytes[1h])                        # 说明：区间均值（平滑毛刺）
deriv(node_load5[10m])                                          # 目的：线性回归斜率，判趋势
http_requests_total offset 1w                                   # 同比上周（容量对比）
absent(up{job="order-svc"})                                     # 序列消失告警兜底
```

## 七、关联技术

- Recording rules：把昂贵查询预计算成 `job:request_rate:5m`，告警与看板直接引用（降低 Prom 负载）。
- Metrics 与 Trace 联动：histogram exemplar 附带 traceId，P99 毛刺一键跳 Trace。
- 下一小节：服务发现与 Exporter —— 让上述查询有"活" targets。
