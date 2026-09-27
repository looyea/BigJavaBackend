# 数组与链表

> 两种最基础的线性结构，一个用**连续内存**换随机访问，一个用**指针链接**换灵活增删。
> 架构层面真正要掌握的是：它们的内存布局如何决定缓存命中、JDK 里对应哪个类、以及"LinkedList 插入快"这个谣言的真相。

## 一、数组：连续内存换来的 O(1) 随机访问

数组把元素**连续存放**，于是 `a[i]` 的地址 = 基地址 + i×步长，一条指令定位，O(1) 随机访问。代价是：

- **定长**：容量固定，扩容必须新建更大数组并整体拷贝 → O(n)。
- **中间增删慢**：要移动后续所有元素 → O(n)。
- **缓存友好**：连续布局让 CPU 预取命中率极高，这是它遍历比链表快数倍的根因（空间局部性）。

```java
int[] a = new int[4];   // 引用在栈、4 个 int 在堆上连续存放，零初始化
// 越界访问抛 ArrayIndexOutOfBoundsException；边界检查有 JIT 优化
```

工程启示：**以遍历 / 随机访问 / 统计 / 排序为主的场景几乎永远选数组**，Java 里 `ArrayList` 的底座就是数组。

## 二、ArrayList：数组的封装与扩容的均摊成本

`ArrayList` 用可变数组实现，`add` 满时按 **1.5 倍** 扩容（`oldCapacity + (oldCapacity >> 1)`）并 `Arrays.copyOf` 拷贝。

```java
List<Integer> list = new ArrayList<>(n);  // 已知规模→预分配容量，消除反复扩容
for (int i = 0; i < n; i++) list.add(i);
```

- 尾部 `add`：均摊 O(1)（扩容是等比数列，总拷贝 < 2n）。
- `get/set`：O(1)。
- 中间 `add/remove`：O(n)（`System.arraycopy` 移动后续元素）。
- **能预知规模就 `new ArrayList<>(初始容量)`**，是后端基本功；自动装箱类型 `ArrayList<Integer>` 还有拆箱与对象开销，量大用 `int[]` 或基本类型流。

## 三、LinkedList：双向链表，以及"插入快"的真相

`LinkedList` 是双向链表，每个节点存 `prev/item/next`。号称"插入删除 O(1)"，但要看前提：

```java
list.add(index, e);   // 先 index 定位——这一步就是 O(n)！
```

| 操作 | ArrayList | LinkedList |
|---|---|---|
| get(i) 随机访问 | **O(1)** | O(n) 需遍历定位 |
| 尾部 add | 均摊 O(1) | O(1) |
| 按下标中间 insert/remove | O(n) 移动 | **定位 O(n)** + 改指针 O(1) |
| 已知节点/迭代器处增删 | O(n) | **O(1)** |
| 内存 / 缓存 | 紧凑、缓存友好 | 每节点两指针 + 对象头，分散、缓存差 |

**关键真相**：LinkedList 只有在**已经持有目标节点或 `ListIterator`** 时，O(1) 改指针才兑现；否则光是"找到插入位置"就 O(n)，还额外付出指针内存与缓存不友好的代价。实测中 `ArrayList` 在绝大多数负载下都更快、更省内存。

> 架构判断：除非有明确的"迭代过程中频繁在当前位置增删"场景，**默认用 ArrayList**。要当栈/队列用请交给下一节的 `ArrayDeque`，别拿 LinkedList 凑。

## 四、数组 vs 链表：一条决策线

| 需求 | 选择 | 理由 |
|---|---|---|
| 随机访问、遍历、排序 | 数组/ArrayList | O(1) 访问 + 缓存友好 |
| 频繁头部插删且持有引用 | 链表 | 改指针 O(1) 无需搬移 |
| 长度已知/基本类型大量数据 | 原始数组 `int[]` | 无装箱、内存连续 |
| 需要队列/栈语义 | ArrayDeque（下一节） | 循环数组，兼顾两者 |

## 五、工程坑位

1. **数组协变陷阱**：`Object[] a = new String[10]; a[0]=1;` 运行期 `ArrayStoreException`——Java 数组是协变的但类型检查在写时。
2. **多维数组**是"数组的数组"，行不连续时遍历缓存变差；数值计算常用一维 + 下标换算替代二维。
3. **`Arrays.asList` 返回固定大小视图**，对其 `add/remove` 抛 `UnsupportedOperationException`；要可变得 `new ArrayList<>(Arrays.asList(...))`。
4. **拷贝**：`System.arraycopy` / `Arrays.copyOf` 是浅拷贝，元素为对象时共享引用，深拷贝需手写或用序列化/`record with`。

## 六、本节要点回顾

1. 数组用连续内存换 O(1) 随机访问与缓存友好；扩容与中间增删是 O(n)。
2. ArrayList 是数组封装，1.5 倍扩容均摊 O(1)；已知规模请预分配容量。
3. LinkedList 的 O(1) 插入只在已持有节点时成立，日常几乎总被 ArrayList 打败。
4. 选型主线：访问/遍历为主 → 数组；持引用频繁头删 → 链表；栈/队列 → 交给 ArrayDeque。

下一节把这些线性结构收敛成两种受限却极常用的抽象——栈与队列，以及通吃两端的双端队列。
