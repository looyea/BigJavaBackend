# RPC 原理与 Dubbo 架构

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：理解 RPC 调用全流程，掌握 Dubbo 服务暴露/引用、SPI 扩展、负载均衡与集群容错机制。

## 一、RPC 核心流程

```text
Consumer → Proxy(动态代理) → 序列化 → 网络传输(Netty) → Provider 反序列化 → 调用 Impl → 返回
```

## 二、Dubbo 架构组件

```text
┌────────────┐     注册        ┌───────────┐
│ Provider   │ ─────────────→ │ Registry  │(Nacos/ZK)
│ (暴露服务) │                └───────────┘
└────────────┘                   ↑ 订阅
       ↑ 调用(Netty)             │
┌────────────┐                   │
│ Consumer   │ ──────────────────┘
│ (引用代理) │
└────────────┘
       ↕ 监控
┌────────────┐
│ Monitor    │
└────────────┘
```

## 三、服务暴露与引用

```java
// 目的：Provider 暴露服务
@DubboService(interfaceClass = OrderService.class, version = "1.0.0")
public class OrderServiceImpl implements OrderService {
    public OrderDTO getOrder(Long id) { ... }  // 输出：真实业务逻辑
}

// 目的：Consumer 引用服务（生成代理对象）
@DubboReference(interfaceClass = OrderService.class, version = "1.0.0", timeout = 3000)
private OrderService orderService;  // 结果：调用 orderService.getOrder(1L) → 远程 RPC

// 错误用法：version 不匹配 → Consumer 订阅不到 Provider → No provider available
```

## 四、SPI 扩展机制

```java
// 目的：Dubbo 的 SPI 不是 JDK SPI——按需加载 + IoC + AOP
// @SPI("random") 标注接口 → ExtensionLoader 加载实现
// 扩展点示例：Protocol、Cluster、LoadBalance、Router、Filter

@SPI("dubbo")
public interface Protocol {
    <T> Exporter<T> export(Invoker<T> invoker);  // 结果：暴露服务
    <T> Invoker<T> refer(Class<T> type, URL url); // 输出：引用远程
}
// 错误用法：用 JDK SPI 写 Dubbo 扩展 → 无法加载（Dubbo 用自己的 ExtensionLoader）
```

## 五、负载均衡

| 策略 | 算法 | 配置 |
|------|------|------|
| Random | 加权随机 | `loadbalance=random`（默认） |
| RoundRobin | 加权轮询 | `loadbalance=roundrobin` |
| LeastActive | 最少活跃调用 | `loadbalance=leastactive` |
| ConsistentHash | 一致性哈希 | `loadbalance=consistenthash` |

## 六、集群容错

```java
// 目的：Dubbo Cluster 策略——调用失败后的行为
// failover（默认）：失败重试其他节点，retries=2
@DubboReference(cluster = "failover", retries = 2)
private OrderService orderService;  // 结果：最多调 3 个节点

// failfast：快速失败——只调一次，失败即抛异常（非幂等写操作）
@DubboReference(cluster = "failfast")
private PayService payService;  // 说明：避免重试导致重复扣款

// failsafe：忽略失败（日志上报等不影响主流程）
// broadcast：逐台调用全成功（配置推送）
// forking：并行调用多节点首个成功即返回（低延迟场景）
```

## 七、调用链路 Filter

```java
// 目的：自定义 Dubbo Filter（如全链路压测标记）
@Activate(group = {"provider", "consumer"})
public class StressTestFilter implements Filter {
    public Result invoke(Invoker<?> invoker, Invocation invocation) {
        String flag = RpcContext.getServerAttachment().getAttachment("x-stress");
        if ("true".equals(flag)) {
            // 说明：压测流量走影子库——结果不污染生产数据
            ShadowContext.mark();
        }
        return invoker.invoke(invocation);  // 输出：继续链路
    }
}
// 错误用法：Filter 未注册 SPI → Dubbo 不加载 → 不生效
```

## 八、关联技术

- Triple 协议（Dubbo 3.x）：兼容 gRPC，支持 HTTP/2。
- 服务网格：Dubbo 3 应用级服务发现 → 与 Istio 协作。
- Dubbo vs Feign：二进制高性能 vs HTTP 跨语言。
