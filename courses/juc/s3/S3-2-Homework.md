# 作业题 · 锁优化与无锁并发

> 作业不判分，做完对照参考答案自查。全部要求手写并能在 JDK 17+ 编译运行。

## 作业 1：三种计数器压测（必做）

写一个方法接收 `Runnable` 计数器，用 8 个线程各累加 100 万次，分别测试：

1. `synchronized` 修饰的静态方法累加；
2. `AtomicLong.incrementAndGet()`；
3. `LongAdder.increment()` + `sum()`。

要求：打印三者耗时，观察 `sync > AtomicLong > LongAdder`；用注释解释 `AtomicLong` 为何在高竞争下退化（CAS 失败自旋 + 缓存行失效）。

**参考答案要点**：竞争越激烈，单点 CAS 失败率越高；`LongAdder` 分散热点，写入吞吐最高，代价是 `sum()` 非瞬时精确。

## 作业 2：缩小临界区实验（必做）

写一个 `synchronized` 方法，内部先做一次 `sleep(50)`（模拟 IO）再自增共享计数。压测吞吐；然后把 IO 移出 `synchronized`，只在锁内做自增。

要求：对比 P99 与 QPS 提升；写一段"锁内禁做 IO/new/日志"的团队规范注释。

## 作业 3：读写锁写饥饿复现与 StampedLock 改造（选做）

1. 用 `ReentrantReadWriteLock`，起 20 个读者线程循环取读锁、1 个写者申请写锁，观察写者长时间拿不到锁（写饥饿）。
2. 把读路径改成 `StampedLock` 乐观读（`tryOptimisticRead` + `validate`，失败退悲观读锁），对比写者能否更快推进。

**参考答案要点**：`StampedLock` 乐观读不阻塞写者；但注意它**不可重入**、写锁会打断所有乐观读。

## 作业 4：手写 Treiber 栈并触发 ABA（选做）

用 `AtomicReference<Node>` 实现 `push/pop`；再用两个线程构造 ABA（一个线程 pop 出 A、随后 push 回一个"看起来一样"的节点），观察链表断裂；改用 `AtomicStampedReference`（版本随指针一起 CAS）修复。

要求：注释写清 ABA 为何在"引用看起来相等"时骗过朴素 CAS。
