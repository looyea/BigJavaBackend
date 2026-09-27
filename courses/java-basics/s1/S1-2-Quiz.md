# 小测验 · 集合框架全景

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. 需要大量随机 `get(i)` 访问、很少在中间增删时，首选结构是？（15分）

- A. LinkedList
- B. ArrayList
- C. TreeSet
- D. HashMap

> 答案：B
> 解析：ArrayList 底层数组，随机访问 O(1) 且缓存友好；LinkedList 的 get(i) 是 O(n)。

### 2. `Arrays.asList(1,2,3)` 返回的 List 调用 `add(4)` 会怎样？（15分）

- A. 正常追加
- B. 抛 UnsupportedOperationException
- C. 抛 ClassCastException
- D. 自动扩容后追加

> 答案：B
> 解析：它返回的是数组的固定大小视图，不支持结构性增删；要可变需 `new ArrayList<>(Arrays.asList(...))`。

### 3. 【多选】下列关于集合的说法，正确的有哪些？（20分）

- A. HashMap 的键可以为 null，且最多一个 null 键
- B. TreeSet 依赖元素的比较顺序去重，而非 hashCode
- C. ArrayList 扩容因子是 2 倍
- D. 遍历 for-each 时直接 `list.remove(obj)` 可能触发 ConcurrentModificationException

> 答案：ABD
> 解析：ArrayList 扩容是 1.5 倍不是 2 倍，C 错。A/B/D 均正确。

### 4. 判断：LinkedList 因为插入删除快，所以在几乎所有场景都应优先于 ArrayList 使用。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：LinkedList 查找仍 O(n)、内存与缓存开销大，多数场景 ArrayList/ArrayDeque 更优。

### 5. 填空题：把对象放入基于哈希的集合，必须保证 ______ 相等的两个对象其 ______ 也相等（填两个方法名）。（10分）

> 答案：equals / hashCode

### 6. 简述 ArrayList 与 LinkedList 的底层结构，以及它们在随机访问、中间插入删除上的复杂度差异。（30分）

> 参考答案：
> - ArrayList 基于动态数组，LinkedList 基于双向链表
> - ArrayList 随机访问 O(1)，LinkedList 随机访问 O(n)
> - ArrayList 中间插入删除需 arraycopy 搬移为 O(n)
> - LinkedList 已知节点处插入删除 O(1) 但定位节点仍 O(n)
> - 综合看 ArrayList 缓存友好、多数场景更优
