# HashMap 的深度解剖

> 本节难度 ★★★★☆ · 重要性 ★★★★★
> 学习产出：能手推一次 `put` 的完整路径（哈希→扰动→定桶→冲突→树化→扩容），解释为什么容量必须是 2 的幂、为什么树化阈值是 8 退化是 6，并说清 HashMap 在并发下为何危险。

## 一、HashMap 是什么（★★☆☆☆）

基于**哈希表**的键值映射实现，JDK 8 起结构为 **数组 + 链表 + 红黑树**。它不保证顺序，允许一个 null 键、多个 null 值，平均 O(1) 存取。

## 二、一次 put 的完整旅程（★★★★★）

```flow
put(key,value) → key==null 落到 0 号桶 → 否则 hash(key) 扰动 → (n-1)&hash 定位下标 → 桶空放新节点 → 冲突则尾插 → 链表长度≥8 且表长≥64 转红黑树 → size>阈值 触发扩容
```

源码主干（JDK 8+ 语义）：

1. 懒初始化：首次 put 才 `resize()` 建表，默认容量 16、负载因子 0.75。
2. 计算下标：`index = (n - 1) & hash`，其中 `n` 是数组长度（2 的幂）。
3. 桶为空 → 直接放 `Node`。
4. 桶不空 → 遍历，key 相等（hash + equals）则覆盖；否则尾插新节点。
5. 插入后若该链长度达到 `TREEIFY_THRESHOLD=8`，尝试 `treeifyBin`（表长 < 64 时只扩容不树化）。
6. `++size > threshold` → `resize()` 扩容为 2 倍。

## 三、扰动函数：为什么是 `h ^ (h >>> 16)`（★★★★☆）

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

定桶只用到低位（`(n-1)&hash`，n=16 时只取低 4 位），若 hashCode 高位有信息、低位区分度差，就会大量冲突。把高 16 位异或进低位，**一次异或让高低位都参与定桶**，以极小代价打散分布。

## 四、容量为什么必须是 2 的幂（★★★★★）

- 使 `(n-1)&hash` 等价于 `hash % n` 但快得多（位运算代替取模）。
- 只有 `n` 是 2 的幂，`n-1` 才是全 1 掩码，才能让 hash 的每一位都参与、分布均匀。
- 扩容时元素新位置只可能是"原位置"或"原位置 + 旧容量"，靠 `hash & oldCap` 是否为 0 判断，无需重算 hash——这是 JDK 8 扩容高效的关键。

```java
// resize 中的 split：高位那段决定去留
if ((e.hash & oldCap) == 0) 留在 loRun（原下标）;
else 移到 hiRun（原下标 + oldCap）;
```

## 五、树化 8、退化 6 的由来（★★★★☆）

- 理想哈希下链表长度服从泊松分布，长度到 8 的概率约千万分之一，树化是"防哈希碰撞攻击/极端分布"的兜底，不是常态。
- 退化阈值取 6（而非 8）留出**迟滞区间**，避免在 8 附近反复 treeify/untreeify 抖动。
- 树化前提表长 ≥ `MIN_TREEIFY_CAPACITY=64`，否则优先扩容散列。

红黑树节点通过 `parent/left/right/next` 维护，仍保留 `next` 以支持遍历；TreeNode 的查找退化到 O(log n)，比坏情况链表 O(n) 好。

## 六、并发下的 HashMap 为什么危险（★★★★★）

- **数据覆盖**：两个线程同时判断同一桶为空，后写覆盖前写。
- **size 失真**：`++size` 非原子。
- **JDK 7 死循环**：头插法并发扩容使链表成环，`get` 死循环打满 CPU；JDK 8 改尾插 + 正确 split 避免了环，但**仍不保证线程安全**。
- 正解：`ConcurrentHashMap`（JUC 专题细讲），切勿用 `Collections.synchronizedMap` 当高并发方案（全锁）。

## 七、特别注意点（★★★★☆）

1. **key 要用不可变对象**：`String`/包装类/`record` 最佳；可变对象一旦 hashCode 改变就"查无此 key"，内存泄漏。
2. **重写 equals 必重写 hashCode**（上一节契约），否则 put/get 行为诡异。
3. **初始容量估算**：`expectedSize / 0.75 + 1`，避免边放边扩容；`HashMap` 构造传的是容量不是阈值。
4. **null 键**：hash 为 0，恒定落在 0 号桶，可与真实 key 冲突共存于同链。
5. **LinkedHashMap** 只多维护一条双向链表记录顺序，靠它 + `removeEldestEntry` 能轻松实现 LRU。

## 八、关联技术栈

- **equals/hashCode**（上一节）
- **红黑树**：TreeMap/TreeSet 同款数据结构
- **并发**：ConcurrentHashMap 的 CAS+synchronized、size 控制（JUC 专题）
- **缓存**：LRU（LinkedHashMap）、布隆过滤器与哈希的关系（高并发专题）

## 九、本节小结

HashMap 的全部设计都围绕一句话：**用空间（数组）换时间（O(1) 定位），用扰动和 2 的幂让分布均匀，用链表兜冲突、红黑树兜极端、扩容兜负载**。把"put 六步、为什么 2 的幂、树化 8/6、并发四坑"讲清楚，这块知识就通关了。
