# 查找与二分

> 二分是"把 O(n) 线性扫描压成 O(log n)"的最锐利工具，也是**最容易写错边界**的地方。
> 本节不满足于"会二分"：要建立**统一的边界模板**、讲清**防溢出**、拿下**旋转数组**，并掌握最高级的用法——**二分答案**：只要答案空间有单调可行性，就能对答案二分。

## 一、二分的本质：在"单调"上折半

二分的适用前提不是"数组有序"这么简单，而是**存在一个判定，使结果随下标单调**（一旦满足就永远满足 / 一旦不满足就永远不满足）。每次比较 `mid` 后**安全丢弃一半**——因为被丢的那半不可能含答案。

## 二、边界模板：lower / upper Bound（背这个）

绝大多数二分题（找第一个、找最后一个、找区间）都能归约到两个模板，别为每道题另写一套：

```java
// lowerBound：第一个 >= target 的下标（找不到返回 nums.length）
int lowerBound(int[] a, int target){
    int lo = 0, hi = a.length;                 // 左闭右开 [lo, hi)
    while(lo < hi){
        int mid = lo + ((hi - lo) >> 1);
        if(a[mid] < target) lo = mid + 1;      // mid 太小，答案在右
        else hi = mid;                          // mid 合格，收缩右边界保留它
    }
    return lo;
}
// upperBound：第一个 > target 的下标；[lowerBound, upperBound) 即 target 的出现区间
int upperBound(int[] a, int target){
    int lo = 0, hi = a.length;
    while(lo < hi){
        int mid = lo + ((hi - lo) >> 1);
        if(a[mid] <= target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
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
while(lo <= hi){
    int mid = lo + ((hi-lo)>>1);
    if(a[mid]==target) return mid;
    if(a[lo] <= a[mid]){                       // 左半有序
        if(a[lo] <= target && target < a[mid]) hi = mid-1; else lo = mid+1;
    }else {                                     // 右半有序
        if(a[mid] < target && target <= a[hi]) lo = mid+1; else hi = mid-1;
    }
}
// 含重复元素时 a[lo]==a[mid] 无法判哪半有序 → lo++ 去歧义，最坏退化 O(n)
```

## 五、二分答案：最值钱的用法（架构级）

当问题形如"**求满足某条件的最小/最大 x**"，且 x 越大（或越小）**越容易/越难满足**（单调可行性），就可以**对答案 x 二分**，配一个 `check(x)` 把"最优化"转成"判定"：

```java
// 求满足 check(x)==true 的最小 x
int lo = minCandidate, hi = maxCandidate;
while(lo < hi){
    int mid = lo + ((hi - lo) >> 1);
    if(check(mid)) hi = mid;      // mid 可行，答案往更小结收缩
    else lo = mid + 1;            // 不可行，往更大
}
return lo;
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

## 七、本节要点回顾

1. 二分本质是"在单调判定上折半丢一半"，不只是"数组有序找数"。
2. 用 lower/upperBound 统一模板处理边界与区间，`lo+((hi-lo)>>1)` 防溢出、保证区间严格收缩防死循环。
3. 旋转数组靠"必有一半有序"判方向；有重复最坏退化 O(n)。
4. 二分答案把最优化转判定，识别"答案空间单调可行"是关键，工程常用于"最小资源满足约束"。

下一节进入阶段四算法范式，第一站：双指针与滑动窗口——把区间/配对枚举从 O(n²) 打到 O(n)。
