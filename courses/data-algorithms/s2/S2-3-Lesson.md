# 堆、优先队列与堆排序

> 堆是一种**只保证"堆顶是极值"**的部分有序结构：牺牲全局有序，换来"取最值 O(1)、增删 O(log n)、建堆 O(n)"。
> 它是优先队列、Top-K、堆排序、Dijkstra、中位数双堆的共同引擎——也是"用最小代价维护一个极值"的典范。

## 一、堆的定义与数组表示

**堆 = 完全二叉树 + 堆序性**：小顶堆满足"父 ≤ 子"，大顶堆满足"父 ≥ 子"。注意它**只保证父比子小/大，兄弟之间无序**——所以堆不是排序，只保证**堆顶**是全局极值。

完全二叉树的节点可**紧密塞进数组**，靠下标换算父子，无需指针：

```
// 例子目的：堆不需要指针，父子关系由下标算术直接给出
下标 i 的节点：  parent = (i-1)/2    left = 2i+1    right = 2i+2
数组:  [0]=1  [1]=2  [2]=3  [3]=5  [4]=4  ...   （小顶堆，堆顶在 index 0）
→ 应用例：index 1 的父是 (1-1)/2=0（即 1），左孩子是 2×1+1=3（即 5），无需任何遍历
```

正因"完全二叉树 + 数组连续存储"，堆天然缓存友好、无指针开销——这是它比同复杂度的树结构常数更小的原因。

## 二、两个基本动作：上浮与下沉

- **插入 offer**：放到数组末尾 → **上浮(sift-up)**：与新父比较，违反堆序就交换，直到归位。O(log n)。
- **弹出堆顶 poll**：把**最后一个元素**挪到堆顶 → **下沉(sift-down)**：与较小的孩子交换，直到满足堆序。O(log n)。

```java
// 例子目的：先造出被比较的对象，再当场入堆 / 看堆顶 / 弹出，把定义与实际使用连起来
record Task(int priority, String name) {}
Task x = new Task(5, "日终对账");
PriorityQueue<Integer> min = new PriorityQueue<>();          // 默认小顶堆（自然序）
min.offer(x.priority());                                     // 上浮 O(log n)，入堆后堆顶仍是最小值
int top = min.peek();                                        // 只看堆顶 O(1) → top = 5，不删除
int m   = min.poll();                                        // 弹出堆顶 O(log n) → m = 5，堆变空
System.out.println(m + "," + min.size());                     // 正确使用结果：输出 5,0
// 自定义比较器：稳妥写法是 Integer.compare，不用减法（减法会整型溢出）
PriorityQueue<Task> byPri = new PriorityQueue<>(Comparator.comparingInt(Task::priority));
byPri.offer(new Task(1, "告警")); byPri.offer(new Task(9, "报表"));   // 入堆后自动按优先级排序
System.out.println(byPri.poll().name());                      // 正确用例输出：告警（堆顶是优先级最小的）
```

> 用减法写 Comparator 有**整型溢出**风险（金融金额、时间戳），稳妥用 `Integer.compare(a,b)`。

## 三、O(n) 建堆：为什么不是 O(n log n)

把无序数组"heapify"成堆，直觉上 n 次插入是 O(n log n)，但**自底向上对每个非叶节点做一次下沉**只需 **O(n)**：越靠底的节点越多但下沉距离越短，级数 \(\sum \frac{h_i}{2^{h_i}}\) 收敛到线性。这是高频面试点——"建堆是线性的"。

## 四、堆排序：用堆完成的原地排序

1. **建大顶堆**（O(n)）。
2. 反复把堆顶（当前最大）与末尾交换、缩小堆的规模、对新堆顶下沉。
3. 全部处理完得到升序，总 O(n log n)，**原地 O(1) 额外空间**。

| | 堆排序 | 快排 | 归并 |
|---|---|---|---|
| 最坏 | **O(n log n)** 稳定 | O(n²) | O(n log n) |
| 空间 | **O(1)** | O(log n) 栈 | O(n) |
| 稳定性 | 不稳定 | 不稳定 | 稳定 |
| 缓存 | 差（跳跃访问） | 好 | 好 |

堆排序胜在"最坏也有保证 + 原地"，输在缓存不友好且不稳定，所以实际很少作主力排序（见 s3-2），但**堆的思想在 Top-K 里不可替代**。

## 五、Top-K：堆最有价值的战场

**从海量数据里取最大的 K 个**（内存只放得下 K）：维护**大小为 K 的小顶堆**——
- 遍历数据，比堆顶大就替换堆顶并下沉；堆顶始终是"当前 Top-K 里最小的"，比它小的新元素直接淘汰。
- 复杂度 O(n log K)、空间 O(K)，可**流式**处理，远胜全排序 O(n log n)。

```java
// 例子目的：10 亿数取最大 100，内存只放 K 个，流式跑完
long[] stream = {3L, 7L, 1L, 9L, 2L, 8L};              // 实际这里是 10 亿个数的缩影
int k = 3;
PriorityQueue<Long> heap = new PriorityQueue<>(k);      // 容量 K 的小顶堆，堆顶是"当前 Top-K 里最小的"
for (long v : stream) {
    if (heap.size() < k) heap.offer(v);                          // 未满 K 个直接入堆
    else if (v > heap.peek()) { heap.poll(); heap.offer(v); }     // 比堆顶大才淘汰堆顶、自己顶上
}
System.out.println(heap);                                        // 正确用例输出：[7, 8, 9]（集合内容正确，但迭代顺序不保证有序）
```

- 分布式：各分片取局部 Top-K → 汇总再取一次 Top-K（堆/归并）。
- "前 K 个高频元素"：先 HashMap 计数，再进堆按频次取 Top-K（哈希 + 堆组合）。

## 六、进阶用法

- **合并 K 个有序序列 / 链表**：把 k 个头节点入堆，每次弹最小、把它下一个补进堆，O(N log k)。
- **数据流中位数**：大顶堆存较小一半、小顶堆存较大一半，两堆平衡，堆顶即中位数，插入 O(log n)、查询 O(1)。
- **Dijkstra 松弛 / 任务调度按优先级**：都是优先队列（见 s3-1 图、并发线程池）。

## 七、Java 里的堆家族

| 类 | 特点 |
|---|---|
| `PriorityQueue` | 二叉堆，非线程安全，poll 保证最值，**迭代顺序不保证有序** |
| `PriorityBlockingQueue` | 线程安全版，`take` 空时阻塞，用于并发优先任务 |
| `DelayQueue` | 按到期时间排序的堆，任务到期才可取出，做定时/延迟队列 |

> 提醒：`PriorityQueue` 只保证 poll 出最值，`iterator()` 不排序；"取全有序"要 poll 到底或再排序。

## 八、例子：正确用法与错误用法

```java
// 例子目的：堆的四个真实陷阱——比较器减法溢出、迭代不有序、null 入堆、Top-K 选错堆型
import java.util.*;

public class HeapDemo {
    public static void main(String[] args) {
        // 知识点 1 错误用法：用减法写比较器，金融金额/时间戳相减直接溢出
        PriorityQueue<Integer> wrong = new PriorityQueue<>((a, b) -> a - b);   // 错误：两个大数相减会绕回负数
        wrong.offer(Integer.MAX_VALUE - 1);
        wrong.offer(Integer.MIN_VALUE);
        System.out.println(wrong.peek());   // 输出 2147483646：本该是最小值的 MIN_VALUE 没当上堆顶，堆序被比较器骗了
        PriorityQueue<Integer> right = new PriorityQueue<>(Comparator.comparingInt(Integer::compareTo));   // 正确：不自己写减法
        right.offer(Integer.MAX_VALUE - 1); right.offer(Integer.MIN_VALUE);
        System.out.println(right.peek());    // 正确使用结果：输出 -2147483648

        // 知识点 2 错误用法：把 PriorityQueue 当有序队列遍历
        PriorityQueue<Integer> pq = new PriorityQueue<>(List.of(5, 1, 3));   // 入堆后内部数组并不全序
        System.out.println(pq);                 // 输出形如 [1, 5, 3]：只保证堆顶最小，兄弟无序
        StringBuilder sb = new StringBuilder();
        while (!pq.isEmpty()) sb.append(pq.poll()).append(",");   // 正确用法：poll 到底才是升序
        System.out.println(sb);                 // 输出 1,3,5,

        // 知识点 3 错误用法：往优先队列塞 null
        try {
            pq.offer(null);              // 错误：堆化时要与父节点比较 → 抛 NullPointerException
        } catch (NullPointerException e) {
            System.out.println("优先队列禁止 null：无法参与堆序比较");   // 输出该行
        }

        // 知识点 4 错误取向：取最大的 K 个却维护大顶堆 → 每次淘汰不掉小的
        PriorityQueue<Integer> topK = new PriorityQueue<>(3);            // 正确：小顶堆，堆顶是候选里最小的
        int[] data = {9, 2, 7, 1, 8, 3};
        for (int v : data) { if (topK.size() < 3) topK.offer(v); else if (v > topK.peek()) { topK.poll(); topK.offer(v); } }
        System.out.println(topK.contains(9) + "," + topK.contains(8) + "," + topK.contains(2));   // 正确用例输出：true,true,false（最大的 3 个是 9/8/7）
    }
}
```

## 九、本节要点回顾

1. 堆=完全二叉树 + 堆序性，数组下标直接映射父子；只保证堆顶极值，不保证全局有序。
2. 插入上浮、弹出下沉各 O(log n)；**建堆 O(n)**（面试点）。
3. 堆排序原地、最坏 O(n log n) 但不稳定、缓存差，主力排序另有其人。
4. 堆的主场是 Top-K、K 路归并、中位数双堆、Dijkstra、优先调度——"用最小代价守住一个极值"。

下一节：B/B+ 树、Trie、跳表、并查集、布隆过滤器——把"结构选型"拓展到磁盘索引、前缀检索、Redis、依赖聚并与概率判存。
