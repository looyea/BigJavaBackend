# 课后作业 · 动态规划

> 2 题，一题线性/背包 DP，一题二维 DP，附验收标准与参考答案。

## 作业 1：0-1 背包求最大价值（50分）

**要求**：n 件物品（重量 wt[]、价值 val[]），背包容量 W，每件最多选一次，求能装的最大价值。先写二维，再优化成一维逆序。

**验收标准**：
- 二维 `dp[i][w]=max(dp[i-1][w], dp[i-1][w-wt[i]]+val[i])`。
- 一维优化：容量**逆序**遍历，保证每件只用一次。

**参考答案要点**：
```java
int knapsack(int[] wt, int[] val, int W){
    int[] dp = new int[W+1];                       // 一维，默认 0 即 base
    for(int i=0;i<wt.length;i++)
        for(int w=W; w>=wt[i]; w--)                // 逆序！
            dp[w] = Math.max(dp[w], dp[w-wt[i]] + val[i]);
    return dp[W];
}
```
- 追问：若改成"每物品无限用"（完全背包）怎么改？→ 内层容量改正序 `for(w=wt[i]; w<=W; w++)`。

## 作业 2：最长递增子序列（LIS）（50分）

**要求**：求数组 LIS 长度。先给 O(n²) DP，再说明 O(n log n) 思路。

**验收标准**：
- O(n²)：`dp[i]=以 i 结尾的 LIS 长度`，`dp[i]=max(dp[j]+1)` 对所有 `j<i 且 a[j]<a[i]`，答案取 max。
- O(n log n)：维护"长度为 k 的递增子序列的最小结尾"数组 tails，对每个元素用二分找替换位置（结合 s3-3）。

**参考答案要点**：
```java
// O(n^2)
int lis(int[] a){ int n=a.length, dp[]=new int[n], best=0; Arrays.fill(dp,1);
    for(int i=0;i<n;i++){ for(int j=0;j<i;j++) if(a[j]<a[i]) dp[i]=Math.max(dp[i],dp[j]+1);
        best=Math.max(best,dp[i]); } return best; }
// O(n log n)：tails[k]=长度k+1的递增子序列的最小结尾值，用 lowerBound 找替换位置，数组长度即 LIS
```
- 关键：DP 状态"以 i 结尾"是线性 DP 的常见定义；优化版把"枚举所有 j"换成"二分找插入位置"，体现 DP + 二分的结合。
