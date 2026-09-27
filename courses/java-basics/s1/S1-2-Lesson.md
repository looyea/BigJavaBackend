# 集合框架全景

> 本节难度 ★★★☆☆ · 重要性 ★★★★★
> 学习产出：能在白板上画出 Collection / Map 两大继承树，说清每个实现类的适用场景与复杂度，并解释"为什么 ArrayList 随机访问 O(1) 而中间插入 O(n)"。

## 一、集合框架是什么（★★☆☆☆）

Java 集合框架（JCF）是 `java.util` 下对"组对象"的统一抽象，由三层构成：

- **接口**（`Collection`、`List`、`Set`、`Queue`、`Map`）——定义契约。
- **实现**（`ArrayList`、`LinkedList`、`HashMap`、`TreeMap`…）——提供数据结构。
- **算法与工具**（`Collections`、`Arrays`、`Iterator`、比较器）——提供复用逻辑。

设计目标是"**接口与实现分离**"：程序面向接口编程，换实现不改调用（正是上一节多态的落地）。

## 二、它解决了什么问题（★★☆☆☆）

数组的三大局限：定长、无增删语义、无按值查找/去重/排序的现成能力。集合框架把"动态扩容、哈希查找、有序遍历、去重、队列/栈"这些高频数据结构标准化，让开发者用 `add/get/put/iterator` 即可，不必重复造轮子。

## 三、全景地图（★★★★☆）

```flow
Iterable → Collection → List(有序可重复): ArrayList / LinkedList / Vector→Stack
Collection → Set(去重): HashSet → LinkedHashSet / TreeSet(排序)
Collection → Queue(队列): ArrayDeque / PriorityQueue / LinkedList
Map(键值非Collection): HashMap → LinkedHashMap / TreeMap / Hashtable / ConcurrentHashMap
```

选择决策树：

| 需求 | 首选 | 理由 |
| --- | --- | --- |
| 随机访问多、增删少 | `ArrayList` | 数组下标 O(1)，缓存友好 |
| 头尾频繁增删 | `ArrayDeque` | 环形数组，比 Stack/LinkedList 更快 |
| 中间频繁插删且已知节点 | `LinkedList` | 双向链表 splice O(1)（查找仍 O(n)） |
| 去重、O(1) 判存在 | `HashSet` | 底层 HashMap |
| 去重且保插入序 | `LinkedHashSet` | 哈希 + 双向链表 |
| 去重且排序 | `TreeSet` | 红黑树，O(log n) |
| 键值映射 | `HashMap` | 下一节深挖 |
| 键有序 / 范围查询 | `TreeMap` | 红黑树 |
| 并发读写 | `ConcurrentHashMap` | JUC 专题 |

## 四、ArrayList 深入（★★★☆☆）

- 底层 `Object[] elementData`，`size` 记录逻辑长度，`capacity` 是数组物理长度。
- 扩容：默认初始 10，满时扩到 **1.5 倍**（`oldCapacity + (oldCapacity >> 1)`），再 `Arrays.copyOf` 拷贝。→ **批量添加前先 `new ArrayList<>(预计容量)`，省掉多次拷贝**。
- 中间 `add(i, e)` / `remove(i)`：`System.arraycopy` 搬移后续元素，O(n)。
- 随机访问 `get(i)`：一次数组寻址，O(1)。

## 五、LinkedList 深入（★★★☆☆）

双向链表，每个节点存 `prev/item/next`。它同时实现 `List` 和 `Deque`。

- `get(i)`：从较近的一端遍历，O(n)——**用它做随机访问是性能灾难**。
- 头尾 `addFirst/addLast/pollLast`：O(1)。
- 结论：绝大多数场景 `ArrayList`/`ArrayDeque` 更优，`LinkedList` 只在"已知位置的头尾操作"占优，且它内存开销（每节点两指针）大、CPU 缓存不友好。

## 六、特别注意点（★★★★☆）

1. **fail-fast 迭代器**：遍历时结构性修改集合，`modCount` 与预期不符 → `ConcurrentModificationException`。删除要用 `Iterator.remove()` 或 `Collection.removeIf`。
2. **`Arrays.asList` 是视图不是拷贝**：返回固定大小 List，`add/remove` 抛 `UnsupportedOperationException`；改数组会改 List。要可变用 `new ArrayList<>(Arrays.asList(...))`。
3. **`List.of`（Java 9+）不可变**：拒绝 null，任何修改都抛异常，适合做常量。
4. **集合只能存对象**：`List<int[]>` 合法，`List<int>` 不合法；基本类型走 `Integer` 等装箱，有性能与 `==` 缓存坑（`Integer` -128~127 有缓存）。
5. **equals/hashCode 契约**：放进基于哈希的集合，`equals` 相等必须 `hashCode` 相等——这直接决定下一节 HashMap 的正确性。

## 七、动手题

1. 给 100 万元素分别用预分配容量与默认扩容的 `ArrayList` 装满，对比耗时，体会拷贝代价。
2. 写一段在 `for-each` 中 `remove` 触发 CME 的代码，再分别用迭代器和 `removeIf` 修复。

## 八、关联技术栈

- **多态与接口**：骨架实现 `AbstractList`/`AbstractMap`（上一节）
- **泛型与类型擦除**：`List<T>` 的编译期约束（阶段二 s2-1）
- **equals/hashCode**：HashMap / HashSet 正确性的根（下一节）
- **并发集合**：`CopyOnWriteArrayList`、`ConcurrentHashMap`（JUC 专题）

## 九、本节小结

集合框架 = 两套继承树（Collection 与 Map）+ 若干数据结构实现的排列组合。选型看三件事：**要不要键值、要不要有序、增删还是查多**。记住"接口优先、按场景选实现、警惕几个反直觉 API"，就覆盖了 90% 的日常用图。

下一节把最常用的 `HashMap` 彻底解剖。
