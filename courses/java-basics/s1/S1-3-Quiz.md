# 小测验 · HashMap 深度解剖（实验答辩式）

> 本节小测**不采用选择题**，而是一次源码走查 + 动手实验，按"根据实际情况设置格式"的约定设计。
> 完成下列任务并把答案写进你自己的笔记，然后回到本页点击「我已完成本小节自定义测验，标记通过」即可过关并解锁阶段二。
> 过关标准：任务 A、B、C 全部能口述清楚，D、E 至少完成一个并跑出预期结果。

## 任务 A：白板推导（必答）

不看资料，在纸上完整画出一条 `put("k", v)` 的执行流，从 `hashCode()` 到落到数组下标，标注每一步用到的公式：

- 扰动：`h ^ (h >>> 16)`
- 定桶：`(n - 1) & hash`
- 扩容触发：`++size > threshold`，其中 `threshold = capacity * loadFactor`

**自测点**：能否解释"为什么用位与代替取模""为什么容量必须 2 的幂"。

## 任务 B：源码定位（必答）

在 JDK 的 `HashMap.java` 中找到并各用一句话说明下列成员/方法的作用：

1. `static final int DEFAULT_INITIAL_CAPACITY`
2. `static final float DEFAULT_LOAD_FACTOR`
3. `TREEIFY_THRESHOLD` 与 `UNTREEIFY_THRESHOLD`
4. `MIN_TREEIFY_CAPACITY`
5. `final Node<K,V>[] resize()`
6. `final void treeifyBin(Node<K,V>[] tab, int hash)`

## 任务 C：并发危害口述（必答）

用自己的话说清三件事：

1. 为什么两个线程同时 `put` 可能丢失数据。
2. JDK 7 头插法在并发扩容时为什么会形成环形链表导致 `get` 死循环。
3. JDK 8 做了哪些改动避免了成环，但仍不线程安全的根本原因是什么。

## 任务 D：冲突实验（择一动手）

构造一个"坏 hashCode"的 key 类，让大量不同对象的 `hashCode()` 返回同一值：

```java
class BadKey {
    final int id;
    BadKey(int id){ this.id = id; }
    @Override public int hashCode(){ return 1; }          // 故意全冲突
    @Override public boolean equals(Object o){ return o instanceof BadKey && ((BadKey)o).id == id; }
}
```

往 HashMap 放 1000 个，用调试或反射观察某个桶是否树化、链表长度，记录"表长多少时才真正 treeify"。

## 任务 E：手写 LRU（择一动手）

继承 `LinkedHashMap`，重写 `removeEldestEntry` 实现容量上限为 3 的 LRU 缓存：

```java
class LRUCache<K,V> extends LinkedHashMap<K,V> {
    private final int cap;
    LRUCache(int cap){ super(cap, 0.75f, true); this.cap = cap; }   // accessOrder=true
    @Override protected boolean removeEldestEntry(Map.Entry<K,V> e){ return size() > cap; }
}
```

放入 5 个 key，验证只保留最近访问的 3 个。

## 评分参考（自查用，非自动判分）

- A/B/C 全过 → 具备过关基础。
- D 能解释"表长 < 64 时只扩容不树化"、E 能解释 `accessOrder=true` 的作用 → 优秀。
- 讲不清 `(n-1)&hash` 与 2 的幂关系 → 回到第四节重看。
