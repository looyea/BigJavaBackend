# 滑动窗口与流控效果

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：理解 Sentinel 滑动窗口统计原理，掌握三种流控阈值模式（直接/关联/链路）和四种流控效果。

## 一、滑动窗口统计

```text
┌─── 1s 统计窗口 ───┐
│ Window1 │ Window2 │ Window3 │ Window4 │ (每窗 250ms)
│  pass=5 │  pass=3 │  pass=8 │  pass=2 │  ← 各窗内通过数
└───────────────────────────────────────┘
总 QPS = sum(pass) / 1s = 18
```

- Sentinel 用 `LeapArray`（环形数组）实现滑动窗口。
- 每个 Window 存 `pass`/`block`/`success`/`exception`/`rt`。
- 窗口滚动：旧窗口重置 → 新窗口开始统计。

## 二、流控维度（grade）

```java
// 目的：QPS 限流——每秒通过请求数
FlowRule rule = new FlowRule("createOrder");
rule.setGrade(RuleConstant.FLOW_GRADE_QPS);  // 结果：按 QPS
rule.setCount(100);                            // 输出：100 QPS

// 目的：线程数限流——并发线程超标即拒绝
FlowRule threadRule = new FlowRule("payQuery");
threadRule.setGrade(RuleConstant.FLOW_GRADE_THREAD);  // 结果：按并发线程
threadRule.setCount(20);                                // 说明：超过 20 并发直接拒绝
```

## 三、流控模式（strategy）

### 3.1 直接限流

资源 A 自身 QPS 达阈值 → 拒绝 A 的后续请求。

### 3.2 关联限流

```java
// 目的：writeOrder QPS 过高 → 限制 readOrder（保护写优先）
FlowRule rule = new FlowRule("readOrder");
rule.setStrategy(RuleConstant.STRATEGY_RELATE);
rule.setControlBehavior("writeOrder");  // 说明：参照资源
rule.setCount(50);  // 结果：writeOrder QPS>50 → readOrder 被限
```

### 3.3 链路限流

```text
入口A → /service/order   ← 只对经由 A 的调用限流
入口B → /service/order   ← B 不受影响
```

- `resource + limitApp`（调用来源）组合唯一确定一条链路。

## 四、流控效果（controlBehavior）

| 效果 | 机制 | 适用 |
|------|------|------|
| 快速失败 | 超阈值立即抛 FlowException | 普通接口 |
| Warm Up | 冷启动阈值=count/(coldFactor)，逐步升到 count | 缓存预热/连接池 |
| 排队(RateLimiter) | 漏桶——匀速排队，超过 maxQueueingTimeMs 则拒绝 | 突发流量削峰 |

```java
// 目的：Warm Up——QPS 阈值 100，coldFactor=3 → 冷启动从 33 QPS 开始预热
FlowRule warmUp = new FlowRule("search");
warmUp.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_WARM_UP);  // 输出：预热模式
warmUp.setWarmUpPeriodSec(10);  // 说明：10s 内从 33 → 100 线性增长
warmUp.setCount(100);            // 结果：预热完成后正常限流
// 错误用法：服务启动瞬间大流量进来不设 Warm Up → 连接池/缓存未就绪 → 大量超时
```

```java
// 目的：RateLimiter——匀速排队
FlowRule rateLimiter = new FlowRule("mq-producer");
rateLimiter.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_RATE_LIMITER);  // 结果：漏桶
rateLimiter.setCount(20);          // 说明：每秒放过 20 个
rateLimiter.setMaxQueueingTimeMs(5000);  // 输出：排队超 5s 则拒绝
// 错误用法：HTTP 同步接口设排队模式 → 用户等 5s 才返回 → 体验极差
```

## 五、规则持久化

```yaml
# 目的：规则从 Nacos 动态加载（Dashboard 改动→推 Nacos→应用刷新）
spring:
  cloud:
    sentinel:
      datasource:
        flow:
          nacos:
            server-addr: localhost:8848
            data-id: ${spring.application.name}-flow-rules
            rule-type: flow   # 结果：规则持久化不丢失
```

## 六、关联技术

- Sentinel vs Hystrix：滑动窗口实时统计 vs 采样百分比分拆。
- 热点参数限流：对 `userId` 维度的独立 QPS（`ParamFlowRule`）。
- 集群限流：Token Server 统一发放配额。
- 自适应保护：系统级 Load/RT/CPU 使用率兜底。
