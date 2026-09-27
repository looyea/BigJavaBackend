# 滑动窗口与流控效果 · 面试题

## 题 1：Sentinel 滑动窗口和 Guava RateLimiter 的区别？

| 维度 | Sentinel LeapArray | Guava RateLimiter |
|------|-------------------|-------------------|
| 算法 | 滑动窗口统计 | 令牌桶（SmoothBursty） |
| 粒度 | 多窗口+多维度（QPS/线程/关联/链路） | 只有 QPS |
| 功能 | 限流+熔断+系统保护+热点 | 纯限流 |
| 动态 | 规则热更新 | 仅 setRate 可改 |

## 题 2：为什么需要 Warm Up 模式？

冷启动问题：服务刚重启 → 缓存空 + 连接池未建立 + JIT 未优化。
瞬间全量流量进来 → RT 飙升 → 大量超时 → 雪崩。
Warm Up 让通过的 QPS 从 count/coldFactor 线性升到 count → 给系统"热身"时间。

## 题 3：漏桶（RateLimiter 排队模式）适合什么场景？不适合什么？

- **适合**：MQ 消费削峰、异步任务、调用第三方 API（可排队等待）。
- **不适合**：同步 HTTP（用户体验等不起）、实时交易系统。
- 原理：`maxQueueingTimeMs` 控制最大排队时长 → 超时则拒绝。

## 题 4：链路限流的典型应用场景？

```text
同一 /createOrder 接口：
- 来自 App 入口 → QPS 限 500
- 来自 第三方开放平台 → QPS 限 50
- 来自 内部管理后台 → 不限
通过 origin(来源) 区分 → 互不影响
```

## 题 5：Sentinel 规则加载顺序？

```text
启动 → 读本地 classpath 规则(兜底) → 连接 Nacos/Apollo → 拉取最新规则
→ 注册 PropertyListener → 后续变更实时推送 → FlowRuleManager.loadRules()
```

- Dashboard 手动改规则 → 只存内存 → 应用重启丢失。
- 持久化配置后 Dashboard 改动 → 写 Nacos → SDK 监听变更 → 自动刷新。

## 题 6：线程数限流和 QPS 限流怎么选？

- QPS 限流：适合 RT 稳定的接口（如查询列表 ~50ms）。
- 线程数限流：适合 RT 波动大的接口（如报表导出 100ms~10s）。
  - 原因：100 QPS 但每个请求 RT=5s → 并发 500 线程 → OOM。
  - 线程数=20 → RT 高时自动收紧（通过率低 → QPS 自然下降）。
