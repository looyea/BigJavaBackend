# RPC 原理与 Dubbo 架构 · 面试题

## 题 1：Dubbo 的调用链路有哪些节点？

```text
Consumer: Proxy → Validation → Filter(链) → Cluster → LoadBalance → Directory → Exchange → Transport(Netty)
Provider: Transport → Decode → Filter(链) → Validation → Executor(线程池) → 反射调用 Impl
```

## 题 2：Dubbo 为什么性能比 Feign 高？

- 长连接复用（Netty NIO）vs 短连接/连接池。
- 二进制序列化（Hessian2/FST）vs JSON 文本。
- 私有协议头小（16B）vs HTTP Header 数百字节。
- 多线程模型（IO 线程 + 业务线程池分离）。

## 题 3：Dubbo 服务降级怎么做？

```java
// 目的：Mock 降级——Provider 全不可用时返回兜底
@DubboReference(mock = "return null")  // 结果：异常时返回 null
@DubboReference(mock = "com.example.OrderServiceMock")  // 输出：走 Mock 类
private OrderService orderService;
// 说明：mock 类需实现同接口，构造器接收 InvocationContext
// 错误用法：mock 类有网络调用 → 降级场景下网络也不通 → 再次失败
```

## 题 4：Dubbo 线程池耗尽怎么办？

```text
默认 fixed=200 线程。慢 Provider 或 Consumer 并发高 → 线程池满 → 拒绝。
解决：① 加大线程池（limited）② 用 all/buffer 队列 ③ Provider 侧设 executes 限并发
④ 最关键：排查下游 RT（慢 SQL/GC）——线程满只是症状。
```

## 题 5：什么是应用级服务发现？

Dubbo 2.x 接口级：每个接口一条 Provider URL → 注册中心数据量 = 服务数 × 接口数。
Dubbo 3.x 应用级：只注册应用实例（IP:Port）→ 接口元数据独立存储（MetadataService）。
好处：注册中心压力降 10x+，与 K8s/Istio 模型对齐。

## 题 6：Dubbo 如何实现泛化调用？

```java
// 目的：无需依赖接口 JAR 即可调用（网关/测试平台场景）
GenericService svc = (GenericService) referenceConfig.get();
Object result = svc.$invoke("getOrder",  // 说明：方法名
    new String[]{"java.lang.Long"},       // 输出：参数类型全限定名
    new Object[]{1L});                    // 结果：参数值（Map 模拟 POJO）
// 错误用法：POJO 参数直接传 Java 对象 → 泛化调用需转 Map → ClassCastException
```
