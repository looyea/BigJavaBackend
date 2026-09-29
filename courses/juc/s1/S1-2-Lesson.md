# volatile 与原子类

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：把上一节的 JMM 落到两个最常用工具上——**volatile 的确切语义**（可见性 + 禁重排，但**不保证复合原子性**）与**原子类的 CAS 机制**；理解 `Unsafe`/`VarHandle`、**ABA 问题及其解法（版本号 `AtomicStampedReference`）**、以及高并发计数为何用 **LongAdder 的分段（base + Cell[]）** 而非 AtomicInteger。能准确回答"volatile 能保证原子性吗"这道必考题。

## 一、volatile 的两条硬保证（★★★★★）

在 s1-1 的 hb 框架下，`volatile` 精确提供两件事，**不多不少**：

1. **可见性**：写 volatile 变量前插入 StoreStore、写后插入 StoreLoad 屏障，把该写刷回主内存并使其他核的缓存副本失效；读 volatile 前插入 LoadLoad，强制从主内存读最新值。于是"写 hb 后续读"成立。
2. **禁止重排序**： volatile 写之前的所有读写不能重排到它之后，volatile 读之后的读写不能重排到它之前——形成一条"栅栏"，常用来做**安全发布 / 状态标志 / DCL**。

```java
// 例子目的：演示 volatile 的"安全发布"——用一个 volatile 标志位保证读线程看到完整 data
private volatile boolean ready = false;
// 线程1：先准备好 data，再置 ready=true（StoreStore 屏障保证顺序）
data = compute();      // 普通写：先写普通变量
ready = true;          // volatile 写：把 data 的写一并刷回主内存
// 正确使用结果：线程2 读到 ready==true 时，data 必然已就绪（可见性 + 禁排序成立）
if (ready) { use(data); }   // volatile 读，data 必然可见
// 错误用法：去掉 volatile → ready 是普通变量，线程2 可能读到 ready==true 却拿到未初始化完整的 data（重排+不可见，随机 NPE/脏读）
// 错误用法：volatile int n; n++; → 误以为保原子，实际"读-改-写"三步被穿插，20 线程自增结果 < 20（丢更新，编译期无任何报错）
```

**它不做的**：不保证"读-改-写"复合操作原子。`volatile int n; n++;` 依然会丢更新——`n++` 是"读 n、加 1、写 n"三步，volatile 只让每一步各自可见，三步之间仍可被穿插。要原子，交给下一节的 CAS 或锁。

## 二、CAS：乐观并发原语与原子类（★★★★★）

`synchronized` 是悲观锁（先占锁再干活）；**CAS（Compare-And-Swap）是乐观**——"我以为当前值是 A，若真是 A 就改成 B，否则不改并告诉我实际值"，一条 CPU 原子指令（x86 的 `lock cmpxchg`）完成比较+交换，**无锁、靠硬件**。

```java
// 例子目的：手写 AtomicInteger.incrementAndGet 的 CAS 自旋本质，理解"乐观并发+失败重试"
// 底层：循环 CAS，失败(值被别人改了)就重试，直到成功——自旋
boolean cas(long expect, long update);   // 当前==expect 才置 update 并返回true

// AtomicInteger.incrementAndGet 本质（JDK8 用 Unsafe，JDK9+ 用 VarHandle）
int prev, next;
do { prev = getRaw(); next = prev + 1; }
while (!compareAndSet(prev, next));   // CAS 失败说明有竞争，重试
// 正确使用结果：多线程各自循环，最终值精确等于总增量（无锁也原子）
// 错误用法：把循环去掉、只 compareAndSet 一次 → 有竞争时直接返回 false，该次自增被吞（丢更新）
// 错误用法：超高竞争下仍用单值 CAS 自旋 → 大量线程反复失败空转，CPU 打满吞吐反降（该换 LongAdder 分段）
```

`AtomicInteger/AtomicLong/AtomicReference/Atomic*Array/AtomicIntegerFieldUpdater` 都是这套 CAS 的封装，适合**单个变量的原子更新**（计数、序号、状态位、引用交换）。

## 三、ABA 问题与解法（★★★★☆）

CAS 只比"当前值 == 期望值"，若某值从 A→B→A 转了一圈回来，CAS **看不出来发生过改动**，这就是 **ABA**。多数计数无害，但在**无锁栈/链表、对象池、余额**等场景，中间态被复用会导致逻辑错误（如把已被别人占用又释放的节点当成没动过）。

```java
// 例子目的：用带版本号的 StampedReference 破解 ABA——比较(值,版本)二元组
AtomicStampedReference<String> ref = new AtomicStampedReference<>("A", 0);
int[] stamp = new int[1];
String cur = ref.get(stamp);           // 同时取出当前值与版本
ref.compareAndSet(cur, "A'", stamp[0], stamp[0] + 1);   // 值+版本都对得上才改
// 正确使用结果：A→B→A 转一圈后版本已 +1，CAS 因版本不符而失败，识破了"值回来过"
// 错误用法：用裸 AtomicReference.compareAndSet("A","A'") → A→B→A 时值仍是 A，CAS 误判成功，无锁栈弹出已被复用的节点（结构错乱）
// 只关心"是否被改过几次"可用 AtomicMarkableReference（布尔 mark）
```

## 四、LongAdder：高竞争计数的分段智慧（★★★★★）

单变量 CAS 在**低/中竞争**很好，但**高竞争**下几十个线程狂抢同一个值，CAS 反复失败自旋，CPU 白烧、吞吐不升反降。`LongAdder`（Java 8）用"**分段/分散热点**"解决：

```flow
LongAdder:  平时累加到 base(无竞争时)
            一旦检测到竞争 → 展开 Cell[] 数组，按线程hash散列到不同 Cell 各自 CAS
            sum() 时 = base + Σ Cell（尽力快照，非瞬时强一致）
对比 AtomicInteger：一个热点值大家抢  →  多个 Cell 大家各抢各的（以空间换并发度）
```

- **吞吐更高**：把单点 CAS 冲突摊到多个 Cell，冲突率大降。
- **代价**：`sum()` 是最终一致快照（求和期间还在变），**不适合"要一个精确瞬时值 + 还要基于它做条件更新"**——那种仍用 AtomicLong（如库存扣减需“读出余额→判断充足→CAS 扣减”这类基于旧值的条件更新）。
- 这也是 **Java 8 `ConcurrentHashMap.size()`、`java.util.concurrent` 里计数**的底层思路（伪共享由 `@Contended` 缓解，见 s3-2）。

## 五、动手题

1. 写 `volatile` 标志位 + 数据"安全发布"demo，用 happens-before 说明读线程为何能看到完整对象。
2. 用 `AtomicInteger` 手写一个无锁自增栈/计数器；再故意制造 ABA（线程 A 读到值、B 改成别的又改回），用 `AtomicStampedReference` 修复。
3. 20 线程高并发自增，对比 `AtomicInteger` 与 `LongAdder` 的耗时，直观感受分段优势；并讨论何时必须回到 AtomicLong。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| `volatile int` 仍丢更新 | 误以为 volatile 保原子；`n++` 复合操作需 CAS/锁 |
| 高并发下 AtomicLong 成为瓶颈、CPU 飙高 | 单点 CAS 疯狂失败自旋，应换 LongAdder 分散 |
| 无锁链表偶发结构错乱 | ABA：值转一圈回来骗过 CAS，需 StampedReference |
| LongAdder.sum() 数不对 | 它本就是最终一致快照，别要求瞬时精确 |
| JDK9 升级后原子类反射 `Unsafe` 报错 | 底层从 Unsafe 迁到 VarHandle，注意模块化 |

## 七、关联技术栈

- **向前**：volatile/hb/重排 ↔ 上一节 s1-1；单次原子读写的"原子性"↔ s1-1 三大特性
- **向后**：CAS 是 AQS `state` 更新的基础 ↔ s2-1；无锁队列思想 ↔ s3-2；并发容器计数分段 ↔ s2-3 ConcurrentHashMap
- **底层**：`lock cmpxchg`、缓存行/伪共享 `@Contended` ↔ s3-2、jvm 分区
- **演进**：Unsafe → VarHandle（JDK 9）↔ java-modern 模块化对内部 API 的封装

## 八、本节小结

一句话定调：**volatile 管"可见 + 有序"，CAS 管"单个变量的原子更新"，两者不是一回事、不能互相替代**。原子类用 CAS 实现乐观并发；小心 ABA（版本号解）；高竞争计数用 LongAdder 分段换吞吐，但它是最终一致快照——需要"精确瞬时值 + 条件更新"仍回 AtomicLong。

下一节 synchronized 锁升级——偏向/轻量/重量级这把"会成长的锁"。
