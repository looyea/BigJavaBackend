# 熔断降级与系统自适应保护 · 面试题

## 题 1：Half-Open 状态具体怎么试探？

- Sentinel：timeWindow 到期后，**下一个**进来的请求放行试探（不是定时发心跳）。
- 试探成功（RT < 阈值 & 无异常）→ 状态回 Closed。
- 试探失败 → 状态回 Open → 重新计时 timeWindow。
- 与 Resilience4j 区别：R4j Half-Open 可配置允许的试探请求数（permittedNumberOfCallsInHalfOpenState）。

## 题 2：熔断后前端用户体验如何保障？

- 降级返回缓存/兜底数据 + 标记"数据可能延迟"。
- 关键交易类接口不应降级返回假数据 → 应明确告知用户"系统繁忙请稍后再试"。
- 异步补偿：降级期间写队列，恢复后补发。

## 题 3：系统保护 Load 阈值怎么定？

```text
经验公式：highestSystemLoad = CPU核数 × 2
例：4核 → 设 8.0
原理：Linux Load = 等待 CPU + 正在执行的线程数；> 核数×2 意味着排队严重
错误用法：设 1000 → 等于不配 → 系统被打挂才反应
```

## 题 4：Sentinel 与 Hystrix 熔断的核心差异？

| 维度 | Sentinel | Hystrix |
|------|----------|---------|
| 隔离 | 信号量（轻量） | 线程池（开销大） |
| 熔断策略 | 慢调用比例 + 异常比 + 异常数 | 只有异常比例 |
| 实时统计 | 滑动窗口（LeapArray） | 滚动时间窗采样 |
| 规则推送 | 动态热更新 | 需重启 |
| 现状 | 活跃维护 | 已停更 |

## 题 5：多个熔断规则同时命中怎么办？

- Sentinel 按规则列表顺序检测，**第一条触发即熔断**（短路）。
- 不同资源可各自独立熔断。
- 同一资源多条规则（慢调用 + 异常比）：任一触发 → Open。
- 系统规则与资源规则叠加：系统规则优先级最高（全局兜底）。

## 题 6：如何实现"核心链路不降级"？

```java
// 目的：对核心资源只限流不熔断（保证可用性）
// 说明：不给 createOrder 配 DegradeRule → 永远不走 fallback
// 只配 FlowRule QPS=500 → 超量排队但不拒绝
FlowRule rule = new FlowRule("createOrder");
rule.setControlBehavior(CONTROL_BEHAVIOR_RATE_LIMITER);  // 结果：排队而非熔断
rule.setMaxQueueingTimeMs(2000);  // 说明：最多等 2s
// 错误用法：核心接口配了熔断 → 下游稍慢即 Open → 用户下单全部失败
```
