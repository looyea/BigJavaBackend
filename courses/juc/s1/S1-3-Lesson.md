# synchronized 锁升级

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：理解 `synchronized` 不是"一上来就重量级阻塞"，而是一把**会随竞争强度成长的锁**——无锁 →（偏向）→ 轻量级（CAS 自旋）→ 重量级（OS mutex 阻塞）的升级路径；知道它底层依托**对象头 Mark Word + monitor（管程）**；并能结合版本现实（**偏向锁 JDK 15 起默认废弃/移除**）给出准确表述，而不是背诵过时八股。

## 一、synchronized 锁什么：对象头与 monitor（★★★★★）

`synchronized(obj)` 锁的是 **obj 这个对象**（锁信息存在对象头）。HotSpot 对象头含 **Mark Word**（存哈希、GC 年龄、以及**锁状态标志位 + 指向锁数据的指针**）与类型指针。每个对象关联一个 **monitor（管程）**，含 owner（持有者线程）、EntryList（阻塞等待锁的队列）、WaitSet（`wait()` 等待通知的队列）——**重量级锁的"阻塞/唤醒"就是靠 OS 的 mutex/条件变量操作这几个列表**。

```java
synchronized (obj) { /* 字节码：monitorenter / monitorexit(含异常表) */ }
// 方法级 synchronized：靠访问标志 ACC_SYNCHRONIZED，由 JVM 隐式获取该对象(或Class)的 monitor
```

锁升级的本质，就是 **Mark Word 里的标志位和内容随竞争情况被改写**。

## 二、四级状态与升级路径（★★★★★）

```flow
无锁 ──(首次被某线程拿)──> [偏向锁] ──(第二个线程来抢)──> 轻量级锁 ──(自旋仍抢不到/竞争加剧)──> 重量级锁
 MarkWord:               存偏向线程ID    存栈中Lock Record指针   CAS 竞争+自适应自旋    指向monitor, 线程阻塞
```

- **偏向锁（Biased）**：假设"锁总被同一线程拿"，第一次在 Mark Word 记下线程 ID，之后该线程重入**无需 CAS**，几乎零成本。**代价**：换线程时要"全局 safepoint 撤销偏向"，很重。**现实**：现代应用线程复用（线程池）使偏向收益低、撤销成本高，**JDK 15 起默认关闭并废弃（JEP 374），后续版本移除代码**——面试要主动说明这点，别当"仍在用"。
- **轻量级锁（Lightweight）**：无偏向时，线程用 **CAS** 把 Mark Word 复制到自己栈帧的 Lock Record 并尝试替换为指向它的指针；成功即持有。适合**短暂竞争、多线程交错但不长时间抢**，靠自旋而非阻塞。
- **重量级锁（Heavyweight）**：CAS 反复失败（竞争激烈）则膨胀为重量级——对象头指向 monitor，抢不到锁的线程进 EntryList **阻塞（挂起，让出 CPU）**，唤醒靠 OS 调度。安全但涉及**用户态/内核态切换**，开销大。

> **只能升级、不能（轻易）降级** 是主流心智：一旦到重量级，即使竞争平息通常也不回退（GC 时会顺带做一些处理）。所以"热点锁被偶发抖动撑成重量级后长期是重量级"要心里有数。

## 三、自适应自旋与相关优化（★★★☆☆）

JVM 不会让轻量级锁无限自旋烧 CPU：**自适应自旋（Adaptive Spinning）** 根据"上次在同一锁自旋是否成功、由谁持有"动态调整自旋次数——成功过就多转、总失败就少转直接膨胀。配合 JIT 的**锁消除（Escape Analysis 证明锁对象不外泄则直接删锁）、锁粗化（连续加解锁合并成一次）**，`synchronized` 在无/低竞争下已相当快。

## 四、和 ReentrantLock 的分工（★★★★☆）

`synchronized`（内置、自动释放、不会忘 unlock、DCL 友好）与 `ReentrantLock`（显式、可**中断获取 `lockInterruptibly`**、可**超时 `tryLock`**、可**公平**、可**多条件 Condition**）：

| 需求 | 首选 |
| --- | --- |
| 简单互斥、保证一定释放 | synchronized（语法兜底） |
| 需要 tryLock/超时/可中断防死锁 | ReentrantLock |
| 需要公平锁 | ReentrantLock(fair) |
| 一组等待条件（多个 wait set） | ReentrantLock 多 Condition |
| 读写分离降冲突 | ReadWriteLock/StampedLock（见 s3-2） |

> 虚拟线程时代（java-modern s2-1）曾担心 `synchronized` 钉住载体线程，**JDK 24 已基本解决**——不必再为它一律改写 ReentrantLock。

## 五、动手题

1. 用 `-XX:+PrintClassHistogram`/JOL 或调试观察一个对象在无锁/被同步后的 Mark Word 变化（能演示到哪级取决于 JDK 版本，注意偏向锁在新版本已无）。
2. 写一段高竞争 `synchronized` 与方法级 `synchronized`，用 JFR（`jdk.JavaMonitorEnter/Contended`）观察阻塞与竞争事件。
3. 对比同一场景 `synchronized` 与 `ReentrantLock.tryLock` 的行为：前者拿不到一直等，后者可超时返回做降级。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 锁竞争激烈 CPU 高 + 吞吐低 | 大量线程升级到重量级后频繁阻塞/唤醒（内核态切换） |
| `synchronized` 块里做 IO 拖垮吞吐 | 同步块过大/含慢操作，monitor 长期被占，EntryList 堆积 |
| 死锁、无法自拔 | synchronized 不可中断；应改 `lockInterruptibly`/`tryLock` |
| 递归调用重复加锁开销 | 其实可重入无碍；但锁粒度过大仍需拆 |
| 按"偏向锁"八股答题被判过时 | 新版本默认无偏向锁（JEP 374），需按版本表述 |

## 七、关联技术栈

- **向前**：hb 的"unlock→lock"规则 ↔ s1-1；monitor 与 OS 线程阻塞 ↔ 操作系统/计算机网络分区
- **向后**：ReentrantLock 及其 AQS 内核 ↔ s2-1；读写锁/StampedLock/无锁 ↔ s3-2；虚拟线程下 synchronized 钉住与解钉 ↔ java-modern s2-1/s2-2
- **底层**：Mark Word、safepoint、对象内存布局 ↔ jvm 分区；GC 年龄位与锁标志复用同一字 ↔ jvm

## 八、本节小结

synchronized 的心智模型一句话：**它是"按需成长"的——无/轻竞争用 CAS+自旋（轻量级）几乎不阻塞，真竞争激烈才膨胀为重量级（OS mutex 阻塞）；一切记在对象头 Mark Word + monitor。偏向锁已被新版本废弃，别背旧八股。** 简单互斥优先 synchronized，需要超时/可中断/公平/多条件才上 ReentrantLock。

下一节 AQS 源码剖析——ReentrantLock、Semaphore 等共同的"state + CLH 队列"底座。
