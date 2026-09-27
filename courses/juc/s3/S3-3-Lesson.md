# 并发设计模式与生产者消费者模型

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：把零散的线程/锁知识升级成**可复用的并发设计模式**——用 `Future`/`CompletableFuture` 做**异步编排**（并行聚合、链式依赖、超时兜底、异常传播）；理解**生产者-消费者模型**及其解耦三件套（缓冲队列、`BlockingQueue`、信号量背压）；能对比 **Actor（消息到独占 Actor，状态随 Actor 串行）** 与 **CSP（通信顺序进程，共享 channel，Go 风格"不要通过共享内存来通信"）** 两种并发世界观；掌握**背压（backpressure）**为什么是流式/消息系统不被打爆的命门。电商下单聚合、金融风控多源调用、电力采集削峰都靠这套。

## 一、Future：异步结果的"凭据"，但太朴素

`Future` 代表"一个还没算出来的结果的凭据"。`ExecutorService.submit` 返回它。问题：**只能阻塞 `get()` 取结果、无法组合**。

```java
// 例子目的：用 Future 并行发起两个 RPC 再聚合，展示它的用法与"手动编排"的痛点
import java.util.concurrent.*;
ExecutorService pool = Executors.newFixedThreadPool(4);
Future<Integer> stock  = pool.submit(() -> rpcQueryStock(skuId));     // 提交后立即返回，不阻塞主线程
Future<Double> price   = pool.submit(() -> rpcQueryPrice(skuId));     // 与 stock 并行跑
int s = stock.get(500, TimeUnit.MILLISECONDS);                        // 应用：需要结果时才 get，可设超时（错误用法：get() 不带超时→下游卡死则本线程永久阻塞）
double p = price.get(500, TimeUnit.MILLISECONDS);
// 正确使用结果：两个 RPC 并行，总耗时≈max 而非 sum
// 错误用法：stock.get() 后再 submit price→ 串行化，白白浪费并行；Future 之间无法声明"完成一个自动触发下一个"，组合全靠手写阻塞，这是它被 CompletableFuture 取代的原因
```

## 二、CompletableFuture：可编排的异步流水线（硬核）

`CompletableFuture` 支持**回调式组合**：完成时自动触发下游，不阻塞任何线程。三种关系要分清——**顺序依赖（thenCompose）、并行会合（thenCombine/allOf）、结果变换（thenApply）**。

```java
// 例子目的：电商下单聚合——并行查库存/价格/风控，全部就绪后汇总裁决，示范 CF 的三类编排与异常兜底
import java.util.concurrent.CompletableFuture;
CompletableFuture<Integer>  fStock  = CompletableFuture.supplyAsync(() -> rpcQueryStock(sku), pool);
CompletableFuture<Double>   fPrice  = CompletableFuture.supplyAsync(() -> rpcQueryPrice(sku), pool);
CompletableFuture<Boolean>  fRisk   = CompletableFuture.supplyAsync(() -> rpcRiskCheck(uid), pool);

CompletableFuture<String> order =
    fStock.thenCombine(fPrice, (st, pr) -> "price=" + pr + ",stock=" + st) // 并行会合：stock 与 price 都完成后合并结果
           .thenCompose(desc -> fRisk.thenApply(r -> desc + ",risk=" + r))  // 顺序依赖：基于上一步结果再发起（thenCompose=扁平化，避免 CF<CF<T>>）
           .exceptionally(ex -> "fallback: " + ex.getMessage())             // 异常兜底：任一环节抛出，走降级而非让异常冒泡到 get
           .completeOnTimeout("timeout-default", 800, TimeUnit.MILLISECONDS); // 超时兜底：800ms 没完成就用默认值继续
// 正确使用结果：三条 RPC 并行，allOf 语义下最快汇合；异常/超时都有出口，主线程全程不阻塞
// 错误用法：用 thenApply 返回一个 CF 再接着链→ 得到 CompletableFuture<CompletableFuture<T>> 嵌套，取结果灾难；扁平化必须用 thenCompose
// 错误用法：supplyAsync 不传自定义 pool→ 默认 ForkJoinPool.commonPool，被慢 IO 占满会拖垮全 JVM 其它并行流；IO 密集务必给专用池
```

**编排地图（高频）**：

| 需求 | 用哪个 |
| --- | --- |
| 拿到结果做转换 | `thenApply` / `thenApplyAsync` |
| 依赖上一步再发起下一个异步 | `thenCompose`（单依赖扁平化） |
| 两个独立异步都完成后合并 | `thenCombine` / `allOf` + `getNow` |
| 任一完成即继续 | `anyOf` / `applyToEither` |
| 异常处理 / 收尾 | `exceptionally` / `handle` / `whenComplete` |
| 超时 | `completeOnTimeout` / `orTimeout`（JDK 9+） |

## 三、生产者-消费者模型：用队列解耦"快慢两端"

生产者产任务、消费者耗任务，中间一个**缓冲队列**解耦速率与线程数。JUC 给的是 `BlockingQueue`：满了 `put` 自动阻塞（或超时），空了 `take` 自动阻塞——**天然背压 + 免手写 wait/notify**。

```java
// 例子目的：用 ArrayBlockingQueue 搭生产者-消费者，队列有界即天然限流背压
import java.util.concurrent.*;
BlockingQueue<Order> queue = new ArrayBlockingQueue<>(1000); // 有界！(错误用法：LinkedBlockingQueue 无默认上界→生产远快于消费时队列无限膨胀→OOM)
// 生产者
queue.put(order);          // 队列满则阻塞等待，把"生产过快"的压力顶回去（背压），而非丢进内存堆爆
// 消费者
Order o = queue.take();    // 队列空则阻塞挂起，不空转 CPU（对照 juc s3-2 自旋的代价）
process(o);                // 正确处理结果：生产/消费速率解耦，两端各自伸缩，中间缓冲削峰
// 错误用法：用 Collections.synchronizedList 手写 wait/notify 当队列→ 易丢唤醒/虚假唤醒处理不当、条件变量用 if 而非 while 判断→ 抢跑或永久等待
```

**要点**：队列**必须设上界**（`ArrayBlockingQueue` 或给 `LinkedBlockingQueue` 传 capacity）；`offer(e, timeout)` 比无限 `put` 更适合需要"满了就拒绝/降级"的场景；批量 `drainTo` 减少锁次数提吞吐。

## 四、背压：防止"生产快过消费"把系统打爆

**背压 = 下游处理不过来时，能把"慢"这个信号反向传导给上游，让上游减速/丢弃/降级，而不是无节制往下游灌。**

- **为什么是命门**：无背压的流式/消息系统，一旦消费端变慢（GC、下游 DB 抖动），生产端还在猛发 → 缓冲无限增长 → OOM/延迟雪崩。呼应 netty s3-2 的 `isWritable`/`WriteBufferWaterMark`、Kafka/RocketMQ 的消费限流。
- **实现流派**：① 阻塞式（有界队列 `put`，把快端顶住）；② 请求式（`Flow`/Reactive-Streams 的 `request(n)`，下游按能力拉取）；③ 丢弃/降级式（`offer` 失败即采样/丢弃/熔断，保护自身）。

```java
// 例子目的：Reactive Streams 手动背压——Subscriber 按自身处理能力 request(n)，而非被 Publisher 淹没
org.reactivestreams.Subscription sub;
public void onSubscribe(Subscription s) { this.sub = s; s.request(32); }  // 只先要 32 条（正确：按缓冲/处理能力给额度）
public void onNext(Integer item) { process(item); if (++handled % 32 == 0) sub.request(32); } // 处理一批再追加请求（错误用法：onSubscribe 里 request(Long.MAX_VALUE)→ 等于放弃背压，Publisher 有多少灌多少→打爆内存）
```

## 五、Actor 模型 vs CSP：两种并发世界观

都是"用消息代替共享内存"，但方向相反：

| 维度 | Actor（Erlang/Akka） | CSP（Go："通过通信共享内存"） |
| --- | --- | --- |
| 核心原语 | 独占的 Actor，收到消息**串行处理**自己的私有状态 | goroutine 通过 **channel** 传递数据 |
| 状态归属 | 状态属于 Actor，别人只能发消息不能直接改 | "谁持有 channel 数据谁拥有"，靠传递转移所有权 |
| 通信方式 | `tell`（异步发不等）/ `ask`（要回复） | 收发同一个 channel，收发即同步点 |
| 心智 | "别共享，把活儿寄给专人" | "别用共享内存通信，用通信来共享内存" |

Java 侧没有内置 Actor（Akka/PCollections 等库提供），而 **CSP 精神在 JUC 里体现为"用 `BlockingQueue` 把数据在生产/消费线程间转移"**——第三节的生产者-消费者本质就是 CSP 风格。**JDK 虚拟线程 + `BlockingQueue`/结构化并发（StructuredTaskScope）** 让"每个任务一个廉价线程 + channel 式队列"更接近 Go 体验（呼应 java-modern s2-1/s2-3）。

## 六、动手题

1. 用 `CompletableFuture` 把三个 mock RPC 并行化并聚合，分别用 `thenApply` 和 `thenCompose` 处理"依赖上一步再查"的场景，打印是否出现 `CF<CF<T>>` 嵌套，体会扁平化。
2. 给生产者-消费者队列设 capacity=10，消费者故意慢，观察生产者 `put` 阻塞（背压生效）；改用无界队列观察内存增长直至 OOM（谨慎，小堆跑）。
3. 用一个共享 `int` + `synchronized` 和一个 `BlockingQueue` 两种写法实现"生产者发、消费者收"，对比代码复杂度与解耦度，说明 CSP 风格为何更清晰。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 聚合接口超时被单个慢依赖拖死 | CF 没设 `orTimeout`/`completeOnTimeout`，`get()` 无超时 |
| 默认 `commonPool` 被慢 IO 占满，别处并行流全卡 | `supplyAsync` 未指定专用池 |
| 队列消费端 OOM / 延迟飙升 | 用了无界队列、无背压，生产快过消费堆爆内存 |
| 异常"消失"、Future 一直不完成 | CF 链缺 `exceptionally/handle`，异常没被消费 |
| 虚假唤醒/丢通知导致消费卡死 | 手写 `wait/notify` 未用 `while` 判条件；应直接上 `BlockingQueue` |

## 八、关联技术栈

- **向前**：线程池/拒绝策略 ↔ juc s2-2；`BlockingQueue` 家族与 `Semaphore` ↔ juc s2-3；自旋/阻塞取舍 ↔ juc s3-2
- **响应式**：Reactor/RxJava 的背压 ↔ 与 netty s3-2 写缓冲水位、WebFlux 呼应
- **消息中间件**：Kafka/RocketMQ 消费限流、削峰填谷 ↔ 中间件分区
- **现代 Java**：虚拟线程、结构化并发 `StructuredTaskScope` ↔ java-modern s2-1/s2-3，天然适配 fan-out/fan-in 编排

## 九、本节小结

并发设计把"线程 + 锁"升维成"编排 + 解耦 + 反馈"三件事：**`CompletableFuture` 用 `thenApply/thenCompose/thenCombine/allOf` + 异常/超时出口搭异步流水线；生产者-消费者用有界 `BlockingQueue` 解耦快慢两端并自带背压；背压是流式系统不被打爆的命门；Actor 与 CSP 从两个方向诠释"用消息替代共享内存"。** 一句话贯穿：**别共享可变状态，要么把活儿寄给专人（Actor），要么用队列把数据转移出去（CSP），并永远给"下游慢"留一条顶回去的通路。**

juc 专题到此收官——下一包进入 JVM 与 GC 专题：运行时数据区、类加载、垃圾回收器与线上排障。
