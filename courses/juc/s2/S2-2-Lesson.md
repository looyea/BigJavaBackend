# 线程池七参数与执行流程

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：把 `ThreadPoolExecutor` 的**七个构造参数**、**任务提交流程（核心→队列→最大→拒绝）**这条"反直觉但极高频"的主线彻底讲清；记住**四种内置拒绝策略**、为什么**禁用 `Executors` 快捷工厂**、以及如何按 CPU/IO 密集**估算线程数**与**运行期动态调参**。这是 Java 后端面试出现频率最高的题之一。

## 一、七个参数与它们的角色（★★★★★）

```java
// 例子目的：逐个标注 ThreadPoolExecutor 七个构造参数的职责（下文给具体调用与错误用法）
new ThreadPoolExecutor(
    int corePoolSize,          // ① 常驻核心线程数（即使空闲也保留，除非 allowCoreThreadTimeOut）
    int maximumPoolSize,       // ② 队列满后允许扩容到的最大线程数
    long keepAliveTime,        // ③ 非核心线程空闲存活时间
    TimeUnit unit,             // ④ 上面时间单位
    BlockingQueue<Runnable> workQueue,  // ⑤ 等待执行任务的队列
    ThreadFactory threadFactory,        // ⑥ 造线程的工厂（命名/守护/优先级，排查全靠线程名）
    RejectedExecutionHandler handler    // ⑦ 队列+线程都满时的拒绝策略
);
```

上面的形参列表只是“定义”，必须配真实调用才算应用：

```java
// 例子目的：给出一个生产可用的正确写法 + 两个典型错误写法
ExecutorService pool = new ThreadPoolExecutor(
    2, 4, 60L, TimeUnit.SECONDS,                 // core=2,max=4,非核心空闲60s回收
    new ArrayBlockingQueue<>(100),               // 有界队列防 OOM
    r -> new Thread(r, "order-pool-" + seq.getAndIncrement()), // ⑥ 命名线程工厂
    new ThreadPoolExecutor.CallerRunsPolicy());  // ⑦ 满了让调用线程自己跑（回压不丢任务）
pool.execute(() -> handleOrder(id));             // 正确使用结果：任务按"核心→队列→最大→拒绝"被消化，dump 里线程名一服了然
// 错误用法：Executors.newFixedThreadPool(10) → 内部用无界 LinkedBlockingQueue，海量任务无限堆积→ OOM（无异常直到堆耗尽）
// 错误用法：core=2,max=4 却把队列设为 new LinkedBlockingQueue<>() → 队列永不-full，max 形同虚设，永远只有 2 个线程在跑
// 错误用法：submit(task) 后从不 get() → 任务内异常被藏进 Future 静息丢失（execute 会直接抛出到线程默认处理器）
```

`ThreadFactory` 看着次要却极重要：**给线程起有意义的名字**（`order-pool-%d`）出问题时 dump 一眼定位，别用默认的 `pool-1-thread-1`。

## 二、执行流程：核心→队列→最大→拒绝（★★★★★，反直觉重点）

提交一个 `execute(task)` 时，判断顺序是（**很多人答错**）：

```flow
1. 当前线程数 < corePoolSize ?  → 是：新建核心线程执行
2. 否则，尝试把任务放入 workQueue → 成功：排队，等空闲核心线程来取
3. 队列也满了，线程数 < maximumPoolSize ? → 是：新建"非核心"线程执行
4. 线程数已达 max 且队列满 → 触发 ⑦ 拒绝策略
```

> **关键澄清**：线程池是"**先用核心、再排队、队列满才扩到最大**"，不是"先扩到最大再排队"。所以 `corePoolSize=2, max=10, 队列=100` 时，只有前 2 个线程在跑、任务几乎都在排队，**很难扩到第 3~10 个线程**——这是配置误区的高频来源。核心线程创建后默认复用（`runWorker` 循环 `getTask` 从队列取），非核心空闲超 `keepAliveTime` 被回收。

## 三、工作队列与四种拒绝策略（★★★★☆）

**队列选型**（⑤）：`ArrayBlockingQueue`（有界，防 OOM，推荐）、`LinkedBlockingQueue`（默认无界=Integer.MAX，危险）、`SynchronousQueue`（不存储、直接交接，`newCachedThreadPool` 用它）、`PriorityQueue`（按优先级，无序不可靠）。

**拒绝策略**（⑦，`RejectedExecutionException` 的四种处理）：

| 策略 | 行为 | 典型用途 |
| --- | --- | --- |
| `AbortPolicy`（默认） | 直接抛异常 | 快速失败、让调用方感知过载 |
| `CallerRunsPolicy` | 让**提交任务的线程自己跑**这个任务 | 天然"回压"降速，不丢任务（Web 里可能拖慢请求线程） |
| `DiscardPolicy` | 静默丢弃当前任务 | 允许丢（如无关紧要的埋点） |
| `DiscardOldestPolicy` | 丢队列最老的，再尝试提交 | 只要最新数据（如行情覆盖） |

生产常**自定义 handler**：记录/告警 + 落库/入 MQ 兜底，绝不静默丢关键任务。

## 四、为什么禁用 Executors 快捷工厂（★★★★★）

阿里巴巴手册明确**不推荐用 `Executors` 创建**，因两种默认池会 OOM：

- `newFixedThreadPool` / `newSingleThreadExecutor`：用**无界** `LinkedBlockingQueue` → 任务无限堆积 → **内存溢出**。
- `newCachedThreadPool` / `newScheduledThreadPool`：`maximumPoolSize = Integer.MAX` → 无限建线程 → **OOM / 线程风暴**。

正确姿势：**手动 `new ThreadPoolExecutor(...)` 显式给定有界队列与 max**，让容量、拒绝行为都可控。`ThreadLocal` 与线程池的坑见 s3-1。

## 五、线程数怎么定 & 动态调参（★★★★☆）

- **CPU 密集**：约 `核数 + 1`（多跑无益、少点上下文切换）。
- **IO 密集**：线程多在等 IO，可 `核数 × (1 + 平均等待时间/平均计算时间)`，或经验上 2×核数起步再压测调。这些是**起点不是终点**——最终靠压测定（呼应性能调优分区）。
- **动态调参**：`ThreadPoolExecutor` 暴露 `setCorePoolSize/setMaximumPoolSize/setKeepAliveTime`，可在运行期改（参数是 volatile），配合配置中心（Nacos/Apollo）实现**线上热调池**，大促临时扩容不必重启。
- **优先级**：`submit`（返回 Future）与 `execute` 走同一流程；但**max 只在队列满时才用**，所以想"先扩线程再排队"需把队列设得很小甚至用 `SynchronousQueue`。

## 六、动手题

1. 配一个 `core=2, max=4, 队列=3` 的池，连续提交 12 个慢任务，用线程名日志观察：第 1~2 个建核心、3~5 排队、6~7 扩非核心、8+ 触发拒绝——验证"核心→队列→最大→拒绝"。
2. 分别用 `Executors.newFixedThreadPool` 提交海量任务观察队列堆积内存，再换手动有界 `ThreadPoolExecutor` + `CallerRunsPolicy` 对比。
3. 写一段用配置中心/定时任务调 `setCorePoolSize` 的"热调池"骨架，说明大促场景价值。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 线程池"设了 max 却从不扩到 max" | 队列太大，任务都排队、没触发扩容（流程误区） |
| OOM，堆里全是等待的 Runnable | 用了 Executors 无界队列 |
| 线程数暴涨 CPU 打满 | newCachedThreadPool 无限建线程 |
| 关键任务"消失"无日志 | DiscardPolicy 静默丢 / 未自定义 handler |
| 排查无线索、分不清哪个业务的线程 | 用默认 ThreadFactory，线程名都是 pool-N-thread-M |
| 提交任务后 `submit` 异常"消失" | 异常被包进 Future 从不 get；应 execute 或确保 get |

## 八、关联技术栈

- **向前**：Worker 内部继承 AQS 控制中断 ↔ s2-1；`ThreadLocal` 复用清理 ↔ s3-1
- **横向**：虚拟线程让"为复用而池化"退场、"为限流而池化"仍在 ↔ java-modern s2-1；下游用 Semaphore 保护 ↔ s2-1/s2-3
- **向上**：Web 容器/DB 连接池（HikariCP）线程与连接数匹配 ↔ 持久层与连接池分区；容量规划 ↔ 性能调优分区
- **框架**：Spring `@Async`/`@Scheduled` 默认池、TaskExecutor 配置 ↔ spring-boot 分区

## 九、本节小结

记牢三件事就够应付面试与生产：**① 七参数（core/max/keepAlive+unit/队列/工厂/拒绝）；② 流程"核心→队列→最大→拒绝"（max 只在队列满才用，是最易错点）；③ 禁用 Executors 无界/无限默认池、手动建有界池 + 有意义线程名 + 自定义拒绝**。线程数按 CPU/IO 定起点、靠压测收敛，可运行期热调。

下一节并发容器与同步器——ConcurrentHashMap 怎么做到并发安全，Latch/Barrier/Semaphore 怎么选。
