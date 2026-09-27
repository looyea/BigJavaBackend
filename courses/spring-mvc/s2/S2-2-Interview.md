# 实际面试题 · WebFlux 与响应式编程

## 题 1：WebFlux 的线程模型和传统 Spring MVC 有什么不同？

**考察层次**：初级答"异步非阻塞"；中级能讲 event-loop + 少量线程；高级能讲清依赖与代价。

**参考答法**：

1. WebMVC（Servlet）是 thread-per-request，一个请求一个线程，阻塞在 IO 上时线程被白占。
2. WebFlux 基于 Reactor + Netty 的 event-loop：少量 IO 线程处理海量连接，请求等下游时不占线程，通过回调/流在数据就绪时继续；配合背压做流控。
3. 收益是高并发 IO 下的资源效率与弹性；代价是全链必须非阻塞、编程与调试心智负担大。

**追问**：为什么一处阻塞会毁掉 WebFlux？→ event-loop 线程极少，任何同步阻塞调用都占死它，别的连接得不到处理，整体吞吐塌陷。

## 题 2：什么是背压？为什么重要？

**答题要点**：Reactive Streams 规范里下游通过 `request(n)` 告诉上游"我现在能处理多少"，上游按需生产/下发，避免快生产者压垮慢消费者导致缓冲无限增长 OOM。它是响应式相对"无限并发"模型的独特优势——内建流控。落地算子如 `limitRate`、`onBackpressureBuffer/Drop/Latest`。

## 题 3：Mono/Flux 为什么"不订阅就不执行"？

**答题要点**：它们是**惰性声明**，`map/flatMap/filter` 等只是构建处理拓扑，`subscribe`（或被上层框架订阅）才触发 onSubscribe→request→next 流。忘了订阅是典型 bug；调试要理解冷热流——冷流每次订阅重放数据源，热流共享。Web 层里框架会替你订阅，但单测/中间算子手写时极易踩。

## 题 4：现在还要不要学/用 WebFlux？和虚拟线程冲突吗？（架构师高频）

**参考答法**：

- 二者目标重叠（解决 IO 等待浪费线程），但权衡不同：虚拟线程保留同步阻塞写法、迁移成本低、无内建背压；WebFlux 有背压、上限高，但需全响应式生态、改造重。
- 存量阻塞服务提并发 → 优先虚拟线程，别再跳响应式重构。
- 新建超高并发 IO / 流式 / 网关 / SSE / WebSocket，且团队有能力 → WebFlux 仍合理。
- 不要混用，一条链选一种模型。
- 结论是"看场景"，不是"谁取代谁"——给出这个判断本身就是架构师价值。

## 高频追问速答

1. WebFlux 只能跑 Netty 吗？→ 不，可跑 Servlet 容器/Undertow/Jetty，但要非阻塞就得 Netty + R2DBC 才发挥。
2. 响应式里怎么做事务？→ 用 R2DBC 响应式事务，传统基于 ThreadLocal 的 `@Transactional` 语义不适用，需 `TransactionOperator`/`@Transactional` 的响应式支持。
3. `WebClient` 和 `RestTemplate` 区别？→ WebClient 非阻塞响应式（基于 Reactor），RestTemplate 同步阻塞（已停止新增特性）。
4. 怎么定位响应式里的 bug 栈？→ 开 Reactor Debug（`Hooks.onOperatorDebug` 或 debug agent）补回算子因果栈，否则异步栈分离看不出来源。
5. CPU 密集适合 WebFlux 吗？→ 不适合，非阻塞只对 IO 等待有意义，CPU 密集仍要并行计算/线程。
