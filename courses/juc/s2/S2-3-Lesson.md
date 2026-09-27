# 并发容器与同步器

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：吃透 **ConcurrentHashMap** 的并发安全机制（CAS + 桶头 `synchronized`、`size` 的 `baseCount + CounterCell` 分散计数——结构本身已在 java-basics s1-3 讲透，这里只补"怎么并发安全"）；分清 **CountDownLatch / CyclicBarrier / Semaphore** 三个同步器的语义边界与选型；了解阻塞队列家族、`CopyOnWriteArrayList`、`ConcurrentLinkedQueue`。

## 一、ConcurrentHashMap：怎么"并发安全"（★★★★★）

（数组+链表+红黑树、树化阈值、扰动、2 幂容量等**结构原理见 java-basics s1-3**，本节不重复，专攻多线程下的正确性与性能。）

JDK 8 的 ConcurrentHashMap **抛弃了 JDK 7 的"分段锁 Segment"**，改为对**每个桶（数组槽位）单独加锁**，粒度细到一格：

- **put**：桶为空 → 用 **CAS** 直接放节点（无锁）；桶非空 → **`synchronized` 锁住该桶头节点**再尾插/树化。不同桶互不阻塞 → 高并发。
- **get / size 无锁读**：读靠 `volatile` 保证可见性；`Node.val`、`next` 都是 volatile。
- **size/统计**：不是一把全局锁，而是 **`baseCount` + `CounterCell[]` 分散计数**（和 LongAdder 同思路，见 s1-2）——高并发写 count 时把累加分散到多个 Cell，`sum()` 汇总，避免单点竞争。
- **扩容**：支持**多线程协助迁移**（`transferIndex` 分段领取，别的线程 put 时发现正在扩容会帮忙搬）。

> 三个高频坑：① `putIfAbsent/computeIfAbsent/merge` 才是原子复合操作，`if(!containsKey) put` 有竞态（呼应 s1-2 volatile n++）；② key/value **都不允许 null**（无法区分"没值"和"值是 null"，与 HashMap 不同）；③ `size()` 是**弱一致**快照，并发写时非瞬时精确。

## 二、同步器三兄弟：Latch / Barrier / Semaphore（★★★★★）

都建立在 AQS（见 s2-1）之上，但语义不同，选错是常见事故：

```flow
CountDownLatch   : 一个/多个线程 等 "N 个事件" 完成；计数减到0放行；一次性、不可复用
CyclicBarrier    : N 个线程 互相等 到齐；到齐执行可选屏障动作；可循环复用
Semaphore        : 控制 "同时进入的许可数"；acquire减/release加；限并发/资源池
```

- **CountDownLatch**：`await()` 挂在 state 计数上，别的线程 `countDown()` 减到 0 → 唤醒所有等待者。典型：主线程等 5 个子任务全好再汇总。**等的是"事件"，自己不计入 N。**
- **CyclicBarrier**：一组线程都 `await()` 到齐才一起过，可带 `barrierAction`。典型：多线程分阶段计算、每阶段对齐。**等的是"线程彼此"，参与者自己也算一个。** "Cyclic"=可重复（新一代 generation）。
- **Semaphore**：`acquire()` 占许可、`release()` 还许可，许可耗尽则挂起。典型：**限流**（最多 K 个并发打下游，呼应 java-modern 虚拟线程下游保护）、连接池/信号量式资源。

> 一句话选型：**等事件发生完 → Latch；等大家到齐再继续 → Barrier；限制同时访问的数量 → Semaphore。**

## 三、阻塞队列家族与其余并发容器（★★★★☆）

- **BlockingQueue**（线程池的 workQueue、生产消费的命脉，见 s3-3）：`ArrayBlockingQueue`（有界数组）、`LinkedBlockingQueue`（可选有界链表）、`SynchronousQueue`（不存、直接交接）、`PriorityBlockingQueue`（优先级无界）、`DelayQueue`（到期才取，做定时/延迟任务）。`take()` 空时挂起、`put()` 满时挂起——**自带阻塞 = 免费的生产者-消费者背压**。
- **CopyOnWriteArrayList**：写时**复制整个数组**再换引用，读完全无锁、永不阻塞。适合**读极多写极少**（监听器列表、配置白名单）；代价是写放大 + 读到的是**旧快照**（弱一致）。
- **ConcurrentLinkedQueue / CopyOnWriteArraySet**：无锁队列（CAS 尾插，见 s3-2 无锁思想）、写时复制 Set。

## 四、例子：并发容器与三同步器的正确用法（含错误用法）

```java
// 例子目的：一个程序展示 CHM 的"原子复合操作 vs 非原子判断后写"，及 Latch/Semaphore 的正确选型
import java.util.concurrent.*;
class ConcDemo {
    static final ConcurrentHashMap<String, Object> CACHE = new ConcurrentHashMap<>();

    public static void main(String[] args) throws Exception {
        // 【CHM】多线程初始化同一 key
        ExecutorService ex = Executors.newFixedThreadPool(8);
        for (int i = 0; i < 8; i++) ex.execute(() -> {
            // 错误用法：if(!CACHE.containsKey("k")) CACHE.put("k", build()); → 判断与写非原子，多个线程都挤进去，build() 被执行多次（重复初始化）
            CACHE.putIfAbsent("k", build());      // 正确用法：CAS 语义，仅一个线程真正写入
            CACHE.computeIfAbsent("k2", kk -> build()); // 正确用法：映射函数原子且只跑一次
        });
        // 错误用法：CACHE.put("nullVal", null); → 抛 NullPointerException，CHM 禁 null 键/值（无法区分"没值"与"值是 null"）
        ex.shutdown(); ex.awaitTermination(1, TimeUnit.SECONDS);

        // 【CountDownLatch】主线程等 3 个子任务完成
        CountDownLatch latch = new CountDownLatch(3);   // state=3
        for (int i = 0; i < 3; i++) ex.execute(() -> { doWork(); latch.countDown(); }); // 每个子任务减 1
        latch.await();                                  // 正确使用结果：主线程挂起直到 state 归 0，被唤醒后继续
        // 错误用法：拿 Latch 做"可循环屏障"——count 到 0 后不可重置，下一轮 await 直接返回（应用 CyclicBarrier）

        // 【Semaphore】限最多 2 个并发访问下游
        Semaphore sem = new Semaphore(2);
        sem.acquire();                                  // 占一个许可，许可耗尽则挂起
        try { callDownstream(); }
        finally { sem.release(); }                      // 正确用法：release 一定放 finally
        // 错误用法：异常路径漏 release → 许可只减不增，越用越少直到全体卡死（泄漏许可）
        // 错误用法：acquire 未配对就 release → 许可越释放越多，限流失效
    }
    static Object build() { try { Thread.sleep(20); } catch (Exception ignored) {} return new Object(); }
    static void doWork() { try { Thread.sleep(50); } catch (Exception ignored) {} }
    static void callDownstream() { try { Thread.sleep(100); } catch (Exception ignored) {} }
}
```

## 五、动手题

1. 用 `if(!map.containsKey(k)) map.put(k,v)` 和 `map.putIfAbsent(k,v)` 各跑多线程初始化，复现前者重复初始化、后者幂等，体会"原子复合操作"。
2. 三个同步器各写一个 demo：Latch 让主线程等 3 个子任务；Barrier 让 3 线程分两轮对齐；Semaphore 限最多 2 并发进临界资源。
3. 用 `BlockingQueue` 实现一个有界缓冲区，`put/take` 天然挂起，观察它与手动 Condition 版（s3-3）的等价性。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| CHM 里放 null 值抛 NPE | 它禁止 null 键/值（与 HashMap 不同） |
| 并发下同一 key 被初始化两次 | 用 containsKey+put 非原子，应 putIfAbsent/computeIfAbsent |
| CountDownLatch 下一轮 await 直接过 | 它一次性不可复用；要循环用 CyclicBarrier |
| Barrier 某线程 await 后异常导致全组 Broken | 有参与者中断/超时使屏障 broken，需捕获 BrokenBarrierException |
| Semaphore 越用越少直到卡死 | acquire/release 不成对，异常路径漏 release |
| CopyOnWriteArrayList 写操作 CPU/内存飙升 | 写时整数组复制，不适合高频写 |

## 七、关联技术栈

- **向前**：HashMap 结构与并发丢数据 ↔ java-basics s1-3；CAS/LongAdder/分散计数 ↔ s1-2；AQS state/共享 ↔ s2-1；workQueue ↔ s2-2
- **横向**：无锁队列 ↔ s3-2；生产消费者与阻塞队列/背压 ↔ s3-3
- **应用**：本地缓存选型（CHM vs Caffeine）↔ 数据库与缓存分区；MQ 缓冲 ↔ 中间件分区

## 八、本节小结

并发容器记住 **CHM = 桶级 `synchronized` + CAS 空桶 + 分散计数 + 协作扩容，禁 null、复合用 `computeIfAbsent`**；同步器用一句话切分——**Latch 等事件、Barrier 等彼此、Semaphore 限数量**；生产消费优先交给 **BlockingQueue**（自带阻塞=免费背压）。

下一节 ThreadLocal 与内存泄漏——线程私有存储的结构、弱引用 key 与线程池复用下的清理。
