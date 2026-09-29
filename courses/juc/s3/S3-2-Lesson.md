# 锁优化与无锁并发

> 本节难度：★★★★★
> 重要程度：★★★★☆
> 学习产出：建立"锁性能问题 = 竞争问题"的降维思路——**缩小临界区、降低锁粒度（分段）、读写分离、必要时无锁化**；讲清自旋锁的适用边界与适应性自旋；用 `LongAdder`/`Striped64` 的**分段 Cell** 碾压热点 `AtomicLong`；理解**伪共享（false sharing）**的缓存行成因与 `@Contended` 的填充隔离；掌握 `ReentrantReadWriteLock` 与 `StampedLock` 乐观读的取舍；并能解释 CAS 无锁队列（Treiber 栈 / Michael-Scott 队列）的**思想、ABA 与帮助清理**。这是把"高并发接口 P99 从 200ms 压到 20ms"落到代码层面的内功。

## 一、锁优化的总纲：一切从"减少竞争"出发

一把全局锁扛不住，不是因为锁本身慢，而是因为**大量线程在同一把锁上排队**。优化只有四个方向，优先级从高到低：

1. **可无锁则无锁**：用不可变对象、`ThreadLocal`、CAS 原子类，压根不争一把锁。
2. **缩短临界区**：把与共享数据无关的操作（尤其 IO、`new`、日志）挪出 `synchronized` 块。锁范围越小，竞争窗口越小。
3. **降低锁粒度**：一把锁拆成多把（**分段**），让不同线程锁不同段——`ConcurrentHashMap` 的段、`LongAdder` 的 Cell 都是这招。
4. **读写分离**：读多写少场景让"读读并行"，只在写时互斥——读写锁 / `StampedLock`。

> 经验：先做 2（免费），再评估 3/4（改结构），最后才上 1 的无锁数据结构（复杂、易错）。别一上来就"无锁"——多数瓶颈其实一个"缩小临界区"就解决了。

## 二、自旋锁：用 CPU 空转换线程上下文切换

线程抢不到锁时，有两种选择：**阻塞挂起**（让出 CPU，唤醒要重新调度，代价是内核态上下文切换 + cache 冷启动）或**自旋等待**（忙循环一会儿再看锁是否释放）。

- **适用**：临界区**极短**、多核可用、预计很快能拿到锁时，自旋避免了"切换出去又要切回来"的开销。
- **代价**：锁被长时间持有时，自旋线程纯烧 CPU 空转，还加剧对锁变量缓存行的争用。
- **适应性自旋（JVM `-XX:+DoEscapeAnalysis` 时代的默认策略之一）**：JVM 根据"上次在同一锁上自旋是否成功、且等待时长"动态决定这次要不要自旋、自旋几轮——失败过就改为直接阻塞，避免无脑空转。

```java
// 例子目的：手搓一个 CAS 自旋锁，展示"自旋换上下文切换"的本质与它的致命缺点
class SpinLock implements java.util.concurrent.locks.Lock {
    private final java.util.concurrent.atomic.AtomicInteger state = new AtomicInteger(0); // 0 未锁、1 已锁
    private volatile long owner = -1;                               // 记录持有线程，用于"是否重入/是否持有者解锁"判断
    public void lock() {
        while (!state.compareAndSet(0, 1)) { /* 自旋 */ }            // 错误用法：临界区长时这里无限空转烧 CPU；生产应加 backoff/上限后转阻塞
        owner = Thread.currentThread().getId();                      // 抢到锁后才记持有者（JDK 17 用 getId；19+ 可用 threadId）
    }
    public void unlock() {
        if (owner != Thread.currentThread().getId())                 // 正确用法：校验持有者（错误用法：任何线程都能 unlock → 锁语义被破坏）
            throw new IllegalMonitorStateException();               // 抛异常：非持有者误释放
        owner = -1; state.set(0);                                   // 释放：下次 CAS 才有机会成功
    }
    // 其余 Lock 方法省略...
}
// 正确使用结果：短临界区下吞吐优于重量级阻塞锁（省了 park/unpark）。
// 错误用法：把 RPC/DB 调用放进了临界区再用自旋 → 持锁期间干慢活，其他线程空转几万次，CPU 100% 且 P99 爆炸。
```

## 三、分段锁：把一把锁拆成 N 把

核心：**降低冲突概率**——两个线程落到不同段的概率越高，串行化越少。

- `ConcurrentHashMap`（JDK 7）用 `Segment[]` 分桶，每桶一把锁；JDK 8 改为"桶头节点 `synchronized` + CAS"，粒度更细到单个桶。
- `LongAdder` / `Striped64`：热点计数器不押在一个变量上，而是分散到 `Cell[]`，每个 Cell 各被一个线程 CAS，**sum = base + ΣCell**。

```java
// 例子目的：用 LongAdder 与 AtomicLong 对比高并发累加，展示"分段"如何碾压单点 CAS 热点
import java.util.concurrent.atomic.*;
LongAdder adder = new LongAdder();                 // 内部 Striped64：热点分散到多个 @Contended 的 Cell
AtomicLong counter = new AtomicLong();             // 单一 value，所有线程 CAS 同一个内存地址
for (int i = 0; i < 8; i++) {
    new Thread(() -> { for (int j = 0; j < 1_000_000; j++) { adder.increment(); counter.incrementAndGet(); } }).start();
}
// 正确使用结果：adder.sum() 与 counter.get() 都等于 8_000_000（结果都对）；但 adder 快得多——
//   AtomicLong 8 线程猛 CAS 同一地址 → CAS 失败率飙升 → 反复自旋重试，缓存行在核间来回失效；
//   LongAdder 把线程"映射"到不同 Cell，各 CAS 各的，几乎不冲突，最后 add 求和。
// 错误用法：需要"读取并原子地得到即时精确值 + 复杂比较更新"时硬用 LongAdder → sum() 是最终一致快照、非瞬时精确值，可能读到滞后。此场景该用 AtomicLong 的 CAS 循环。
```

**取舍**：`LongAdder` 牺牲"读取的即时精确性"换"写入的极致吞吐"。记账型、只关心总量（QPS 计数、曝光统计）用它；金融余额那种"读后要基于精确值做条件更新"的用 `AtomicLong`/锁。

## 四、伪共享与 @Contended：看不见的性能杀手

现代 CPU 以**缓存行（cache line，通常 64 字节）**为单位在核间同步。MESI 一致性协议下，一个核写某缓存行，会让其他核里**同一行**的副本失效。

**伪共享**：两个线程各自修改**逻辑上独立**的变量，但它们碰巧落在**同一缓存行**里 → 一个核写 A，另一个核的 B 也被迫失效重取 → 明明没共享数据却互相拖慢。这正是 `AtomicLong[]` 数组做分段计数反而更慢的经典原因：相邻 `long` 挤在同一行。

`@jdk.internal.vm.annotation.Contended`（JDK 8 内部；`@sun.misc.Contended` 更早）在字段前后**填充空白**，把它独占一个/多个缓存行。`LongAdder.Cell` 就标了它。

```java
// 例子目的：对比"两个热点计数器紧挨着"与"@Contended 填充隔离"，直观伪共享的影响
class PaddedLong { @sun.misc.Contended public volatile long value; } // 填充：value 独占缓存行，核间不再互相失效
class PlainLong     { public volatile long value; }                  // 不填充：两个 PlainLong 易落同一行→写一个失效另一个
// 正确使用结果：多线程各写各的 PaddedLong.value，吞吐明显高于紧挨的 PlainLong[]。
// 错误用法：滥用 @Contended → 每个字段都占满缓存行，内存膨胀、缓存容量浪费；它只该用在"确证的热点竞争字段"上（JVM 需 -XX:-RestrictContended 才对外部类生效）。
```

## 五、读写锁：读读并行，代价是写可能饿

`synchronized` 让读也互斥，读多写少时白白串行。`ReentrantReadWriteLock`：一个资源两把锁——**读锁共享、写锁独占**。

- **读读不互斥**、**读写互斥**、**写写互斥**；读锁可降级为写锁需谨慎，写锁可降读。
- **坑：写饥饿**——读锁持续被占用（总有新读者进来），等待的写者迟迟拿不到写锁。非公平模式下偶发，读极多时明显。

```java
// 例子目的：用读写锁缓存商品价目表，展示读多写少的并发收益与写饥饿风险
import java.util.concurrent.locks.*;
class PriceCache {
    private final ReadWriteLock rw = new ReentrantReadWriteLock();
    private java.util.Map<String,Integer> map = new java.util.HashMap<>();
    Integer price(String sku) { rw.readLock().lock(); try { return map.get(sku); } finally { rw.readLock().unlock(); } } // 读读并行
    void put(String sku, Integer p) { rw.writeLock().lock(); try { map.put(sku, p); } finally { rw.writeLock().unlock(); } } // 写独占
    // 错误用法：在 price() 里 unlock 前又递归取读锁做二次读→ 虽可重入，但忘记 unlock 一次→ 读锁泄漏，写者永远等不到→写饥饿死锁。
}
// 进阶：StampedLock 支持"乐观读"——读时不加锁，只读一个 version stamp，读完 validate 校验期间无写发生，成功即免锁，吞吐更高。
```

```java
// 例子目的：StampedLock 乐观读——读路径几乎零开销，并示范校验失败的正确退路
import java.util.concurrent.locks.StampedLock;
class Point {
    private final StampedLock sl = new StampedLock();
    private int x, y;
    int distFromOrigin() {
        long s = sl.tryOptimisticRead();          // 乐观读：不加锁，只抓一个版本戳（读极频繁时快过读锁）
        int cx = x, cy = y;                        // 先读快照
        if (!sl.validate(s)) {                     // 校验：期间若有写，s 失效
            long rs = sl.readLock(); try { cx = x; cy = y; } finally { sl.unlockRead(rs); } // 正确退路：升级为悲观读锁重读（记住 stamp 再解锁）
        }
        return (int)Math.sqrt(cx*cx + cy*cy);
    }
    // 错误用法：tryOptimisticRead 后不 validate 就直接用 cx/cy → 可能读到"写了一半"的撕裂值（x 新 y 旧）。
    // 错误用法：把 StampedLock 当可重入读锁递归使用 → 它不可重入，乐观/读/写模式误用会自锁。
}
```

## 六、无锁数据结构：CAS 的思想与 ABA

**无锁 = 不用互斥锁，靠原子 CAS（compare-and-swap）循环 + 恰当的数据结构保证正确性。**

- **Treiber 栈**：无锁栈，`push/pop` 用 `headRef.compareAndSet(old, new)`，多线程抢同一 head，失败就重读重试。
- **Michael-Scott 队列**：无锁队列（`ConcurrentLinkedQueue` 的原型），head/tail 两个原子引用，CAS 接力，并有**帮助（helping）**——一个线程发现链表指针不一致，会先帮别人把链接修好再重试，保证lock-free（有人能持续取得进展）。
- **lock-free vs wait-free**：lock-free 只保证"至少一个线程整体在推进"，单个线程可能反复 CAS 失败饿死；wait-free 才保证每个操作有限步完成（极少见、代价高）。

```java
// 例子目的：用 AtomicReference 手写 Treiber 无锁栈，暴露 CAS 的 ABA 隐患
import java.util.concurrent.atomic.*;
class Node<T>{ T val; Node<T> next; Node(T v){val=v;} }
class LockFreeStack<T> {
    private final AtomicReference<Node<T>> head = new AtomicReference<>(null);
    void push(T v){ Node<T> n=new Node<>(v); Node<T> o; do{ o=head.get(); n.next=o; } while(!head.compareAndSet(o,n)); } // 失败则重读 o 重试
    T  pop(){  Node<T> o,n; do{ o=head.get(); if(o==null) throw new NoSuchElementException(); n=o.next; } while(!head.compareAndSet(o,n)); return o.val; }
    // 正确使用结果：无阻塞、线程在 CAS 上前进；单生产者单消费者/低冲突下吞吐极佳。
    // 错误用法：高竞争下 CAS 失败率高 → 疯狂重试自旋，性能可能还不如一把分段锁；此时应退回 LongAdder/锁或队列。
}
// ABA 陷阱：pop 读到 head=A→ 别人 pop(A)、push 回一个"新的 A"（对象地址/引用看起来一样但内容不同）→ 你的 CAS(A→B) 误判成功，链表已断。
// 修复：用带版本号的引用（AtomicStampedReference，CAS 同时比 version），或 JDK 的 AtomicMarkableReference；呼应 juc s1-2 的 StampedReference 讲法。
```

## 七、动手题

1. 8 线程各累加 100 万，分别用 `synchronized`、`AtomicLong`、`LongAdder` 计时，观察耗时 `sync > AtomicLong > LongAdder`，用伪共享/CAS 失败率解释。
2. 把一个方法的 IO 调用挪出 `synchronized` 块，压测 P99 前后差异——体会"缩小临界区"最立竿见影。
3. 给读写锁制造"源源不断读者"，观察写者饥饿；改用 `StampedLock` 乐观读或加写优先策略对比。
4. 手写 Treiber 栈并构造 ABA（复用节点对象），用 `AtomicStampedReference` 修复。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 热点计数器越加越慢、CPU 高 | `AtomicLong` 单点 CAS 失败自旋；应换 `LongAdder` 分段 |
| 分段数组性能反不如预期 | 相邻 `long` 伪共享同一缓存行；`@Contended` 填充 |
| 偶发写者长时间拿不到写锁 | 读写锁读饥饿；改 `StampedLock` 或限并发读 |
| 无锁结构高并发下更慢 | 激烈竞争 CAS 反复失败空转；应回退到有锁/分段 |
| pop 拿到"半更新"的对象 | 无锁链表未做版本校验，中招 ABA |

## 九、关联技术栈

- **向前**：CAS 与 `AtomicXxx`、ABA/`StampedReference` ↔ juc s1-2；`synchronized` 锁升级 ↔ juc s1-3；AQS（读写锁基于它）↔ juc s2-1
- **并发容器**：`ConcurrentHashMap` 分段/CAS ↔ juc s2-3
- **底层**：缓存行与 MESI ↔ jvm s2（内存与 GC 的硬件边界）；JIT 对自旋的优化 ↔ jvm 执行引擎
- **工业级**：Disruptor 环形缓冲（序列号 + 伪共享填充 + 无锁多生产者）↔ 中间件/高性能实战

## 十、本节小结

锁优化的四条路：**无锁 > 缩临界区 > 分段降粒度 > 读写分离**。`LongAdder` 用**分段 Cell + `@Contended`** 治好了 `AtomicLong` 的**热点 CAS 与伪共享**；读写锁/`StampedLock` 让**读读并行**但要防**写饥饿**；CAS 无锁结构（Treiber/MS）胜在低竞争，输在高冲突自旋与 **ABA**——**"无锁"不是银弹，它只是把竞争的代价从"阻塞"换成了"重试"，竞争太激烈时反而更糟。**

下一节并发设计模式与生产者消费者模型——`Future`/`CompletableFuture` 编排、Actor 与 CSP 对比、背压。
