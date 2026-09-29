# 查找与二分

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：二分边界模板（lower/upperBound）、防溢出、旋转数组、以及“二分答案”把最优化转成判定的套路。

> 二分是"把 O(n) 线性扫描压成 O(log n)"的最锐利工具，也是**最容易写错边界**的地方。
> 本节不满足于"会二分"：要建立**统一的边界模板**、讲清**防溢出**、拿下**旋转数组**，并掌握最高级的用法——**二分答案**：只要答案空间有单调可行性，就能对答案二分。

## 一、二分的本质：在"单调"上折半

二分的适用前提不是"数组有序"这么简单，而是**存在一个判定，使结果随下标单调**（一旦满足就永远满足 / 一旦不满足就永远不满足）。每次比较 `mid` 后**安全丢弃一半**——因为被丢的那半不可能含答案。

## 二、边界模板：lower / upper Bound（背这个）

绝大多数二分题（找第一个、找最后一个、找区间）都能归约到两个模板，别为每道题另写一套：

```java
// 例子目的：两个边界模板本身 + 立即拿它们做"查找位置 / 统计出现次数 / 找前驱"
// lowerBound：第一个 >= target 的下标（找不到返回 nums.length）
int lowerBound(int[] a, int target){
    int lo = 0, hi = a.length;                 // 左闭右开 [lo, hi)，hi 取 length 表示"可能落到哨兵位"
    while(lo < hi){
        int mid = lo + ((hi - lo) >> 1);       // 防溢出写法，等价于 (lo+hi)/2 但不会变负
        if(a[mid] < target) lo = mid + 1;      // mid 太小，答案在右
        else hi = mid;                          // mid 合格，收缩右边界保留它
    }
    return lo;                                  // 循环结束时 lo==hi 即答案
}
// upperBound：第一个 > target 的下标；[lowerBound, upperBound) 即 target 的出现区间
int upperBound(int[] a, int target){
    int lo = 0, hi = a.length;
    while(lo < hi){
        int mid = lo + ((hi - lo) >> 1);
        if(a[mid] <= target) lo = mid + 1;      // 等于也算"要往右找"，所以才能越过全部重复段
        else hi = mid;
    }
    return lo;
}

// 应用：对 a = [1,2,2,2,3] 做三件事
int[] a = {1, 2, 2, 2, 3};
System.out.println(lowerBound(a, 2));                 // 输出 1：2 第一次出现的下标
System.out.println(upperBound(a, 2) - lowerBound(a, 2));   // 输出 3：2 一共出现 3 次
System.out.println(lowerBound(a, 5));                 // 输出 5：比最大元素还大 → 返 length（不是 -1）
System.out.println(lowerBound(a, 5) - 1);             // 输出 4：所有 < 5 的元素个数，即 floor 语义
// 错误用法：拿 lowerBound 的返回值直接当"命中下标"而不判 a[lo]==target → 元素不存在时会读到不相关的值
```

- **区间计数**：`upperBound - lowerBound` = target 出现次数。
- **找最后一个 <= target**：即 `lowerBound(target+1) - 1`（配合 floor 语义）。
- 循环不变式要自洽：这里用**左闭右开 + `lo<hi` + 命中收 `hi=mid`**，最终 `lo==hi` 即答案，不必再判 `±1` 纠结。

## 三、两个必踩的坑

1. **整型溢出**：`mid = (lo + hi) / 2` 在 lo+hi 超 int 时溢出为负 → 用 `lo + ((hi - lo) >> 1)`。这是 JDK `Arrays.binarySearch` 与 LeetCode 的老 bug 源。
2. **死循环**：收缩时 `lo = mid`（而非 `mid+1`）配合 `lo<hi` 可能不前进 → 保证每轮区间严格变小（要么 `lo=mid+1`、要么 `hi=mid` 且 mid 取偏左）。

## 四、旋转有序数组：半区里找单调

旋转数组 `[4,5,6,7,0,1,2]` 整体无序，但 **mid 切开后必有一半是有序的**——判断 target 落在不在那个有序半区，据此决定收缩方向，仍 O(log n)。

```java
// 例子目的：把旋转数组查找装进函数，并用 [4,5,6,7,0,1,2] 跑通"命中/未命中"两种结果
int searchRotated(int[] a, int target){
    int lo = 0, hi = a.length - 1;                 // 这里用左闭右闭，所以循环条件是 lo<=hi
    while(lo <= hi){
        int mid = lo + ((hi-lo)>>1);
        if(a[mid]==target) return mid;              // 命中直接返回下标
        if(a[lo] <= a[mid]){                        // 左半有序
            if(a[lo] <= target && target < a[mid]) hi = mid-1; else lo = mid+1;   // target 在左半区间才往左折
        }else {                                     // 右半有序
            if(a[mid] < target && target <= a[hi]) lo = mid+1; else hi = mid-1;
        }
    }
    return -1;                                      // 不存在 → 返 -1（与 lowerBound 返 length 是两套约定，不可混用）
}
System.out.println(searchRotated(new int[]{4,5,6,7,0,1,2}, 0));   // 正确用例输出：4
System.out.println(searchRotated(new int[]{4,5,6,7,0,1,2}, 3));   // 正确用例输出：-1（该值不存在）
// 含重复元素时 a[lo]==a[mid] 无法判哪半有序 → lo++ 去歧义，最坏退化 O(n)
```

## 五、二分答案：最值钱的用法（架构级）

当问题形如"**求满足某条件的最小/最大 x**"，且 x 越大（或越小）**越容易/越难满足**（单调可行性），就可以**对答案 x 二分**，配一个 `check(x)` 把"最优化"转成"判定"：

```java
// 例子目的：二分答案——"能拆成不超 m 段的最大和最小是多少"这类单调可行问题
int lo = minCandidate, hi = maxCandidate;      // 答案区间：下界取"单个最大元素"，上界取"全部之和"
while(lo < hi){
    int mid = lo + ((hi - lo) >> 1);
    if(check(mid)) hi = mid;      // mid 可行，答案往更小结收缩
    else lo = mid + 1;            // 不可行，往更大
}
return lo;                        // 循环结束时 lo==hi，就是最小可行解（不需要再判 ±1）

// 应用：把 10GB 批量写入拆成若干事务，单个事务最大容量最小是多少？
int[] batch = {4, 2, 4};                       // 三批待写数据
lo = java.util.Arrays.stream(batch).max().orElse(0);   // 下界：至少得能装下单批最大值 → 4
hi = java.util.Arrays.stream(batch).sum();             // 上界：全塞一批 → 10
final int cap = 2;                                      // 只允许分成 2 段
while (lo < hi) {
    int mid = lo + ((hi - lo) >> 1);
    int used = 1, cur = 0;
    for (int v : batch) { if (cur + v > mid) { used++; cur = 0; } cur += v; }   // check：贪心装段，数需要几段
    if (used <= cap) hi = mid; else lo = mid + 1;                                // 段数不超限制 → 可以尝试更小容量
}
System.out.println(lo);                         // 正确用例输出：6（[4,2] 与 [4] 两段，最大段和最小为 6）
```

典型：送包裹的最小载重、Koko 吃香蕉最小速度、分割数组最大值的最小可能、**"满足 SLA 的最小线程池大小/最小批次"**——check 常是贪心或模拟。**核心是识别"答案空间的单调性"，而不是数组有序。**

## 六、什么时候用二分（信号识别）

| 信号 | 用二分的方式 |
|---|---|
| 数组有序 / 局部有序(旋转) | 直接 lower/upperBound |
| 求"第一个/最后一个满足…" | 边界模板 |
| 有序数组配对/区间统计 | 两次 bound 求个数 |
| "最小化最大值 / 最大化最小值"、答案单调可行 | 二分答案 |
| 求平方根、溢出门限、字典序第 k 小 | 对值域二分 |

> 提醒：链表/无序/需频繁插入删除的数据不适合二分（无法 O(1) 随机定位或维持有序）——那种要平衡树（TreeMap 的 `floorKey/ceilingKey` 本质就是树上的二分，见 s2-2）。

## 八、例子：正确用法与错误用法

```java
// 例子目的：把二分的两个必踩坑复现——(lo+hi)/2 溢出变负、lo=mid 收缩不动导致死循环，并给出各自正确写法
import java.util.*;

public class BinaryDemo {
    public static void main(String[] args) {
        long[] big = new long[10];                 // 只演示下标运算，不装数据
        int lo = Integer.MAX_VALUE - 1, hi = Integer.MAX_VALUE;   // 极端区间，专门用来撞溢出
        int badMid  = (lo + hi) / 2;                                // 错误：lo+hi 先溢出为负数，再除仍为负
        System.out.println(badMid);                                  // 输出 -1073741824：下标为负，用它访数组必抛 ArrayIndexOutOfBoundsException
        try {
            System.out.println(big[badMid]);                         // 错误后果在这里落地
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("溢出后拿到负下标 → 越界异常");     // 输出该行
        }
        int goodMid = lo + ((hi - lo) >> 1);                         // 正确：先做差再位移，全程不溢出
        System.out.println(goodMid);                                 // 正确使用结果：输出 2147483646（真值 2147483646）

        // 错误用法：收缩时写 lo = mid（而不是 mid+1），区间不再变小 → 循环永不退出
        int a2 = 0, b2 = 1;
        int guard = 0;                                              // 为了不让例子真把机器卡死，加迭代上限哨兵
        while (a2 < b2 && guard++ < 5) {
            int m = a2 + ((b2 - a2) >> 1);
            if (m < 1) a2 = m;   // 错误：m=0 时 a2 = m 原地不动，区间 [0,1) 永远不小→死循环
            else b2 = m;
        }
        System.out.println(a2 + "," + b2 + "," + guard);   // 输出 0,1,6：哨兵撞上限退出，证明上面那行没推进
        // 正确写法：不满足时 lo = mid + 1，满足时 hi = mid，二者必须恰有一个让区间严格变小

        // 知识点：JDK 自带的 binarySearch 返回值约定——未命中返 -(插入点)-1，不是 -1
        int[] s = {1, 3, 5};
        System.out.println(Arrays.binarySearch(s, 4));   // 输出 -4：即 -(插入点 3)-1，反推插入点 = -ret-1
        System.out.println(Arrays.binarySearch(s, 3));   // 正确用例输出：1（命中则直接返下标）
        // 错误用法：把它当"找不到返 -1"的 API 用 → 下标 0 处命中也返 0，而 -1 与 -4 混为一谈，逻辑全错
    }
}
```

## 九、本节要点回顾

1. 二分本质是"在单调判定上折半丢一半"，不只是"数组有序找数"。
2. 用 lower/upperBound 统一模板处理边界与区间，`lo+((hi-lo)>>1)` 防溢出、保证区间严格收缩防死循环。
3. 旋转数组靠"必有一半有序"判方向；有重复最坏退化 O(n)。
4. 二分答案把最优化转判定，识别"答案空间单调可行"是关键，工程常用于"最小资源满足约束"。

下一节进入阶段四算法范式，第一站：双指针与滑动窗口——把区间/配对枚举从 O(n²) 打到 O(n)。
