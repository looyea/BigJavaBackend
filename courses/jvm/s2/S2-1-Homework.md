# 作业题 · 垃圾判定与回收算法

> 作业不判分，做完对照参考答案自查。全部在 JDK 17 上验证。

## 作业 1：四种引用行为对比（必做）

分别用强、`SoftReference`、`WeakReference`、`PhantomReference` 包裹对象，切断外部强引用后调用 `System.gc()`，打印各自 `get()` 结果与 `ReferenceQueue` 是否收到项。

要求：观察弱引用被清（`get()`=null）、软引用在小堆/内存紧张时才被清、虚引用 `get()` 恒 null 且回收时入队；注释说明四种引用的回收时机差异。

## 作业 2：静态集合泄漏复现与修复（必做）

写一个 `static List<byte[]> CACHE`，在一个循环里不断 `add(new byte[1<<20])` 从不移除，`-Xmx64m` 运行复现 `OutOfMemoryError: Java heap space`。

然后给出两种修复：① 用带上限 + LRU 淘汰；② 改用 `WeakHashMap` 或 `SoftReference` 缓存。注释解释为什么"处理完的对象"在原写法里仍可达（引用链挂到静态字段这个 GC Root）。

## 作业 3：观察 GC 分代与算法（必做）

用 `-Xlog:gc* -Xmx256m -XX:+UseSerialGC`（或 ParallelGC）跑一个不断创建短命对象 + 少量长命对象的程序，记录：

1. Minor GC 频次远高于 Full GC（印证"对象朝生夕灭"的分代假说）。
2. 结合日志里 Eden/Survivor/Old 变化，说明 Young 用复制、Old 用整理。

**参考答案要点**：短命对象在 Young 复制中很快被清；晋升到 Old 的少数才偶尔触发整理式 Full GC。

## 作业 4：写屏障成本感知（选做）

写一个热点循环，反复对堆内对象做引用字段赋值（`a.field = b`）与只做基本类型赋值两种版本，各开 `-Xlog:gc*,age,ps*`，对比 GC 日志中"引用处理/ref"相关耗时差异，体会"引用赋值会标脏卡、加重 GC"。

## 作业 5：安全点停顿排查（选做）

构造一个内部无安全点可达的超长计数循环（配合 `-XX:+UnlockDiagnosticVMOptions -XX:+ShowSafepointPauses` 或 `-Xlog:safepoint`），观察"到达全局安全点耗时"是否异常，注释说明为什么这类循环会拖长 STW。
