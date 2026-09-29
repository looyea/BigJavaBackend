# 平衡树与红黑树

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：AVL 与旋转、红黑树五条性质与插入修复、TreeMap/TreeSet 应用，为何工程偏爱红黑而非严格平衡。

> BST 会退化成链表，平衡树用**旋转**把高度重新压回 O(log n)。
> 本节把三件事讲透：① 旋转这个唯一的基本动作；② AVL（严格平衡）与红黑树（折中平衡）的取舍；③ JDK `TreeMap`/`TreeSet` 为什么选红黑树，以及它的工程用法。

## 一、旋转：平衡树唯一的基本动作

所有自平衡树的修复都建立在**局部旋转**上，它不破坏 BST 的中序有序性：

```
// 例子目的：一次左旋就把"右偏链"压矮一层，注意中序序列 a,b,c 完全不变
      x                 y
     / \      左旋x     / \
    a   y    ------->  x   c
       / \            / \
      b   c          a   b
```

- **左旋 x**：把右孩子 y 提上来，x 降为 y 的左孩子，y 的原左子树 b 挂回 x 的右。
- **右旋**：镜像操作。
- 一次旋转 O(1)，只改变局部指针、中序序列不变——这是它能"边保持有序边修平衡"的根本。

## 二、AVL：严格平衡，查询极快

**AVL 不变式**：任意节点左右子树**高度差 ≤ 1**。靠在每个节点存 balance factor，插入/删除后沿路径回溯，失衡时做 LL/RR/LR/RL 四种情形之一的一次或两次旋转恢复。

- 高度严格 ≤ \(1.44\log_2 n\)，比红黑树更矮 → **查找更快**。
- 代价：为维持严格平衡，插入/删除可能触发**多次旋转**，写放大明显。
- 适用：**读多写少、要求极低查询延迟**（内存字典、路由表）。

## 三、红黑树：用颜色换来的"够用就好"

红黑树放弃严格平衡，改用**着色规则**约束最长路径 ≤ 2× 最短路径，从而高度 ≤ \(2\log_2(n+1)\)，仍保证 O(log n)：

**五条性质**：
1. 每个节点红或黑；
2. 根是黑；
3. 所有叶子（NIL 空节点）视为黑；
4. **红节点的孩子必为黑**（不存在连续红节点，"红红不相连"）；
5. **任一节点到其所有后达叶子的路径上黑节点数相同**（黑高一致）。

由 4+5 可推出：一条路径不可能全红又比别的路径长 2 倍以上 → **最长 ≤ 2× 最短** → 高度有界。

**插入修复思路**（新节点先染红，只可能破坏性质 4）：看"叔叔"节点颜色分三种：
- **叔叔红**：父、叔染黑，爷爷染红，把冲突上移一层继续处理（变色 + 上溯，不旋转）。
- **叔叔黑 + 折线（LR/RL）**：先对父做一次旋转转成直线。
- **叔叔黑 + 直线（LL/RR）**：对爷爷一次旋转 + 换色，结束。

删除更复杂（涉及双黑修复），但同样 O(log n) 且旋转次数有常数上界。

## 四、AVL vs 红黑树：为什么工程偏爱红黑

| 维度 | AVL | 红黑树 |
|---|---|---|
| 平衡度 | 严格（更矮、查更快） | 近似（稍高） |
| 插入/删除旋转 | 可能多次 | **≤ 2~3 次**（变色为主） |
| 写密集 | 差 | **好** |
| 实现复杂度 | 需存 balance、四种情形 | 变色 + 少量旋转 |
| 典型选择 | 读极端多 | 通用（JDK/Linux/多数库） |

**结论**：红黑树用"查询稍逊、但插入删除的旋转次数少且修复以变色为主"换来了**综合最稳的性能**，所以 `TreeMap`、Linux CFS 调度器、Nginx、epoll 等普遍选它。面试常问"为什么不严格平衡"——答案就是**写放大与旋转成本的权衡**。

## 五、TreeMap / TreeSet：红黑树的 JDK 门面

`TreeMap` 是**有序键**的 Map，`TreeSet` 是基于 TreeMap 的有序集，全部 O(log n)，并独有一批**哈希给不了**的能力：

```java
// 例子目的：定义订单号→订单的有序表，并当场把"后继/前驱/区间/极值"四个能力都用起来
record Order(long id, String name) {}
NavigableMap<Long, Order> tm = new TreeMap<>();
tm.put(10L, new Order(10, "A"));                     // 写入后内部自动按 key 保持红黑平衡有序
tm.put(20L, new Order(20, "B"));
tm.put(30L, new Order(30, "C"));
tm.ceilingKey(15L);        // ≥ 15 的最小键（后继）→ 结果 20
tm.floorKey(15L);          // ≤ 15 的最大键（前驱）→ 结果 10
tm.subMap(10L, true, 30L, false);   // 区间 [10,30) 视图 → 结果是 {10=A, 20=B}，不拷数据而是活视图
tm.firstEntry(); tm.lastEntry();    // 最小/最大 → 结果 10=A / 30=C
System.out.println(tm.floorKey(15L));   // 正确使用结果：输出 10（HashMap 做不到的前驱定位）
```

**杀手级场景**（都建立在"有序 + 最近匹配"上）：
- 利率/阶梯费率：按金额 `floorEntry(amount)` 找适用档位。
- 时间轴/配置版本：按时间戳找"某时刻生效的那版"。
- 延迟队列、一致性排序环、限流的滑动窗口边界定位。

> `TreeMap` vs `HashMap`：要有序/范围/前后最近 → TreeMap(红黑 O(log n))；只要点查 → HashMap(O(1))。这条分界与上一节"哈希不保序"完全对应。

## 六、例子：正确用法与错误用法

```java
// 例子目的：把红黑树门面 TreeMap 的阶梯费率正确用法，与"null 键 / 比较器只比单字段"两个错误用法并排写出
import java.util.*;

public class TreeMapDemo {
    public static void main(String[] args) {
        // 知识点 1 正确用法：阶梯费率按金额取"不超过它的最高档"
        NavigableMap<Integer, Double> rate = new TreeMap<>();
        rate.put(0, 0.005);      // 0 元起 0.5%
        rate.put(10_000, 0.008); // 1 万元起 0.8%
        rate.put(100_000, 0.012); // 10 万元起 1.2%
        Map.Entry<Integer, Double> e = rate.floorEntry(50_000);   // 找 ≤ 50000 的最大键 → 命中档位 10000
        System.out.println(e.getKey() + "->" + e.getValue());      // 正确使用结果：输出 10000->0.008

        // 知识点 2 错误用法：TreeMap 不允许 null 键（不像 HashMap）
        try {
            rate.put(null, 0.01);          // 错误：无法参与排序比较 → 抛 NullPointerException
        } catch (NullPointerException ex) {
            System.out.println("有序表拒绝 null 键：没有定义它与其它键的大小关系");   // 输出该行
        }

        // 知识点 3 错误用法：比较器只比一个字段 → 逻辑上"相等"的键互相覆盖
        record Account(String owner, long id) {}
        NavigableSet<Account> byOwner = new TreeSet<>(Comparator.comparing(Account::owner));  // 错误：只按户主排序
        byOwner.add(new Account("tom", 1L));
        byOwner.add(new Account("tom", 2L));   // 第二个 tom 与第一个"比较相等" → 被丢弃（静默丢数据！）
        System.out.println(byOwner.size());     // 输出 1：而不是预期的 2

        // 正确做法：比较器必须能区分所有业务上不同的元素（主字段 + 兼底字段）
        NavigableSet<Account> good = new TreeSet<>(
                Comparator.comparing(Account::owner).thenComparingLong(Account::id));   // 户主相同则比 id
        good.add(new Account("tom", 1L));
        good.add(new Account("tom", 2L));       // 不再相等 → 两条均入集
        System.out.println(good.size());         // 正确使用结果：输出 2
        System.out.println(good.higher(new Account("tom", 1L)).id());   // 输出 2：后继查询仍可用
    }
}
```

## 七、本节要点回顾

1. 旋转是平衡树唯一的基本动作，O(1) 且保持中序有序。
2. AVL 严格平衡、查询最快、写代价高；红黑用颜色规则保证"最长≤2×最短"，高度 O(log n)。
3. 工程偏爱红黑树：插入/删除以变色为主、旋转次数少、综合最稳（TreeMap/CFS/epoll）。
4. TreeMap/TreeSet 提供 ceiling/floor/subMap 等有序能力，是"范围与前后最近"问题的首选。

下一节：堆——另一种"牺牲全局有序、只维护堆顶极值"的平衡结构，看它如何用数组 O(n) 建堆并支撑 Top-K 与优先队列。
