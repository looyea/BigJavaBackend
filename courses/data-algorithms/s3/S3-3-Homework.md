# 课后作业 · 查找与二分

> 2 题，一题边界手写，一题二分答案实战，附验收标准与参考答案。

## 作业 1：二分边界 + 旋转数组（50分）

**要求**：
1. 实现 `firstGreaterOrEqual(a, target)` 与 `lastLessOrEqual(a, target)`。
2. 在旋转有序数组中查找 target（LeetCode 33），写出思路。

**验收标准**：
- 用 `lo + ((hi-lo)>>1)` 防溢出；写清循环不变式，不死循环不漏解。
- 旋转数组：判断 mid 落在哪个有序半区，看 target 在不在该半区决定收缩方向。

**参考答案要点**：
```java
int firstGE(int[] a, int t){                    // 第一个 >= t
    int lo=0, hi=a.length;
    while(lo<hi){ int m=lo+((hi-lo)>>1);
        if(a[m] < t) lo=m+1; else hi=m; }
    return lo;
}
int lastLE(int[] a, int t){ int i=firstGE(a,t); return (i<a.length&&a[i]==t)? i : i-1; }
// 旋转查找：每轮先判 [lo..mid] 还是 [mid..hi] 有序，再看 target 是否在有序半区内
```

## 作业 2：二分答案——分割数组最大值（50分）

**背景**：把非负数组分成 m 个连续子数组，使"各子数组和的最大值"尽可能小，求这个最小值。

**要求**：说明为何可二分、给出上下界与 `check(cap)`、写主循环。

**验收标准**：
- 单调性：cap 越大越容易用 ≤ m 段装下 → 对 cap 二分求最小可行。
- `lo=max(元素)`、`hi=sum(全部)`；`check(cap)` 贪心累加，超 cap 就 +1 段，段数 ≤ m 即行。

**参考答案要点**：
```java
int split(int[] a, int m){
    int lo=Arrays.stream(a).max().getAsInt(), hi=Arrays.stream(a).sum();
    while(lo<hi){ int mid=lo+((hi-lo)>>1);
        if(feasible(a,m,mid)) hi=mid; else lo=mid+1; }   // 求最小可行
    return lo;
}
boolean feasible(int[] a,int m,int cap){ int seg=1,sum=0;
    for(int x:a){ if(sum+x>cap){ seg++; sum=x; if(seg>m) return false; } else sum+=x; }
    return true; }
```
- 关键：`check` 用贪心模拟"每段尽量装满到 cap"，段数不超 m 即可行；这就是"最小化最大值"的二分答案范式。
