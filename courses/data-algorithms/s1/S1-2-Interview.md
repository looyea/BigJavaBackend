# 面试考点 · 数组与链表

> 以"追问链"组织，覆盖高频起手题与其背后的内存/工程深挖。

## 考点 1：ArrayList 与 LinkedList 怎么选

**起手**：说说 ArrayList 和 LinkedList 的区别。

**追问链**：
1. 底层结构？→ 数组 vs 双向链表。
2. 随机访问谁快？→ ArrayList O(1)（地址可直接算），LinkedList O(n)（要遍历定位）。
3. "LinkedList 插入一定快"对吗？→ 不对。按 `index` 插要先 O(n) 找到位置，只有已持有节点/`ListIterator` 时改指针才 O(1)。
4. 那 ArrayList 中间删除慢在哪？→ `System.arraycopy` 搬移后续元素。
5. 扩容？→ ArrayList 约 1.5 倍 + `Arrays.copyOf`，尾部 add 均摊 O(1)；能预知规模就预分配。
6. 内存与缓存？→ LinkedList 每节点两指针 + 对象头，分散在堆上，缓存不友好；ArrayList 连续、预取友好。

**加分**：默认选 ArrayList；需要栈/队列语义用 ArrayDeque，而不是拿 LinkedList 凑。

## 考点 2：数组的几个 Java 专属坑

**起手**：Java 数组有哪些容易踩的点？

**追问链**：
1. `new int[4]` 内存里什么样？→ 栈上引用 + 堆上连续的 4 个 int，零初始化，带头部存长度。
2. 数组协变？→ `Object[] a = new String[1]; a[0]=1;` 运行期 `ArrayStoreException`。
3. `Arrays.asList` 能 add 吗？→ 不能，返回固定大小视图；要可变就 `new ArrayList<>(Arrays.asList(...))`。
4. 拷贝是深是浅？→ `arraycopy/copyOf` 浅拷贝，对象元素共享引用。

## 考点 3：手写/设计题——定长滚动结构

**起手**：实现"最多保留最近 K 条"的记录器，追加与读取都要快。

**期望**：
- 说清用循环数组（`head/size` 取模）而非链表：随机读 O(1)、满时覆盖最旧 O(1)。
- 边界：未满时 head=0；满了 head 随 tail 前进。
- 引申：这就是 RingBuffer / ArrayDeque 的核心思想，可用于日志缓冲、滑动窗口统计。

## 考点 4：为什么并发栈/队列不用 Vector/Stack

**起手**：`java.util.Stack` 有什么问题？

**期望**：继承 `Vector`、方法全 `synchronized`（吞吐差且锁粒度过粗）、暴露了 `get(i)` 等破坏栈语义的方法；正解是单线程 `ArrayDeque`、并发 `BlockingQueue`。（此点在做题/中间件选型追问中常考，与下一节衔接。）
