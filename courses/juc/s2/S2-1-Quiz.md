# AQS 源码剖析 · 小测

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. AQS 的两大核心支柱是？（15分）

- A. 一个 HashMap 和一个 ArrayList
- B. `volatile int state` + 一条 CLH 变体的双向等待队列
- C. 两个 synchronized 块
- D. 一个 ThreadLocal 和一个 CAS

> 答案：B
> 解析：AQS = 用 CAS 增减的 `state`（含义由子类定义）+ 抢不到锁的线程被包成 Node 入队并 park 的双向链表（释放方 unpark 队头）。

### 2. ReentrantLock 公平锁与非公平锁在源码上的关键差别是？（15分）

- A. 完全不同的两套队列
- B. `tryAcquire` 里是否调用 `hasQueuedPredecessors()` 拒绝插队
- C. 公平锁不用 CAS
- D. 非公平锁不可重入

> 答案：B
> 解析：非公平允许新来的线程在 state 变 0 瞬间直接 CAS 抢走（吞吐高、可能饿死等待者）；公平版多一句 `!hasQueuedPredecessors()` 保证先来先得。默认非公平。

### 3. 【多选】关于 AQS 的 state 语义，下列对应正确的有哪些？（20分）

- A. ReentrantLock：state 表示锁被同一线程重入的次数
- B. Semaphore：state 表示剩余许可数
- C. CountDownLatch：state 表示还需 countDown 的次数，减到 0 唤醒等待者
- D. ReentrantReadWriteLock：state 的 32 位同时高 16 位记读、低 16 位记写

> 答案：ABCD
> 解析：四项均正确——state 是同一个 int，语义由各子类赋予，读写锁用高低位分别表示读/写占用。

### 4. 判断：`Condition.await()` 会释放锁并把线程转移到该 Condition 自己的等待队列，`signal()` 再把节点移回同步队列重新抢锁。（10分）

- A. 正确
- B. 错误

> 答案：A
> 解析：这正是 Condition 比 Object.wait/notify 强之处——一把锁可挂多个条件队列，实现精准唤醒（生产者-消费者 notFull/notEmpty）。

### 5. 填空题：AQS 中线程抢不到 state 后靠 `LockSupport.______` 挂起、被释放方 `unpark` 唤醒；CountDownLatch 是 ______（一次性/可循环复用）的。（10分）

> 答案：park / 一次性

### 6. 描述一个线程调用 `ReentrantLock.lock()` 从"抢到"到"排队挂起"再到"被唤醒获得"的完整 AQS 流程。（30分）

> 参考答案：
> - 先 `tryAcquire`：CAS 把 state 由 0 置 1 成功即持有（或已持有则重入累加）
> - 失败 → `addWaiter` 把当前线程封装成 Node，CAS 追加到队列 tail
> - `acquireQueued`：若前驱是 head 且有资格就再 `tryAcquire`；仍失败则 `LockSupport.park` 挂起
> - 持锁线程 `unlock`→`tryRelease`：state 递减到 0 才真正释放并 `unpark` 队头等待线程
> - 被唤醒线程重新走 tryAcquire，成功后 setHead、继续执行
> - 重入：同线程多次 lock 使 state 累加，需等量 unlock 才归零释放
