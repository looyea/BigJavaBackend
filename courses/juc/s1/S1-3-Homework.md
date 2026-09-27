# synchronized 锁升级 · 作业

> 不判分，对照参考要点自查。

## 作业 1：观察对象头（必做）

用 JOL（`openjdk.jol`）打印一个普通对象、进入 `synchronized(obj)` 前后 obj 的 Mark Word（`ClassLayout.parseInstance`）。结合你用的 JDK 版本说明看到的锁状态（新版本可能无偏向，直接无锁↔轻量/重量）。

**参考要点**：Mark Word 低几位是锁标志（新版本 01 无锁、00 轻量、10 重量…具体位含义随版本）；演示到哪级取决于版本，别硬套"偏向"。

## 作业 2：锁膨胀实测（必做）

写一个高竞争 `synchronized` 计数方法，用 JFR 记录 `jdk.JavaMonitorEnter`/`jdk.JavaMonitorContended` 事件，观察竞争与阻塞时长；再把它改成 `LongAdder`（s1-2）对比 CPU 与吞吐。

**参考要点**：竞争激烈→重量级→大量 monitor 阻塞/唤醒（内核态切换）→CPU 高吞吐低；纯计数应分散热点而非抢一把锁。

## 作业 3：synchronized vs ReentrantLock 能力对比（必做）

同一"抢资源"场景分别用 ① `synchronized` ② `ReentrantLock.tryLock(50, MILLISECONDS)`，演示后者能在超时后走降级逻辑（返回忙、排队等），前者只能一直等。再补一段 `lockInterruptibly` 响应中断。

**参考要点**：synchronized 不可中断/无超时，遇死锁只能靠不发生；ReentrantLock 提供 tryLock/可中断/公平/多 Condition，代价是必须 finally unlock。

## 作业 4：锁消除/粗化验证（选做）

写一个方法内 `StringBuffer sb=new ...; synchronized(sb){...}`（sb 不外泄），用 `-XX:+DoEscapeAnalysis` 讨论这把锁为何可被消除；再写循环内反复对同一对象加解锁，说明锁粗化如何合并。

**参考要点**：逃逸分析判定对象不共享→删锁；连续 add/append 的细碎加解锁被 JIT 粗化成一次；这些是无竞争下 synchronized 快的原因。

## 作业 5：按版本表述偏向锁（选做）

用 150 字写一段"给面试官讲偏向锁"的话：先讲它本来的作用（同线程重入免 CAS）、为何后来 JDK 15 默认废弃（线程池复用收益低、safepoint 撤销贵）。避免说成"现在还在用"。

**参考要点**：体现你知道演进与原因，而非背静态八股——这恰是区分深浅的信号。
