# 实际面试题 · 并发设计模式与生产者消费者模型

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。答题要展示"你知道机制的边界"，而不是背名词。

## 题 1：一个接口要并行调 3 个下游再聚合，你怎么写？要注意什么？

**期望时长**：2 分钟

**答题要点**：

- `CompletableFuture.supplyAsync(a).thenCombine(b,...).thenCompose(...)` 并行发起、回调编排，主线程不 `get()` 阻塞。
- 必配：`orTimeout`/`completeOnTimeout` 防单个慢依赖拖死整体；`exceptionally`/`handle` 给异常出口；给**专用线程池**（别用 `commonPool` 跑 IO）。

**追问链**：

1. `thenApply` 和 `thenCompose` 区别？→ `thenApply` 是 map，函数返回普通值；返回 CF 时会得到 `CF<CF<T>>` 嵌套，要用 `thenCompose`（flatMap）展平。
2. 为什么不能用默认池？→ IO 密集的慢任务会占满 `ForkJoinPool.commonPool`，连累全 JVM 其它并行任务；应隔离专用池并设拒绝策略。

## 题 2：讲讲生产者-消费者模型，JUC 里怎么落地最稳？

**答题要点**：

- 生产/消费用中间缓冲队列解耦速率与线程数。
- JUC 首选 `BlockingQueue`：满 `put` 阻塞、空 `take` 阻塞，免手写 `wait/notify`，天然背压。
- **队列必须有界**，否则消费跟不上时无界堆积 → OOM。

**追问链**：

1. 手写 `wait/notify` 常见 bug？→ 条件判断要用 `while` 而非 `if`（防虚假唤醒/抢跑）；忘记 `notifyAll` 或多条件用错锁导致丢唤醒。
2. 想"满了就拒绝"而非阻塞怎么办？→ 用 `offer(e, timeout)`，失败走降级/丢弃/熔断。

## 题 3：什么是背压？为什么重要？有哪些做法？

**答题要点**：

- 下游处理不过来时，把"慢"反向传导给上游，让上游减速/丢弃/降级，而非无节制灌。
- 重要：否则消费变慢（GC、下游抖动）时缓冲无限增长 → OOM、延迟雪崩。
- 做法：有界队列阻塞式；Reactive `request(n)` 请求式；`offer` 失败丢弃/熔断式。

**追问链**：Reactive-Streams 里 `request(Long.MAX_VALUE)` 有什么问题？→ 等于放弃背压，Publisher 有多少灌多少，打爆订阅者内存；应按自身能力分批 `request`。

## 题 4：Actor 模型和 CSP 有什么区别？Java 里更像哪一种？

**答题要点**：

- Actor：状态属于独占 Actor，外界只能发消息（tell/ask），Actor 串行处理自己私有状态——"把活儿寄给专人"。
- CSP：goroutine 通过 channel 传数据、靠传递转移所有权——"用通信来共享内存"（Go）。
- Java 无内置 Actor（靠 Akka 等库）；`BlockingQueue` 在线程间转移数据更接近 CSP 精神。虚拟线程 + 结构化并发让 Java 更靠近 Go 的编排体验。

**追问链**：两者共同解决什么问题？→ 都避免"多线程共享可变内存 + 锁"，用消息传递换取更易推理的并发模型。

## 题 5：CompletableFuture 的异常为什么经常"消失"？怎么处理才稳？

**答题要点**：

- 若链上没有 `exceptionally/handle/whenComplete` 消费异常，异常只在最终 `join/get` 时才以 `CompletionException` 抛出；若你压根不 join，它就静静躺在 CF 里，看起来"消失"。
- 稳：链路末端统一 `handle`/`whenComplete` 记日志 + 降级；对外返回前设 `orTimeout` 避免永不完成。

**追问链**：`exceptionally` 和 `handle` 区别？→ `exceptionally` 只在异常时给降级值；`handle` 成功/异常都走、能同时拿到结果与异常，适合统一收尾。
