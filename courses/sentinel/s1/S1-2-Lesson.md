# 熔断降级与系统自适应保护

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：掌握 Sentinel 三种熔断策略、系统自适应保护规则及降级响应设计。

## 一、熔断三态

```text
Closed(正常) → 触发阈值 → Open(熔断) → 等待 timeWindow → Half-Open(试探)
     ↑                                                            │
     └──────── 试探请求通过 ←──────────────────────────────────────┘
     └──────── 试探请求失败 → 回到 Open ──────────────────────────┘
```

## 二、三种熔断策略

### 2.1 慢调用比例

```java
// 目的：响应时间 > 500ms 视为"慢调用"，比例超 50% 则熔断
DegradeRule rule = new DegradeRule("inventoryService");
rule.setGrade(CircuitBreakerStrategy.SLOW_REQUEST_RATIO.getType());  // 结果：慢调用策略
rule.setCount(0.5);          // 说明：慢调用比例阈值 50%
rule.setSlowRatioThreshold(500);  // 输出：RT > 500ms 算慢
rule.setMinRequestAmount(10);     // 说明：统计窗口内最少 10 个请求才判断
rule.setStatIntervalMs(10000);    // 结果：10s 统计窗口
rule.setTimeWindow(5);            // 说明：熔断 5s 后进入 Half-Open
```

### 2.2 异常比例

```java
// 目的：异常占比 > 30% → 熔断
DegradeRule exRatio = new DegradeRule("payGateway");
exRatio.setGrade(CircuitBreakerStrategy.ERROR_RATIO.getType());  // 结果：异常比
exRatio.setCount(0.3);  // 说明：30% 异常即触发
// 错误用法：未设 minRequestAmount → 只有 1 个请求异常(100%)就熔断 → 误判
```

### 2.3 异常数

```java
// 目的：窗口内异常数 > 5 → 熔断
DegradeRule exCount = new DegradeRule("smsService");
exCount.setGrade(CircuitBreakerStrategy.ERROR_COUNT.getType());  // 输出：绝对数
exCount.setCount(5);  // 结果：5 个异常触发
```

## 三、降级响应设计

```java
// 目的：Feign + Sentinel fallback 返回兜底数据
@FeignClient(name = "product-service", fallback = ProductClientFallback.class)
public interface ProductClient {
    @GetMapping("/products/{id}")
    ProductVO getProduct(@PathVariable Long id);
}

@Component
public class ProductClientFallback implements ProductClient {
    @Override
    public ProductVO getProduct(Long id) {
        // 说明：熔断触发后走此方法 → 降级不应抛异常
        ProductVO cached = localCache.get(id);  // 结果：返回缓存（可能过期但有值）
        if (cached != null) return cached;
        return new ProductVO(id, "商品暂时不可用", null);  // 输出：友好兜底
    }
}
// 错误用法：fallback 中再远程调用 → 被调方也挂了 → 死循环雪崩
```

## 四、系统自适应保护

```java
// 目的：系统级兜底——Load 超阈值则全局拒绝
SystemRule sysRule = new SystemRule();
sysRule.setHighestSystemLoad(8.0);   // 结果：Linux Load > 8 → 新请求全部拒绝
sysRule.setAvgRt(2000);              // 说明：全局平均 RT > 2s → 拒绝
sysRule.setMaxThread(200);           // 输出：并发线程 > 200 → 拒绝
sysRule.setQps(10000);               // 说明：入口总 QPS 上限
```

| 指标 | 含义 | 适用 |
|------|------|------|
| Load | 系统 1min 平均负载 | 防止过载 |
| avgRT | 全局平均响应时间 | 保护用户体验 |
| maxThread | 并发入口线程 | 防 OOM |
| entranceQPS | 全局入口 QPS | 总容量控制 |

## 五、熔断 vs 限流的区别

| 维度 | 限流（FlowRule） | 熔断（DegradeRule） |
|------|-----------------|-------------------|
| 触发依据 | 流量大小（QPS/线程） | 调用质量（慢/异常） |
| 恢复方式 | 下一秒自动恢复 | 需等 timeWindow + Half-Open 试探 |
| 目的 | 保护自己不被压垮 | 快速失败不拖死调用方 |
| 类比 | 高速限速 | 电路保险丝 |

## 六、关联技术

- Resilience4j CircuitBreaker：类似三态但策略只有异常率+慢调用率。
- 服务网格 Istio：Envoy 侧的 outlierDetection 做熔断。
- 降级数据一致性：返回缓存可能过期 → 业务层加"数据可能延迟"提示。
- 规则持久化：DegradeRule 同 FlowRule 一样推 Nacos。
