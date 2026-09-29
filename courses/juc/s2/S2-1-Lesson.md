# AQS 源码剖析

> 本节难度：★★★★★
> 重要程度：★★★★★
> 学习产出：拆开封在 `ReentrantLock`、`Semaphore`、`CountDownLatch`、`ReentrantReadWriteLock` 内部的同一个引擎——**AQS（AbstractQueuedSynchronizer）**。掌握它的两大支柱 **`volatile int state` + CLH 变体的双向等待队列**，理解**独占（exclusive）与共享（shared）**两种模式、`tryAcquire/tryRelease` 模板方法、以及**公平 vs 非公平**在源码层面的那行差别。学完能回答"ReentrantLock 到底怎么排队、怎么唤醒"。

## 一、AQS 的骨架：state + 队列（★★★★★）

AQS 是一个**抽象同步器框架**，用模板方法模式把"如何判断能否获取"留给子类，把"排队、阻塞、唤醒"的通用逻辑自己实现。核心就两件东西：

```java
// 例子目的：点出 AQS 两根支柱字段——为什么 state 要 volatile、为何靠一条链表排队
private volatile int state;        // 同步状态，含义由子类定义，用 CAS 改（volatile 保证多线程可见）
private transient Node head, tail; // FIFO 双向链表：没抢到锁的线程进这里排队(Lock Support.park 挂起)
// 正确使用结果：子类只决定"如何改 state"（CAS 增减），排队/阻塞/唤醒全交给框架
// 错误用法：若 state 不加 volatile → 一个线程 CAS 改了值，另一线程可读不到新值，锁释放后等待者仍以为被占用（不前进）
```

- **`state`**：一个 int，**语义由子类赋予**——ReentrantLock 里是"重入次数"，Semaphore 里是"剩余许可数"，CountDownLatch 里是"还需倒数几次"，ReadWriteLock 里高 16 位读低 16 位写。对它的原子增减就是同步的"闸门"。
- **CLH 队列**：原 CLH 是自旋锁队列，AQS 改成**阻塞式双向链表**：CAS 抢 `state` 失败的线程被包成 `Node` 追加到 `tail`，然后 `LockSupport.park()` 挂起；队头节点在 `state` 可用时被 `unpark` 唤醒去抢。

```flow
tryAcquire(state CAS) ──成功──> 持有，直接执行
        │失败
        ▼
  封装成 Node → CAS 入队(tail) → 前驱是 head 且有资格则再试 → 否则 park 挂起
  ...释放时 tryRelease → state 归位 → unpark 队头 → 唤醒线程重新 tryAcquire
```

## 二、独占模式：以 ReentrantLock 为例（★★★★★）

子类实现模板方法（ReentrantLock.Sync）：

```java
// 例子目的：展示 ReentrantLock 的 tryAcquire/tryRelease 如何把 state 当"重入计数"用
// 非公平锁的 tryAcquire（公平版只多一个 !hasQueuedPredecessors() 判断）
protected boolean tryAcquire(int cuts) {
    int c = getState();
    if (c == 0) {                                   // 无人持有
        if (!hasQueuedPredecessors() &&             // 公平：队列里有人等就不许插队；非公平：去掉此判断直接抢
            compareAndSetState(0, cuts)) { setExclusiveOwnerThread(t); return true; }
    } else if (getExclusiveOwnerThread() == Thread.currentThread()) { // 可重入：自己已持有，state 累加
        setState(c + cuts); return true;
    }
    return false;
}
protected boolean tryRelease(int releases) {        // state 递减到 0 才真正释放
    int c = getState() - releases;
    boolean free = (c == 0); if (free) setExclusiveOwnerThread(null);
    setState(c); return free;                       // 重入 n 次要 unlock n 次
}
// 正确使用结果：lock() 两次→state=2，unlock() 两次→state=0 才真正释放，可重入不死锁
// 错误用法：lock() 两次只 unlock() 一次 → state 不归 0，其他线程永久 park（死锁，无异常）
// 错误用法：未持有锁就调 unlock() → tryRelease 发现 c<0，抛 IllegalMonitorStateException
```

要点：**可重入 = state 记录持有次数**；unlock 到 0 才释放并唤醒队头。**公平 vs 非公平的唯一源码差别**就是 `hasQueuedPredecessors()`——非公平允许"刚来的线程在 state 变 0 的瞬间直接 CAS 抢走"（吞吐高、可能饿死等待者），公平则要求先来先得。默认非公平。

`lock()` 主流程：`tryAcquire` 失败 → `addWaiter` 入队 → `acquireQueued` 自旋/挂起，直到前驱是 head 且抢到 → 返回。`LockSupport.park/unpark` 才是真正"让出/恢复 CPU"的地方。

## 三、共享模式：Semaphore 与 CountDownLatch（★★★★☆）

同一套队列机制，**共享模式**允许一次唤醒让多个/传播性放行：

- **Semaphore（信号量）**：`state`=许可数。`acquireShared` 用 CAS 把 state 减 1，减到负就入队挂起；`release` 加回并 `unpark`。用途：**限并发数**（如最多 10 个线程同时调下游，呼应 java-modern 虚拟线程下的下游保护）。
- **CountDownLatch**：`state`=计数，`await` 者挂起直到别的线程 `countDown()` 把 state 减到 0，一次性 `unpark` 全部等待者；**一次性、不可重置**（区别于可循环的 CyclicBarrier，见 s2-3）。
- **共享模式的 `setHeadAndPropagate`**：队头拿到后若还有余量，会继续唤醒下一个，形成"传播放行"——这是它与独占模式在源码上的关键差异。

## 四、condition：一把锁挂多个等待队列（★★★★☆）

`ReentrantLock.newCondition()` 返回 `ConditionObject`，每个 Condition 有**自己的一条单向等待队列**。`await()` 把线程从同步队列转移到条件队列并挂起、**顺便完全释放锁（state 归 0）**；`signal()` 把条件队列头节点**移回同步队列**去重新抢锁。这正是它比 `Object.wait/notify` 强的地方：**一个锁可以有多组等待条件**（如生产者-消费者用 `notFull`/`notEmpty` 两个 Condition 精准唤醒，见 s3-3）。

## 五、动手题

1. 用 `ReentrantLock` 演示重入：同一线程 `lock()` 两次必须 `unlock()` 两次才释放；把中间 unlock 去掉观察死锁。
2. 分别用公平/非公平 `ReentrantLock` 压测高竞争吞吐，体会"公平要 `hasQueuedPredecessors` 拒绝插队"带来的性能差。
3. 用 `Semaphore(3)` 限住"最多 3 个并发访问下游"、用 `CountDownLatch` 让主线程等 5 个子任务齐——各写一个最小 demo，说出它们的 state 含义。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| `lock()` 后偶发死锁/无法释放 | 忘在 `finally` 里 `unlock()`；重入次数与 unlock 不匹配 |
| 公平锁性能明显低于默认 | 每次都要查队列拒绝插队、上下文切换多 |
| CountDownLatch 之后计数用不了 | 它一次性、不可复用；要循环屏障用 CyclicBarrier |
| `signal()` 了但对方没醒 | await/signal 必须持有同一把锁；且 signal 只是"转移"回同步队列仍需抢锁 |
| 限流信号量许可"越来越多/越少" | acquire/release 不成对，或异常路径漏 release |

## 七、关联技术栈

- **向前**：CAS 改 state ↔ s1-2；阻塞/唤醒与 monitor 对比 ↔ s1-3；park/unpark 让出 CPU ↔ s1-1 阻塞语义
- **横向（同包）**：Semaphore/CountDownLatch/CyclicBarrier 详解 ↔ s2-3；读写锁（AQS 高低位 state）↔ s3-2；Condition 生产消费 ↔ s3-3
- **应用**：线程池的工作队列/拒绝 ↔ s2-2；虚拟线程下游限流用 Semaphore ↔ java-modern s2-1

## 八、本节小结

AQS 一句话：**`volatile state`（含义由子类定、CAS 增减）+ CLH 双向队列（抢不到就 Node 入队 park，释放方 unpark 队头）** 这套骨架，向上派生出独占（ReentrantLock，公平仅差一个 `hasQueuedPredecessors`）与共享（Semaphore/CountDownLatch 可传播放行）两模式，再加 Condition 多等待队列。看懂 state + 队列，所有 `java.util.concurrent` 锁都是它的变体。

下一节线程池七参数与执行流程——把"任务"如何被"线程"消化的全流程讲透。
