# 并发容器与同步器 · 面试追问

> ConcurrentHashMap 与三同步器是并发面试的常客。CHM 追问常接在 java-basics 的 HashMap 之后（结构→并发）；同步器考语义辨析。

## 题 1：ConcurrentHashMap 是怎么保证线程安全的？和 Hashtable 区别？

**期望时长**：2.5 分钟

**答题要点**：

- JDK 8：桶级 `synchronized`（非空桶锁头节点）+ 空桶 CAS + volatile 读；size 用 baseCount+CounterCell 分散；支持协作扩容。
- Hashtable：全表一把 `synchronized`（方法级），并发差、已淘汰。

**追问链**：为什么比"分段锁"更好？→ 锁粒度从段细化到单个桶，冲突概率大降、并发度更高。

## 题 2：CHM 为什么不允许 null 键/值？

**答题要点**：`get(key)` 返回 null 有歧义（键不存在 vs 值为 null）。单线程 HashMap 可用 containsKey 消歧，但并发下 containsKey+get 非原子，两次调用间值可能变，无法可靠判定 → 干脆禁止。

**追问链**：想表达"空"怎么办？→ 用 `Optional` 包装值或放一个显式哨兵对象（呼应 java-basics s3-3 Optional 返回值用法）。

## 题 3：CountDownLatch、CyclicBarrier、Semaphore 区别？

**答题要点**：

- Latch：等 N 个**事件**完成，减到 0 放行，**一次性**。
- Barrier：等 N 个**线程**到齐一起过，可带屏障动作，**可循环**。
- Semaphore：控**许可数**限并发，acquire/release。

**追问链**：Latch 能复用吗？→ 不能；要循环对齐用 CyclicBarrier。

## 题 4：`computeIfAbsent` 为什么线程安全？自己写 containsKey+put 为什么不行？

**答题要点**：containsKey 与 put 之间是竞态窗口，多线程可能都判"没有"再各 put，导致重复初始化/覆盖。computeIfAbsent 在桶锁内原子完成"判空+计算+放入"，同 key 只初始化一次（且要注意映射函数里别再递归改同一 map）。

**追问链**：mappingFunction 里能阻塞很久吗？→ 不宜——它持着桶锁，长阻塞影响该桶并发。

## 题 5：CopyOnWriteArrayList 适合什么场景？有什么代价？

**答题要点**：读完全无锁（volatile 数组引用）、迭代不抛 CME，适合**读极多写极少**（监听器、黑白名单）。代价：写时复制整数组 → 写开销大 + 内存翻倍瞬时 + 读到旧快照（弱一致）。

**追问链**：能保证并发一致吗？→ 只保证"不崩、读到某时刻快照"，不保证读到最新写；要强一致实时用 Collections.synchronizedList 或并发方案。

## 高频速答

- CHM 空桶怎么放？→ CAS；非空桶 → synchronized 头节点。
- CHM size 精确吗？→ 弱一致快照（分散计数）。
- 限并发用？→ Semaphore。
- 等到齐用？→ CyclicBarrier（可循环）。
- 等事件完成用？→ CountDownLatch（一次性）。
