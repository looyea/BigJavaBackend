# 排序算法全景与稳定性

> 排序是最容易被低估、也最容易"一问源码就露馅"的领域。会用 `Arrays.sort` 不等于懂排序。
> 本节把快/归/堆/基数放回它们的**工程语境**：为什么 JDK 对 `int[]` 和 `Object[]` 用两套算法、稳定性到底何时重要、数据大过内存怎么办，以及绕不过的比较下界。

## 一、先建立全景地图

| 算法 | 平均 | 最坏 | 空间 | 稳定 | 关键点 |
|---|---|---|---|---|---|
| 冒泡/插入/选择 | O(n²) | O(n²) | O(1) | 稳定 | 小规模/近乎有序时插入极快 |
| 希尔排序 | O(n^1.3~) | O(n²) | O(1) | 不稳定 | 插入的增量改进 |
| 归并 Sort | **O(n log n)** | O(n log n) | O(n) | **稳定** | 分治 + 合并，外部排序基础 |
| 快排 | O(n log n) | **O(n²)** | O(log n) | 不稳定 | 原地、缓存友好、常数最小 |
| 堆排 | O(n log n) | O(n log n) | **O(1)** | 不稳定 | 最坏有保证、原地，但缓存差 |
| 计数/基数/桶 | O(n+k) / O(d·n) | 线性 | O(n+k) | 可稳定 | 非比较，要求数据可分桶/整数 |

两条主线：**比较排序**（快归堆，下界 O(n log n)）与**非比较排序**（计数/基数/桶，可破到线性但受限）。

## 二、三大 O(n log n) 的取舍本质

- **快排**：分治 + 原地。平均最快、缓存友好，是"内存里通用默认"。怕最坏（有序/全等 + 端点 pivot → O(n²)）。
- **归并**：分治 + 合并，**稳定**、最坏也有 O(n log n)，但要 O(n) 辅助空间；适合链表（无需随机下标）、外部排序、需要保序。
- **堆排**：用堆（s2-3）反复取最值放末尾，**原地 + 最坏 O(n log n)**，但访问跳跃、缓存差、不稳定——理论漂亮，实战少作主力。

## 三、稳定性：什么时候它是刚需

**稳定 = 相等元素保持原有相对顺序。** 单关键字排序无所谓；一旦**多关键字**或"排完还要按原序 tie-break"，稳定性决定正确性：

```java
// 例子目的：把"多关键字靠两次稳定排序堆出来"这条结论跑一遍
record Order(String amount, String time) {}   // 金额、时间都是字符串形式的数值
List<Order> orders = new ArrayList<>(List.of(
        new Order("100", "09:30"), new Order("50", "09:31"), new Order("100", "09:29")));
// 第一步：先按次要键（时间）排好——此处不写，假设已有序
// 第二步：再按主要键（金额）做"稳定"排序 → 金额相同的仍按时间有序
orders.sort(Comparator.comparing(Order::amount));   // TimSort 稳定，保住了上一步的时间序
System.out.println(orders);   // 正确使用结果：[100@09:29, 100@09:30, 50@09:31]——两条 100 元按时间先后保留
// 错误用法：换成不稳定算法（快排/堆排/Arrays.sort(int[])）做第二步 → 金额相同的两条可能被对调，录入先后信息丢失
// 工程止亏：多关键字优先用一个 Comparator 一次写完 thenComparing，不依赖"稳定"这个隐性前提
```

金融"同金额订单保持录入先后"、电商"同分商品保持上架顺序"都依赖稳定。**要稳定 → 归并/TimSort/插入；快排/堆排/`Arrays.sort(int[])` 都不稳定。**

## 四、JDK 源码级：两套 sort 各司其职

`Arrays.sort` 对基本类型和对象类型**故意用不同算法**：

- **`int[]/double[]…` → DualPivotQuicksort（双轴快排）**：值没有"身份"，不需要稳定 → 追求快 + 原地。工程细节：小数组切**插入排序**、按长度选**单/双/多轴**、用**三取样/游程**规避已排序退化、纯相同值快速跳过（防 O(n²)）。
- **`Object[]` / List → TimSort（归并 + 插入混合）**：对象要稳定；且能利用真实数据里已有的**有序段（Run）**，近乎有序时逼近 O(n)，是最坏 O(n log n) 的稳定保证。代价：需要临时数组（最坏 n/2），**堆内大对象数组排序会短时抬高峰值内存**。

> 面试杀手题："为什么 int 用快排、对象用归并族？" → 一句话：**对象排序稳定性是刚需，int 不需要稳定所以要更快更省的原地快排。**

多线程排序用 `Arrays.parallelSort`（ForkJoin 分治 + 多路归并），大数据能吃到多核。

## 五、突破下界：非比较排序

基于比较的排序，决策树有 n! 个叶子 → 至少 \(\log_2(n!) = \Omega(n\log n)\) 次比较。**想更快只能放弃比较**：

- **计数排序** O(n+k)：值域 k 小的整数（年龄、分数）。
- **基数排序** O(d·(n+k))：按位（个十百/字符串定长）多趟计数排，整数或定长串。
- **桶排序** O(n)：均匀分布分桶后桶内小排，海量 URL/浮点分片。

## 六、外部排序：数据大过内存

金融日终 20 亿流水、500GB 日志按时间排序——**放不进内存，快排/归并都要求数据在数组里，直接失效**。标准打法 = **分块内排 + 多路归并**：

```flow
// 图目的：数据超内存时的标准流水线——注意只有"块内排序"能吃进内存，归并阶段是流式的
切分(按内存预算) → 每块内排序(TimSort/快排, 能进内存即可) → 落盘成有序段
→ k 路归并: 用容量 k 的小顶堆存各段当前头部, 弹出最小流式写出, 该段补下一个
// 应用例：500GB 日志分 500 块×每块 1GB → 块内各 O(n log n) → 一次 500 路归并，堆只占 O(500)
```

- 复杂度 O(N log k)、堆只占 O(k)；**读放大**用较大缓冲块控制、写用顺序追加。
- 块内可并行排（parallelSort/ForkJoin），归并阶段受 IO 限制注意顺序写。
- 这正是 MySQL、Spark shuffle、MapReduce reduce 的排序内核。

## 七、工程场景钩子

- **电商**：榜单排序先哈希计数再堆取 Top-K（s2-3），全量排序用外部/并行排。
- **金融**：多关键字稳定排序保证同额保序；日终海量流水走外部排序。
- **电力**：设备上报按时间戳排，近乎有序 → TimSort 的 Run 优化最能打。

## 八、例子：正确用法与错误用法

```java
// 例子目的：验证"基本类型不稳序 / 对象稳序 / 数组元素含 null 直接炸 / 自然序不一致比不了"四个真实后果
import java.util.*;

public class SortDemo {
    record Row(int key, String tag) { String s() { return key + "@" + tag; } }

    public static void main(String[] args) {
        // 知识点 1 正确用法：对象数组走 TimSort，相等元素保留原序
        Row[] obj = { new Row(1, "a"), new Row(1, "b"), new Row(0, "c") };
        Arrays.sort(obj, Comparator.comparingInt(Row::key));    // 稳定算法：只按 key 排，同 key 不交换
        System.out.println(obj[0].s() + "," + obj[1].s());        // 正确用例输出：0@c,1@a（两个 1 仍按录入序 a 正在前）

        // 知识点 1 错误用法：以为基本类型数组也稳序
        int[][] pair = { {1, 10}, {1, 20}, {0, 30} };              // 想按第一位排并保留第二位原序
        Arrays.sort(pair, Comparator.comparingInt(a -> a[0]));      // 对象数组（int[] 是对象），这里仍稳定
        System.out.println(pair[0][1] + "," + pair[1][1]);           // 输出 30,10：稳定保序
        // 真正的坑在 int[]/long[]：Arrays.sort(int[]) 是双轴快排，不稳序；拿它排"并行数组"会错位
        int[] ids   = {1, 1, 0};
        int[] vals  = {10, 20, 30};                                  // 两个数组下标一一对应
        Arrays.sort(ids);                                           // 错误：只排了一半，ids 变 [0,1,1] 而 vals 未跟着动 → 对应关系彻底错乱
        System.out.println(ids[0] + "->" + vals[0]);                 // 输出 0->10：本该是 0->30，这就是不稳定+拆排的双重后果
        // 正确做法：成对数据装进对象/二维数组一起排，或用索引排序

        // 知识点 2 错误用法：数组里塞 null
        Integer[] withNull = {3, null, 1};
        try {
            Arrays.sort(withNull);                        // 错误：自然序比较时拆箱 null → 抛 NullPointerException
        } catch (NullPointerException e) {
            System.out.println("排序遇 null 元素：Comparable 比较时拆箱报 NPE");   // 输出该行
        }
        Arrays.sort(withNull, Comparator.nullsFirst(Comparator.naturalOrder()));   // 正确：显式声明 null 位置
        System.out.println(withNull[0]);                   // 正确使用结果：输出 null（null 被排到最前）

        // 知识点 3 错误用法：不兼容类型丢进同一个自然序排序
        try {
            List<Comparable> mix = new ArrayList<>(List.of(1, "a"));
            mix.sort(Comparator.naturalOrder());           // 错误：Integer.compare("a") → 抛 ClassCastException
        } catch (ClassCastException e) {
            System.out.println("混排不同可比类型：compare 时强转失败");   // 输出该行
        }

        // 知识点 4 正确用法：大数组并行排序
        int[] big = new int[1 << 20];
        for (int i = 0; i < big.length; i++) big[i] = big.length - i;   // 逆序填充，给双轴快排制造不利输入
        Arrays.parallelSort(big);                                        // 正确：ForkJoin 分治 + 多路归并，吃多核
        System.out.println(big[0] + "," + big[big.length - 1]);           // 正确用例输出：1,1048576
    }
}
```

## 九、本节要点回顾

1. 三条主线：比较排序（快归堆，下界 O(n log n)）、非比较（计数/基数/桶，破线性）、外部排序（分块+多路归并）。
2. 快排通用最快、归并稳定 + 最坏有保证、堆排原地但缓存差；按"要不要稳定/要不要最坏保证/内存够不够"选。
3. JDK 双轨：int[] 双轴快排（不必稳定求快省），Object[] TimSort（要稳定 + 利用有序 Run）；parallelSort 吃多核。
4. 稳定性是多关键字/保序正确性的命门；外部排序是"数据超内存"的唯一正解。

下一节：查找与二分——从边界模板、防溢出、旋转数组，到把最优化转判定的"二分答案"。
