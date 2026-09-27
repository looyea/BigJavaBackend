# AQS 源码剖析 · 作业

> 不判分，对照参考要点自查。

## 作业 1：重入与释放（必做）

用 `ReentrantLock` 写 `a(){ lock(); b(); unlock(); } b(){ lock(); ... unlock(); }`，同一线程两次 lock 两次 unlock，观察正常；少一次 unlock 后再取锁会永久阻塞（state 未归零）。写出 state 在每一步的值。

**参考要点**：进 a state=1、进 b state=2；每次 unlock 减 1；只 unlock 一次则 state 仍=1，别的线程 tryAcquire 失败入队 park。

## 作业 2：公平 vs 非公平吞吐（必做）

同一高竞争计数场景，分别用 `new ReentrantLock(true)` 与默认非公平压测吞吐，记录差异并解释 `hasQueuedPredecessors()` 为何让公平更慢。

**参考要点**：非公平可让"锁刚释放瞬间"的新线程直接抢走，减少一次上下文切换/唤醒，吞吐高但可能饥饿；公平强制排队，切换多。

## 作业 3：Semaphore 限并发（必做）

用 `Semaphore(3)` 包住"访问下游"的方法，起 10 线程并发调用，验证同时在下游里最多 3 个。故意在异常路径漏 `release()`，观察许可被耗尽卡死，再用 `try/finally` 修好。

**参考要点**：`acquire()` CAS 减 state、`release()` 加回；acquire/release 必须成对且 finally 释放，否则许可泄漏。

## 作业 4：CountDownLatch 汇合（必做）

主线程用 `CountDownLatch(5)` `await()`，提交 5 个任务各完成时 `countDown()`，验证主线程等全部完成再继续。说明它为何不能复用、要"多轮屏障"该换什么。

**参考要点**：state=5 减到 0 唤醒所有 await 者；一次性；可循环且每轮执行屏障动作的场景用 CyclicBarrier（见 s2-3）。

## 作业 5：双 Condition 生产消费（选做）

用一把 `ReentrantLock` + `notFull`/`notEmpty` 两个 Condition 实现一个有界阻塞队列的 put/take，说明相比单 `wait/notify` 的"惊群"，双 Condition 如何做到精准唤醒。

**参考要点**：put 满时 `notFull.await()`、成功后 `notEmpty.signal()`；take 空时 `notEmpty.await()`、成功后 `notFull.signal()`；各自只唤醒对应角色，避免无关线程被唤起再判断。
