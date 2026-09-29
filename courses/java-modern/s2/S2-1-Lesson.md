# Java 21 LTS：虚拟线程时代

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：吃透 **虚拟线程（Virtual Threads / Project Loom）** 到底是什么、为什么能把"每请求一线程"的阻塞式编程重新变成高吞吐方案；掌握正确使用姿势（`executors` 用完即关、别池化虚拟线程、警惕 `synchronized` 钉住与 ThreadLocal 滥用）；了解配套的**结构化并发（Structured Concurrency）**与**分代 ZGC**。本节聚焦"语言/运行时层"的并发范式变化，线程池内核与 AQS 等仍归 juc 分区。

## 一、虚拟线程解决的不是"快"，而是"便宜"（★★★★★）

传统平台线程（Platform Thread）是 OS 内核线程的 1:1 映射，**栈内存大（默认 1MB 级）、创建/切换昂贵**，所以只能靠线程池复用、并把并发度卡在一个很小上限（几百~几千）。一旦请求里发生阻塞 IO（查库、调下游），这条线程就被占住——**吞吐被线程数而非 CPU 卡死**。

```flow
平台线程(1:1内核)   昂贵→必须池化→并发上限低→阻塞IO浪费线程
虚拟线程(N:M)      极轻量(JVM调度,初始栈几百字节)→一个请求一个→阻塞时自动卸载(unmount)让出载体线程
       虚拟线程 ──挂载/卸载──> 载体线程 Carrier Thread(=少量平台线程, ForkJoinPool)
```

**本质**：虚拟线程是**用户态的可挂起任务**，由 JVM（不是 OS）调度。当它在 IO / `sleep` / 锁上阻塞时，JVM 把栈帧**卸载（unmount）**到堆里，让出底层载体线程去跑别的虚拟线程；阻塞完成再重新挂载。于是"阻塞式同步代码"拥有了"异步的非阻塞吞吐"，**却没有回调地狱 / Reactive 的复杂度**。

> **定位修正**：虚拟线程**不是让计算变快**（CPU 密集没好处），而是**解放并发规模**——把"线程很贵"这个假设从架构里移除。响应式（WebFlux/Reactor）要解决的问题它解决了，但写法回到朴素的阻塞代码，认知负担骤降。

## 二、正确姿势与三大坑（★★★★★）

```java
// 例子目的：虚拟线程"每任务一线程"的正确用法（直接 new，不池化）
Thread.startVirtualThread(() -> handle(req));                   // 一行起一个虚拟线程跑 IO 任务
var exec = Executors.newVirtualThreadPerTaskExecutor(); // 每个任务一个新虚拟线程
exec.submit(() -> handle(req));                                 // 应用：提交任务，用完 close/shutdown
// 正确用法结果：十万个并发 IO 任务也只是十万个很廉价的虚拟线程，底层仍只占几个平台线程，内存不炸
// spring.threads.virtual.enabled=true  // Spring Boot 3.2+：一行开关，MVC 请求处理走虚拟线程
// 错误用法：把虚拟线程池化成固定大小"虚拟线程池" → 无意义（创建成本极低），反而丢失"每任务一线程"的伸缩性
// 错误用法：虚拟线程里长时间 synchronized 块内做阻塞 IO → 载体线程被 pin 住，吞吐倒退（应用 ReentrantLock 代替 synchronized）
```

- **不要池化虚拟线程**：它按"用完即弃"设计、创建成本极低；池化会摧毁其弹性并制造新瓶颈。**`newVirtualThreadPerTaskExecutor` 的并行度仍由内部载体线程（默认=CPU 核数的 ForkJoinPool）决定**。
- **坑 1｜`synchronized` 钉住（pinning）**：虚拟线程在 `synchronized` 块内阻塞时无法卸载，会**钉住载体线程**（JDK 24 前尤甚）。热点路径改用 `ReentrantLock`；用 `-Djdk.tracePinnedThreads=full` 排查。（呼应 juc 锁机制）
- **坑 2｜ThreadLocal 膨胀**：百万级虚拟线程各挂 ThreadLocal → 内存爆炸。慎用大对象 ThreadLocal，考虑结构化上下文 / 作用域值（Scoped Values，见 s2-2）。
- **坑 3｜误用于 CPU 密集**：算得不放松虚拟线程，仍受核数限制；虚拟线程只救**阻塞 IO 密集**（高并发网关、聚合调用、DB 读写）。

> **和线程池的分工**：juc 分区讲"平台线程池七参数、拒绝策略、AQS"——那套**仍然适用且必须懂**；虚拟线程时代，池化的重心从"复用昂贵线程"转为"限制对下游（DB 连接池/外部服务）的并发冲击"——**对下游的限流保护依然要显式做（信号量/连接池上限），别指望虚拟线程数把 DB 压垮**。

## 三、结构化并发：一把攥住一组子任务（★★★★☆）

一个请求常 fan-out 出多个子调用（并行查库存/风控/优惠）。裸用虚拟线程时，"任一失败要取消其余、别泄漏孤儿线程、异常要聚合"全靠手写。21 起预览的 **`StructuredTaskScope`** 把子任务生命周期收进**同一作用域**：父作用域结束即保证所有子线程要么完成要么被取消。

```java
// 例子目的：结构化并发——一次业务开多个子任务，要么全成功要么统一失败，不留孤儿线程
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var stock = scope.fork(() -> queryStock(id));       // 子任务 1：查库存
    var risk  = scope.fork(() -> queryRisk(id));         // 子任务 2：查风控
    scope.join().throwIfFailed();      // 等齐；任一失败则取消其余并抛出
    return new Checkout(stock.get(), risk.get());        // 两个都成功才组装结果
}
// 正确用法结果：stock 与 risk 都成功 → 返回 Checkout；任一抛异常 → throwIfFailed 把异常抛出、另一任务被取消
// 错误用法：用裸 new Thread + join 自己管 → 一个子线程报错未处理会泄漏成孤儿线程、或主线程永远等不到
// 注意：StructuredTaskScope API 随预览版本演进（Java 21 为预览），落地时查当前 JDK 版本文档
```

价值：**"每个请求=一个任务树"**，取消、超时、异常传播由框架兜底，避免"一个子调用挂了、别的还在跑"的资源泄漏——这也是下一节 s2-2 里 21+ 持续打磨的方向。

## 四、分代 ZGC：低停顿再下一城（★★★★☆）

21 引入 **分代 ZGC（Generational ZGC）**（JEP 439）：把堆分新/老两代，**年轻代高频快速回收**（大部分对象朝生夕死）、老年代低频回收，在不牺牲"停顿与堆大小无关（亚毫秒级）"的前提下**显著降低分配停滞（allocation stall）与内存占用**，吞吐更接近 G1。

```
-XX:+UseZGC -XX:+ZGenerational   # 21~23 需显式；JDK 24 起分代成为 ZGC 默认、并移除旧的非分代 ZGC
```

对**大堆 + 低延迟**服务（金融交易、实时行情、电力实时监控）意义重大：GB~TB 堆也能稳在亚毫秒停顿。**选型细节、调参、与 G1/Shenandoah 的对比属 jvm 分区**，本节只需知道"21 让 ZGC 进入生产可用的高光时刻"。

## 五、动手题

1. 写一个"每请求查 3 个下游（各 `sleep` 200ms 模拟 IO）"的服务，分别用固定大小平台线程池 vs `newVirtualThreadPerTaskExecutor`，压到 1 万并发对比吞吐与线程数，直观感受"便宜线程"的价值。
2. 故意在 `synchronized` 块里 `Thread.sleep`，开 `-Djdk.tracePinnedThreads` 观察钉住日志，改 `ReentrantLock` 验证消除。
3. 把一段"CompletableFuture 手工编排多子调用 + 取消/异常聚合"的代码，用 `StructuredTaskScope` 重写（JDK 21 预览），体会任务树的心智简化。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 上了虚拟线程吞吐没涨 | 瓶颈是 CPU 或下游（DB 连接池小），非线程数 |
| 虚拟线程下 DB 被打挂 | 误以为可无限并发，未对下游做信号量/连接上限保护 |
| 载体线程被大量钉住、调度停滞 | `synchronized` 内阻塞；改 ReentrantLock / 缩小同步块 |
| 内存随并发暴涨 | 百万虚拟线程各挂大 ThreadLocal |
| 子调用异常导致孤儿任务泄漏 | 未用结构化并发，取消/生命周期没管好 |

## 七、关联技术栈

- **向前**：`synchronized`/锁升级、ThreadLocal、线程池七参数/AQS 等并发内核 ↔ juc 分区（仍必学）
- **横向（同分区）**：虚拟线程让"线程池调优"部分让位于"下游限流"；Scoped Values 替代 ThreadLocal 见 s2-2
- **向后**：Spring 虚拟线程支持 ↔ spring-boot/spring-mvc 分区；分代 ZGC 深度调优 ↔ jvm 分区
- **范式**：与 Reactive（WebFlux）二选一解阻塞问题，认知负担更低 ↔ 响应式编程专题

## 八、本节小结

21 的并发故事一句话：**虚拟线程把"线程很贵"这个前提删掉了——同步阻塞代码直接获得高并发吞吐；但要避开三坑（别池化、synchronized 钉住、ThreadLocal 膨胀），且对下游的限流保护仍需显式做。** 配合结构化并发管任务树、分代 ZGC 稳低停顿，构成 21 这波 LTS 的核心红利。

下一节 Java 22-25——Loom/Panama/Valhalla 陆续收口，看 FFM、结构化并发转正与值类（Value Classes）前奏。
