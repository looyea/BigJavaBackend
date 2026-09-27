# AQS 源码剖析 · 面试追问

> AQS 是"区分背八股 vs 真读过源码"的分水岭。答好要能画出 state + 队列、讲清独占/共享、说得出公平那行差别。这是高级岗硬考题。

## 题 1：讲讲 AQS 的原理。

**期望时长**：3 分钟

**答题要点**：

- 骨架：`volatile int state`（CAS 增减，语义子类定）+ CLH 变体双向等待队列。
- 抢：`tryAcquire` 失败 → 封装 Node 入队 → `LockSupport.park` 挂起。
- 放：`tryRelease` → state 到位 → `unpark` 队头 → 唤醒重抢。
- 模板方法：子类只实现 `tryAcquire/tryRelease`（独占）或 `tryAcquireShared/tryReleaseShared`（共享）。

**追问链**：为什么用双向链表 + 从 tail 插入？→ 入队 CAS 只碰 tail、O(1)，配合前驱/后继可高效处理取消与唤醒。

## 题 2：ReentrantLock 的公平与非公平，源码上差在哪？

**答题要点**：`tryAcquire` 中非公平省掉 `hasQueuedPredecessors()`；锁刚释放时非公平允许新来线程直接 CAS 抢（少一次唤醒/切换，吞吐高、可能饥饿），公平要求队列有人就不插队。默认非公平。

**追问链**：可重入怎么实现？→ state 记持有次数，同线程再 lock 累加、unlock 递减到 0 才释放。

## 题 3：CountDownLatch、CyclicBarrier、Semaphore 都能用 AQS 解释吗？

**答题要点**：都能——共享模式。CountDownLatch state=计数、减到 0 传播唤醒全部、一次性；Semaphore state=许可、acquire 减 release 加、可循环；CyclicBarrier 非直接用 AQS（基于 lock+Condition + 代 generation），但可对比：可复用、每轮触发屏障动作、大家互相等待。

**追问链**：Latch 和 Barrier 最大区别？→ Latch 是"等 N 个事件发生"（计数归零放行，不等彼此、不可复用）；Barrier 是"等 N 个线程到齐"（可循环、可带屏障动作）。

## 题 4：Condition 与 Object.wait/notify 的区别？

**答题要点**：wait/notify 依附 synchronized 的**单一** monitor WaitSet，唤醒难精准（易惊群）。Condition 依附 ReentrantLock，**一把锁可 new 多个 Condition**，每个有独立等待队列 → 精准唤醒（如 notFull/notEmpty）。await 释放锁进条件队列、signal 移回同步队列重抢。

**追问链**：signal 后对方立刻跑吗？→ 不，只是被移回同步队列，仍需抢到锁才从 await 返回。

## 题 5：AQS 里线程是怎么"睡着"和"叫醒"的？

**答题要点**：底层是 `LockSupport.park()/unpark(thread)`（基于 UNSAFE + OS 许可），比 `wait/notify` 更灵活（可先 unpark 后 park 不丢、可指定线程）。park 让线程让出 CPU 挂起，unpark 唤醒指定线程重新参与抢占。

**追问链**：和 synchronized 阻塞的区别？→ synchronized 靠对象 monitor 的 EntryList（重量级），ReentrantLock 靠 AQS 队列 + park；后者支持中断/超时/公平/多条件。

## 高频速答

- AQS 两支柱？→ state + CLH 双向队列。
- 独占 vs 共享？→ 独占一次一个（Lock）；共享可传播放行（Semaphore/Latch）。
- state 在读写锁？→ 高 16 位读、低 16 位写。
- 挂起/唤醒用什么？→ LockSupport.park/unpark。
- 为什么默认非公平？→ 吞吐更高、减少上下文切换。
