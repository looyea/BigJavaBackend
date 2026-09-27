# Java 21 LTS：虚拟线程时代 · 作业

> 不判分，对照参考要点自查。

## 作业 1：吞吐对比实验（必做）

写一个 handler，内部串行调用 3 个"各 `Thread.sleep(200)` 模拟 IO"的方法。用 JMeter/`wrk` 或自建循环，分别在① 固定 200 线程的平台线程池、② `newVirtualThreadPerTaskExecutor` 下压到 5000 并发，记录吞吐与错误率。写一句话结论。

**参考要点**：平台线程池下并发被 200 卡住、排队严重；虚拟线程能开数千并发、吞吐大幅提升（因阻塞让位）；但 DB/下游若成为新瓶颈需另做限流。

## 作业 2：钉住（pinning）复现与修复（必做）

写一个方法在 `synchronized(lock){ Thread.sleep(500); }` 里被大量虚拟线程并发调用，用 `-Djdk.tracePinnedThreads=full` 跑，观察钉住告警；改成 `ReentrantLock` 后重跑验证告警消失。

**参考要点**：`synchronized` 持锁阻塞时虚拟线程无法卸载 → 钉住载体线程；`lock()/unlock()` 走可卸载路径；热点同步块尽量锁粒度小、或用 ReentrantLock。

## 作业 3：下游保护设计（必做）

在第 1 题的虚拟线程版本里放开到 1 万并发直连一个"最多 50 连接的 DB"。说明会发生什么，并给出两种保护：① `Semaphore` 限并发；② HikariCP `maximumPoolSize` 上限。写清"虚拟线程数 ≠ 可以打爆下游"。

**参考要点**：连接池被瞬间打满、获取超时/雪崩；用信号量或连接池上限做背压；虚拟线程解放的是本并发的线程成本，不解放下游容量。

## 作业 4：结构化并发重写（选做，JDK 21 预览）

用 `StructuredTaskScope.ShutdownOnFailure` 重写"并行查库存+风控+优惠，任一失败则整体快速失败并取消其余"的逻辑，对比手写 `CompletableFuture.allOf + cancel` 的代码量与心智负担。

**参考要点**：scope.fork 多个子任务、join().throwIfFailed()；作用域结束保证无孤儿任务；需 `--enable-preview`，API 随版本演进要查对应 JDK 文档。

## 作业 5：ThreadLocal 治理（选做）

找出一个用到的大对象 ThreadLocal（如缓存的 `SimpleDateFormat`/缓冲），在虚拟线程场景下评估内存风险，给出替代（每线程成本可忽略但数量巨大→改无状态 `DateTimeFormatter`，或用 Scoped Values 思路）。

**参考要点**：百万虚拟线程各持大 ThreadLocal → 堆暴涨；优先无状态/不可变替代；Scoped Values（后续版本）为结构化上下文提供更轻的机制。
