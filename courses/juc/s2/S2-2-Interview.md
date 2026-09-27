# 线程池七参数与执行流程 · 面试追问

> "线程池有哪七个参数、执行流程怎样"是 Java 后端面试**出镜率最高**的题，且追问极深。答好关键：流程顺序别答反、max 何时生效讲清、Executors 为何禁用、参数怎么定。

## 题 1：线程池七个参数分别是什么？

**期望时长**：2 分钟

**答题要点**：

- `corePoolSize`（常驻核心）、`maximumPoolSize`（上限）、`keepAliveTime`+`unit`（非核心空闲存活）、`workQueue`（等待队列）、`threadFactory`（建线程，命名排查用）、`handler`（拒绝策略）。

**追问链**：核心线程会被回收吗？→ 默认不会，设 `allowCoreThreadTimeOut(true)` 后也可超时回收。

## 题 2：讲讲线程池提交任务后的完整执行流程。

**答题要点**：当前线程数 < core → 建核心线程；否则尝试入队；队满且 < max → 建非核心线程；线程达 max 且队满 → 拒绝策略。

**追问链（核心坑）**：为什么我 max 设很大却几乎用不上？→ 因为**队列没满就不会扩到 max**，任务一直排队；要么减小/有界队列，要么想"先扩线程"就用 SynchronousQueue。

## 题 3：拒绝策略有哪些？默认是哪个？

**答题要点**：`AbortPolicy`（默认，抛异常）、`CallerRunsPolicy`（调用线程自己跑，回压）、`DiscardPolicy`（静默丢）、`DiscardOldestPolicy`（丢最老再试）。生产常自定义：记录 + 落 MQ/DB 兜底关键任务。

**追问链**：核心下单任务能用 Discard 吗？→ 绝不能，丢了就是资损；必须兜底 + 告警。

## 题 4：为什么阿里手册禁用 Executors 创建线程池？

**答题要点**：`newFixedThreadPool`/`newSingleThreadExecutor` 用**无界** LinkedBlockingQueue → 堆积 OOM；`newCachedThreadPool`/`newScheduledThreadPool` max=Integer.MAX → 无限建线程 OOM。应手动 new ThreadPoolExecutor 显式有界队列与上限。

**追问链**：Spring 的 @Async 默认池要注意什么？→ 早期 `SimpleAsyncTaskExecutor` 不复用线程（虽新版有变），生产应显式配 `ThreadPoolTaskExecutor` 并设定容量/拒绝。

## 题 5：线程数设多少合适？

**答题要点**：CPU 密集 ≈ 核数+1；IO 密集 = 核数×(1+等待/计算) 或 2×核数起步；都只是**起点**，最终以压测 + 监控（active/queue/完成数、CPU、下游过载）收敛。线程多不等于快，瓶颈常在下游连接池。

**追问链**：能运行期改吗？→ 能，setCorePoolSize/setMaximumPoolSize 支持热调，配配置中心做大促临时扩容。

## 高频速答

- 流程顺序？→ 核心→队列→最大→拒绝。
- 默认拒绝？→ AbortPolicy 抛 RejectedExecutionException。
- 回压用哪个？→ CallerRunsPolicy。
- 为何 max 用不上？→ 队列没满不扩容。
- submit 异常？→ 封进 Future，get() 才以 ExecutionException 暴露。
- 线程命名干嘛用？→ dump/jstack 秒定位是哪个池/业务。
