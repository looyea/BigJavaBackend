# 实际面试题 · 集合框架全景

> 收录 2024—2026 中大厂后端面试，含追问链。

## 题 1：说说 Java 集合的整体框架。

**答题要点**：

- 两大根：`Collection`（List/Set/Queue）与 `Map`（独立体系，不属于 Collection）。
- 每条分支给一两个代表实现并说特性：ArrayList/LinkedList、HashSet/TreeSet、HashMap/TreeMap。
- 加分：点出"接口与实现分离 + 骨架实现 Abstract*"。

**追问链**：为什么 Map 不继承 Collection？→ 它是键值对结构，语义与"一组元素"不同，通过 `keySet/values/entrySet` 三个视图桥接 Collection。

## 题 2：ArrayList 和 LinkedList 区别，什么时候用哪个？

**答题要点**：动态数组 vs 双向链表；随机访问、缓存友好看 ArrayList，已知位置的头尾插删看 LinkedList/ArrayDeque。

**追问链**：ArrayList 扩容机制？→ 1.5 倍 + `Arrays.copyOf`；能优化吗？→ 构造时给足初始容量。

## 题 3：HashMap、Hashtable、ConcurrentHashMap 的区别？

**答题要点**：

- HashMap 非线程安全、允许 null 键值；Hashtable 全表 `synchronized`、禁 null、已过时；ConcurrentHashMap 分段/CAS+synchronized 并发安全。

**追问链**：为什么 HashMap 线程不安全？→ 并发 put 触发扩容时数据覆盖甚至（JDK7 头插）成环，详见下一节。

## 题 4：fail-fast 与 fail-safe 的区别？

**答题要点**：fail-fast 基于 `modCount` 校验，遍历中被改就抛 CME（ArrayList/HashMap）；fail-safe 遍历副本或弱一致性（CopyOnWriteArrayList、ConcurrentHashMap），不抛但不保证读到最新。

## 题 5：HashSet 是怎么保证元素不重复的？

**答题要点**：HashSet 底层是 HashMap，元素作 key、伪常量作 value；去重依赖 key 的 `hashCode + equals`——先比哈希定位桶，再用 equals 确认同一。

**追问链**：只重写 equals 不重写 hashCode 会怎样？→ 相同对象落进不同桶，去重失效，这是高频线上事故。
