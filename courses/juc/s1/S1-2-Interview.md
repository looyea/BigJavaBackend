# volatile 与原子类 · 面试追问

> volatile 与 CAS 是并发面试的"必答题"，且常连着问。高分点：一句话说清 volatile 保什么不保什么、CAS 原理与 ABA、LongAdder 分段动机。

## 题 1：volatile 的作用和原理？能保证原子性吗？

**期望时长**：2 分钟

**答题要点**：

- 保证可见性（写刷主内存、读强制最新，建立"写 hb 后续读"）+ 禁止重排序（前后各一道栅栏）。
- 底层：内存屏障 + 缓存一致性协议（MESI）。
- **不保证复合操作原子**：`i++`/`volatile 读改写` 仍丢更新。

**追问链**：那 volatile 用在哪些正确场景？→ 状态标志位、一次性安全发布（先写数据后置 ready）、DCL 单例禁重排。

## 题 2：什么是 CAS？它和 synchronized 的区别？

**答题要点**：

- CAS(expect,update)：当前值等于期望才更新，一条 `lock cmpxchg` 硬件原子指令，失败就自旋重试——**乐观、无锁**。
- synchronized 悲观：先获取 monitor 再执行，竞争时线程阻塞。
- CAS 适合冲突不极端的单变量更新；synchronized 适合保护一段复合逻辑。

**追问链**：CAS 缺点？→ ① ABA；② 高竞争下自旋烧 CPU；③ 只能保证单个变量原子（多变量要加锁或用 AtomicReference 包不可变对象）。

## 题 3：ABA 是什么？怎么解决？

**答题要点**：值 A→B→A 转回来，CAS 只比当前值，误判"未变"。在对象池/无锁链表可能出错。解法：`AtomicStampedReference` 比较 (值,版本戳) 二元组，或 `AtomicMarkableReference`。

**追问链**：普通计数器需要管 ABA 吗？→ 一般不需要，只关心最终总量；只有"值代表结构/状态且中间态有意义"才要防。

## 题 4：AtomicLong 和 LongAdder 怎么选？

**答题要点**：

- AtomicLong：单值 CAS，高并发下多线程抢同一值反复失败自旋 → 瓶颈。
- LongAdder：base + Cell[] 分段，把冲突分散到多个 Cell，`sum()` 汇总；**吞吐高但只是最终一致快照**。
- 选：纯统计计数（QPS）用 LongAdder；需要精确瞬时值或"读旧值判断再条件更新"（扣库存）用 AtomicLong。

**追问链**：LongAdder 为什么更快、代价是什么？→ 分散热点减少 CAS 失败；代价是 sum 非原子瞬时、内存换并发。

## 题 5：Unsafe 和 VarHandle 的关系？

**答题要点**：原子类过去直接依赖非公开 `sun.misc.Unsafe` 做 CAS/内存操作；JDK 9 起推荐用官方 `java.lang.invoke.VarHandle`（模块化后内部 API 被封装，呼应 s1-1 java-modern）。VarHandle 更细粒度控制内存序（plain/opaque/acquire-release/volatile）。

**追问链**：业务要自己写 CAS 循环吗？→ 优先用 Atomic* 封装；需要自定义内存序或字段级访问器时才直接上 VarHandle/Atomic*FieldUpdater。

## 高频速答

- volatile 保什么？→ 可见性 + 有序性，不保复合原子。
- CAS 三要素？→ 内存位置、期望值、新值。
- ABA 解药？→ AtomicStampedReference（版本号）。
- 高竞争计数？→ LongAdder（分段，sum 最终一致）。
- 对已有 int 字段做原子更新不动类？→ AtomicIntegerFieldUpdater。
