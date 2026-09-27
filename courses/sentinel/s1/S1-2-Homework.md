# 熔断降级与系统自适应保护 · 作业

## 作业 1：慢调用熔断验证

**目标**：模拟下游变慢触发熔断→恢复。

1. inventory-service 接口正常 100ms 响应。
2. 配置：慢调用阈值=200ms，比例=50%，statInterval=10s，timeWindow=5s。
3. 用 JMeter 10 QPS 请求 inventory。
4. 中途让 inventory 接口 sleep 500ms → 观察 Sentinel Dashboard 状态从 Closed→Open。
5. 恢复 inventory → 等 5s → 观察 Half-Open→Closed。

## 作业 2：降级 fallback 实战

**目标**：Feign fallback 返回缓存兜底数据。

1. product-service 正常返回商品详情。
2. 配置 DegradeRule：异常比 50%，timeWindow=10s。
3. product-service 抛异常 → 触发熔断。
4. ProductClientFallback 从 Caffeine 本地缓存返回（提前写入）。
5. 前端体验：短暂显示"数据可能延迟"标识。

## 作业 3：系统保护规则

**目标**：模拟高负载触发系统级拒绝。

1. 设置 SystemRule：highestSystemLoad=4.0（4核机器测试）。
2. 启动 CPU 密集任务使 Load > 4。
3. 此时所有入口请求被拒绝（返回 429）。
4. 停止 CPU 任务 → Load 回落 → 自动恢复。
5. 观察 Dashboard 系统监控曲线。
