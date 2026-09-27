# 面试考点 · 哈希表原理与冲突处理

> 以追问链组织。HashMap 源码级细节（put 流程、树化阈值由来、并发死循环）在 java-basics 专节深挖，这里考结构与选型的通用理解。

## 考点 1：HashMap 原理（永恒起手题）

**起手**：说说 HashMap 的底层原理。

**追问链**：
1. 存一个 key 经历了什么？→ `hashCode → 扰动 h^(h>>>16) → &(n-1) 定桶 → 桶内链/树逐个 equals 比对`。
2. 为什么容量是 2 的幂？→ 让 `&(n-1)==%n` 且分布均匀、扩容 rehash 只看新增一位。
3. 冲突怎么解决？→ 链地址法；JDK8 链≥8 且表≥64 树化。
4. 什么时候扩容？→ `size > 容量×负载因子(0.75)`，2 倍扩容 rehash。
5. 为什么负载因子 0.75？→ 空间与冲突概率的泊松折中，链长达 8 概率约千万分之一。

## 考点 2：equals / hashCode 契约

**起手**：为什么重写 equals 必须重写 hashCode？

**期望**：哈希先按 hashCode 定桶再 equals 确认；若两对象 equals 相等但 hashCode 不同，会被放进不同桶导致"存进去取不出"。契约：equals 相等 ⇒ hashCode 相等（反之不必）。作键对象应不可变。

## 考点 3：哈希的退化与攻击

**起手**：HashMap 会不会退化成 O(n)？怎么防？

**追问链**：
1. 什么情况退化？→ 大量 key 撞同一桶（哈希质量差或恶意构造碰撞 = HashDoS）。
2. JDK 防护？→ 扰动 + 树化（退化到 O(log n)）+（其他语言）随机化哈希种子。
3. 为什么 String 适合做 key？→ 不可变 + 缓存 hash，不会入表后改变定位。

## 考点 4：HashMap vs ConcurrentHashMap vs Hashtable

**起手**：并发环境用哪个 Map？

**期望**：
- `Hashtable` 全表一把锁，吞吐差，过时。
- `ConcurrentHashMap` JDK8 用数组+链/树，`CAS`（空桶插入）+ `synchronized`（锁单个桶头）+ `size` 用 baseCount+CounterCell 分段，读无锁（volatile），高并发首选。
- 迭代器：CHM 弱一致不抛 `ConcurrentModificationException`。

## 考点 5：哈希思想的工程外延

**起手**：除了 Map，哈希还在哪些地方？

**期望**：去重(Set)、计数、布隆过滤器(概率判存在，见 s2-4)、缓存(一致性哈希做分片路由)、幂等(requestId 判重)、分库分表(hash 取模/一致性哈希)。**加分**：能指出"哈希不保序，所以范围/排名/前缀要交给树或跳表"。
