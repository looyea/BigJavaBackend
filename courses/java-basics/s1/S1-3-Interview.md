# 实际面试题 · HashMap 深度解剖

> HashMap 是 Java 后端面试出现频率最高的一题，且层层追问。答好它 = 展示你读过源码 + 懂数据结构 + 有并发意识。

## 题 1：HashMap 的底层结构和工作原理？

**期望时长**：2 分钟

**答题要点**：

- JDK 8：数组 + 链表 + 红黑树。
- put：`hash` 扰动 → `(n-1)&hash` 定桶 → 空则放、冲突则尾插 → 链≥8 且表≥64 树化 → size>阈值扩容。
- get：同法定桶，沿链/树用 equals 比对。

**追问链**：

1. 为什么扰动要右移 16 位异或？→ 定桶只用低位，让高位信息参与，减少冲突。
2. 为什么容量是 2 的幂？→ 位与等价取模且分布均匀，扩容 split 高效。

## 题 2：树化阈值为什么是 8，退化为什么是 6？

**答题要点**：理想哈希下链长服从泊松分布，到 8 概率约 1e-7，树化是防碰撞攻击兜底；退化取 6 留迟滞区间防抖动；树化还要求表长≥64，否则先扩容。

**追问链**：那 HashMap 还会不会退化成 O(n)？→ 会，若 key 的 hashCode 被恶意/糟糕设计成高度冲突且表很大超过 64，则单链会先树化保护到 O(log n)。

## 题 3：HashMap 并发会有什么问题？怎么解决？

**答题要点**：

- 丢数据（同桶覆盖）、size 不准、JDK7 头插成环死循环。
- JDK8 尾插 + 正确 split 解了环但仍非线程安全。
- 解决：ConcurrentHashMap（CAS + 对桶头节点 synchronized，size 用 baseCount+CounterCell）。

**追问链**：为什么不用 `Collections.synchronizedMap`？→ 全表一把锁，吞吐差，复合操作仍需外部加锁。

## 题 4：为什么不建议用可变对象当 key？

**答题要点**：hashCode 随内部字段变化，put 后字段被改 → get 时定到别的桶找不到，对象"泄漏"在表里。用 `String`/包装类/`record` 等不可变类型。

## 题 5：HashMap、LinkedHashMap、TreeMap、Hashtable 一句话区分。

**答题要点**：HashMap 无序非线程安全；LinkedHashMap 加链表保插入/访问序（可做 LRU）；TreeMap 红黑树保键有序支持范围查询；Hashtable 线程安全（全表 synchronized）禁 null 已淘汰。

**追问链**：用 LinkedHashMap 怎么做 LRU？→ 构造传 `accessOrder=true`，重写 `removeEldestEntry` 返回 `size()>cap`。
