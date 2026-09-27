# WebFlux 与响应式编程

> 本节难度：★★★★☆
> 本节重要性：★★★☆☆
> 学习产出：理解 Reactor 的 `Mono`/`Flux`、订阅与背压模型；说清 WebFlux 与 WebMVC 的本质差异与适用边界；能在"响应式 vs 虚拟线程"之间给出有依据的技术选型（呼应 spring-boot S3-1）。

## 一、为什么要响应式：事件循环 + 非阻塞 IO

传统 Servlet（WebMVC）是 **thread-per-request**：一个请求占一个线程，遇到 IO 就阻塞等待。高并发下要么线程耗尽，要么靠堆机器。

WebFlux 建立在 **Reactor + Netty** 之上，走 **事件循环（event loop）+ 非阻塞 IO**：少量 IO 线程处理海量并发连接，请求在等待下游时不占线程，用**回调/流**把"就绪后继续"表达出来。目标是**高并发下的资源效率与弹性**。

```flow
少量 event-loop 线程 → 请求到达注册回调即释放线程 → 下游数据就绪 → 事件循环触发后续算子
（全程不阻塞线程；背压让下游按消费能力向上游要数据）
```

## 二、Reactor 核心：Mono、Flux、订阅、背压

- **`Mono<T>`**：0..1 个元素的异步序列（对应"一个结果/无结果"）。
- **`Flux<T>`**：0..N 个元素的异步序列。
- **冷/热与惰性**：Flux/Mono 是**声明**，**不被订阅（subscribe）就不执行**；链式算子（`map`/`flatMap`/`zip`）只描述"怎么处理"，订阅才触发数据流动。这是新手最大的认知坎——"写了 map 却没执行"因为没订阅/没被框架订阅。
- **背压（backpressure）**：下游通过 `request(n)` 告诉上游"我能消费多少"，防止生产者压垮消费者（Reactive Streams 规范）。这是响应式相对"无限并发的虚拟线程"的一个独特优势——**内建的流控**。
- **`flatMap` vs `map`**：`map` 同步转换；`flatMap` 展开嵌套异步序列（并发调下游聚合就靠它）。

```java
Mono<Order> order = webClient.post().uri("/cart").bodyValue(cart).retrieve()
        .bodyToMono(Order.class)          // 非阻塞，返回 Mono
        .timeout(Duration.ofMillis(500))
        .onErrorResume(e -> Mono.empty()); // 响应式错误处理与降级
```

## 三、WebFlux vs WebMVC：不只看框架，看整条链

| 维度 | WebMVC（Servlet） | WebFlux（Reactive） |
| --- | --- | --- |
| 线程模型 | thread-per-request，阻塞 | 事件循环，非阻塞 |
| 底座 | Servlet 容器（Tomcat…） | Netty（也可跑 Servlet 容器） |
| 编程模型 | 命令式、直观 | 函数式流栈，调试/心智负担高 |
| **传染性** | 无 | **全链必须非阻塞**：DB（R2DBC）、缓存、HTTP 客户端都得响应式，一处阻塞拖垮全局 |
| 适用 | 多数 CRUD/计算/团队熟悉 | 高并发 IO、流式、网关、SSE/WebSocket |
| 栈 | JVM 深栈可读 | 异步栈难读，需 Reactor Debug |

**"传染性"是选型第一坑**：只要链路里有一个阻塞调用（比如还用了 JDBC 的同步查询、`Thread.sleep`、同步 HTTP），就会占住 event-loop 线程，整个模型退化甚至劣化。

## 四、和虚拟线程怎么选（关键决策，呼应 spring-boot S3-1）

两者都为解决"IO 等待浪费线程"，但路径不同：

- **WebFlux**：非阻塞 + 背压，性能上限高、流控内建，但**要求全链响应式**、代码范式改造大、调试难。
- **虚拟线程**：仍是**阻塞式同步代码**，JVM 帮你卸载，迁移成本几乎为零；无内建背压（需自己限流）。

**经验法则**：

- 新建的高并发网关/流式服务、团队有响应式能力 → WebFlux 仍合理。
- **存量阻塞服务想提并发 → 优先虚拟线程**，别再跳进响应式的重构泥潭。
- 不要混用：响应式链上再开虚拟线程意义不大；一条链选一种模型。

## 五、动手验证

1. 写一段只 `Flux.just(1,2,3).map(...)` 不订阅，验证不执行；加 `.subscribe()` 才打印——体会惰性。
2. 在 WebFlux 处理链里偷偷塞一个 `Thread.sleep(1000)` 或同步 JDBC 调用，观察 event-loop 被阻塞、吞吐骤降（用 `BlockHound` 直接报警"阻塞调用"）。
3. 给 `Flux` 加 `limitRate(n)` 模拟背压，观察上游按批下发；对比不加时一次性拉取。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 加了 WebFlux 反而更慢 | 链路里存在阻塞调用，占死 event-loop 线程 |
| 内存被上游压爆 | 没利用背压 / 无界 `collectList` 攒全量 |
| "逻辑写了没执行" | Mono/Flux 未被订阅 |
| 异常栈看不懂 | 异步栈分离，未开 Reactor Debug / 丢因果 |
| 事务难写 | 需 R2DBC 响应式事务，传统 `@Transactional` 语义不适用 |

## 七、关联技术栈

- **核心库**：Reactor（`Mono`/`Flux`）、Reactive Streams、`BlockHound`
- **Web 层**：Spring WebFlux、`WebClient`、函数式 `RouterFunction`（对比 s1-1 注解映射）
- **数据层**：R2DBC、响应式 Redis/Cache
- **对比方案**：虚拟线程（spring-boot S3-1）、结构化并发
- **诊断**：Reactor Debug Agent、`Hooks.onOperatorDebug`
