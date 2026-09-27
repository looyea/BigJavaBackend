# 递归与分治

> 到这里，我们从"怎么遍历得更快"上升到"**怎么把一个问题拆开、交给更小的自己**"。
> 递归是**表达方式**，分治是**一种拆分策略**（子问题相互独立）。搞清它俩的边界，也就理解了"什么时候该转向动态规划"。

## 一、递归：把问题交给"更小的自己"

递归的两个命门：**基准情形（base case）能终止** + **每步规模严格递减**。写递归的正确心智不是"在脑中展开每一层"，而是**信任递归函数已能解决子问题**，你只负责组合它的返回。

```java
// 递归三步：① 终止条件 ② 调用自身拿到子结果 ③ 组合成当前结果
// 例子目的：算一棵树的高度——先造出树，再当场调用拿到结果
record TreeNode(TreeNode left, TreeNode right) {}
TreeNode t = new TreeNode(new TreeNode(null, null), null);   // 根带一个叶子左孩子，树高应为 2
int depth(TreeNode n){
    if (n == null) return 0;                              // base：空树高度 0，递归在此终止
    return 1 + Math.max(depth(n.left), depth(n.right));   // 信任子树已算好，只负责 +1 与取大
}
System.out.println(depth(t));                             // 正确使用结果：输出 2
// 错误用法：把 base 写成 if (n != null) return 0; → 非空时直接返 0，结果永远是 0（逻辑错）
// 错误用法：完全删掉 base → 递归永不终止，招 StackOverflowError
```

**栈与溢出**：递归靠调用栈，深度 O(n) 的链（退化的树、深链表、DFS 大图）会 `StackOverflowError`。工程对策：**改迭代 + 显式栈**（把栈放到堆上，容量受内存而非调用栈限制）、尾递归思路、或限制规模。这是空间复杂度在递归里的具体兑现。

## 二、分治：切成独立子问题 → 各解 → 合并

分治 = 递归 + 把大问题切成**相互独立**的子问题 + 合并结果。归并排序、快速排序、最近点对、大整数乘法、`Arrays.parallelSort` 都是它。

```flow
// 图目的：分治三步骨架——注意只有"分解"与"求解"能并行，合并往往必须串行
分解 Divide → 递归求解 Conquer → 合并 Merge
// 应用例：归并排序把 n 平分两块各排（可并行）→ merge 双指针合并（同一段数据上只能单线程）
```

```java
// 例子目的：归并排序完整可运行——含合并函数与一次实际调用
void mergeSort(int[] a, int lo, int hi, int[] tmp){
    if (lo >= hi) return;                              // base：单元素天然有序（写成 lo>hi 就会对单元素继续切分→死递归）
    int mid = lo + ((hi - lo) >> 1);
    mergeSort(a, lo, mid, tmp);                         // 独立左半
    mergeSort(a, mid+1, hi, tmp);                       // 独立右半
    merge(a, lo, mid, hi, tmp);                         // 合并两个有序半区
}
void merge(int[] a, int lo, int mid, int hi, int[] tmp){
    System.arraycopy(a, lo, tmp, 0, hi - lo + 1);       // 拷出待合并区段，避免自身覆盖
    int i = 0, j = mid - lo + 1, k = lo;                // i 左半指针，j 右半指针
    while (i <= mid - lo && j <= hi - lo)                // 两半都未扫完时取较小者（取等保证稳定）
        a[k++] = tmp[i] <= tmp[j] ? tmp[i++] : tmp[j++];
    while (i <= mid - lo) a[k++] = tmp[i++];             // 左半有剩余则直接补齐
}
int[] src = {5, 3, 8, 1};
mergeSort(src, 0, src.length - 1, new int[src.length]);   // 应用：原地排序整段（需 import java.util.Arrays）
System.out.println(Arrays.toString(src));                  // 正确使用结果：输出 [1, 3, 5, 8]
// 错误用法：tmp 传成 new int[1] → 拷入越界抛 ArrayIndexOutOfBoundsException
```

**用主定理估复杂度**：`T(n) = a·T(n/b) + O(n^d)`，比较 `a` 与 `b^d`：
- `a < b^d` → O(n^d)；`a = b^d` → O(n^d log n)；`a > b^d` → O(n^{log_b a})。
- 归并：a=2,b=2,d=1 → `a=b^d` → O(n log n)。

## 三、分治 vs 动态规划：一条生死线

这是本节最重要的一张地图：

- 子问题**相互独立**（不重叠）→ **分治**：每块算一次，合并即可。
- 子问题**大量重叠**（同一子问题被反复需要）→ 分治会**指数级重算**，必须转 **DP / 记忆化**。

```
// 图目的：用递归树说明"重叠子问题"从哪里产生
朴素递归斐波那契 = 反面教材：
        f(5)
      /      \
   f(4)      f(3)          ← f(3) 被算了两次，规模越大重复越多
   /  \       ...
 f(3) f(2)                  ← 重叠子问题 → 复杂度 O(2ⁿ)
→ 应用判据：数一下重复节点——f(3) 出现 2 次，说明不能分治，必须转记忆化/DP
```

斐波那契递归树里 f(3)、f(2) 被反复计算，重叠子问题正是"该上 DP/记忆化"的信号（DP 见 s4-4）。**判断口诀：画出递归树，看有没有重复节点——没有=分治，有=DP。**

## 四、分治的天然优势：可并行

子问题独立 = 天然可并行。`Arrays.parallelSort`（ForkJoin 切分数组各排再归并）、MapReduce 的 map（分片各算）/ reduce（合并）都是分治。**瓶颈常在合并**：若合并有全局锁或必须串行，会限制加速比——设计时要么减少合并、要么让合并也可并行（多路归并/树形合并）。

## 五、什么时候用递归/分治（信号）

| 信号 | 手段 |
|---|---|
| 问题能"化成同一个更小问题" | 递归 |
| 能切成独立子问题分别解再合并 | 分治（归并/快排/最近点对） |
| 子问题重叠 | 转 DP / 记忆化（别硬分治） |
| 要枚举所有解带约束 | 转回溯（s4-5） |

## 六、例子：正确用法与错误用法

```java
// 例子目的：让"缺 base 爆栈"与"重叠子问题指数爆炸"两个后果真发生，并给出各自正解
import java.util.*;

public class DivideDemo {
    static long fibBad(int n) { return n < 2 ? n : fibBad(n - 1) + fibBad(n - 2); }   // 朴素递归：重叠子问题，O(2ⁿ)

    static long fibMemo(int n, Long[] memo) {                        // 记忆化：同一子问题只算一次 → O(n)
        if (n < 2) return n;
        if (memo[n] != null) return memo[n];                          // 命中缓存直接返回，不再展开递归树
        return memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
    }

    static int noBase(int n) { return n + noBase(n - 1); }             // 错误：没有终止条件，永不归返

    public static void main(String[] args) {
        try {
            System.out.println(noBase(1000));
        } catch (StackOverflowError e) {
            System.out.println("缺 base 后果：递归不终止，抛 StackOverflowError");   // 输出该行
        }
        long t0 = System.nanoTime();
        long v = fibBad(32);                                            // 错误取向：对重叠子问题硬分治
        System.out.println(v + " 用时" + ((System.nanoTime() - t0) / 1_000_000) + "ms");   // 输出 2178309 + 百毫秒级耗时
        t0 = System.nanoTime();
        Long[] memo = new Long[33];
        System.out.println(fibMemo(32, memo) + " 用时" + ((System.nanoTime() - t0) / 1_000_000) + "ms");   // 正确使用结果：同样 2178309，但几乎 0ms

        // 知识点：子问题独立才叫分治——用 parallelSort 体验"分而不重叠"
        int[] data = {9, 4, 7, 1};
        Arrays.parallelSort(data);                                      // ForkJoin 切段各排再归并，段间无重叠
        System.out.println(Arrays.toString(data));                        // 正确用例输出：[1, 4, 7, 9]
    }
}
```

## 七、本节要点回顾

1. 递归要"信任子问题 + 保证基准与规模递减"，深链改迭代 + 显式栈防溢出。
2. 分治 = 切成独立子问题各解再合并，主定理估复杂度；子问题独立故可并行，合并是瓶颈。
3. 分治与 DP 的分水岭是"子问题是否重叠"：重叠就别分治，转记忆化/DP。
4. 递归是表达，分治/DP/回溯/贪心是建在其上的策略——下一节看"敢只做局部最优"的贪心。
