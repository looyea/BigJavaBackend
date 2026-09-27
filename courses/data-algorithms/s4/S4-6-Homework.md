# 课后作业 · 位运算、前缀和、差分、单调栈与单调队列

> 2 题，一题为差分 + 前缀和的还原（含边界陷阱），一题为接雨水（单调栈 / 单调队列 / 前缀和三解对照），附验收标准与参考答案。

## 作业 1：会议室占用峰值——差分的实际应用（50分）

**要求**：给定 n 个会议的起止时间 `intervals[i] = [start, end]`（左闭右开，同一分钟可容纳多个会议），求至少需要准备多少间会议室，即任一时刻的最大重叠数。要求给出 O(n + T) 的差分解（T 为时间轴离散化后的长度）与 O(n log n) 的排序扫描解，并说明各自适用条件。

**验收标准**：
- 差分法：把时间当数组下标，`d[start] += 1; d[end] -= 1;`，再对 `d` 求前缀和取最大值。左闭右开正好让 `d[end]` 处减 1，不需要 `-1` 调整。
- 明确若区间是**闭区间** `[start, end]` 则必须写 `d[end + 1] -= 1`，并说明下标越界风险。
- 排序扫描法：所有端点打标签（起点 +1、终点 -1），按时间排序、**同一时刻终点排在起点之前**（闭区间语义相反），累加求峰值，O(n log n) 且与时间轴范围无关。
- 结论：时间轴范围小（如一天 1440 分钟）用差分；时间戳稀疏或范围达 10⁹ 用排序扫描（否则数组开不下）。

**参考答案要点**：
```java
// ① 差分：适合时间轴可枚举（分钟粒度、范围 ≤ 10^6）
int maxRoomsDiff(int[][] iv, int T) {
    int[] d = new int[T + 2];                       // 多开 2 格防 end+1 越界
    for (int[] e : iv) { d[e[0]]++; d[e[1]]--; }    // 左闭右开
    int cur = 0, best = 0;
    for (int i = 0; i <= T; i++) { cur += d[i]; best = Math.max(best, cur); }
    return best;
}
// ② 排序扫描：与时间范围无关，O(n log n)
int maxRoomsSort(int[][] iv) {
    int n = iv.length, k = 0;
    int[][] pts = new int[2 * n][2];                // {时间, +1/-1}
    for (int[] e : iv) { pts[k][0] = e[0]; pts[k++][1] = 1; pts[k][0] = e[1]; pts[k++][1] = -1; }
    Arrays.sort(pts, (a, b) -> a[0] != b[0] ? a[0] - b[0] : a[1] - b[1]);  // 同时刻 -1 在前
    int cur = 0, best = 0;
    for (int[] p : pts) { cur += p[1]; best = Math.max(best, cur); }
    return best;
}
```
- 追问：如果要求输出"每个会议是否被拒（无房可用）"，差分不够——它只给总量不给配对，需要维护"空闲房间号"的最小堆（呼应 s2-3），这是差分与堆的能力边界差异。

## 作业 2：接雨水——三种辅助结构的对照（50分）

**要求**：给定高度数组 `height`，求降雨后能接多少水。分别用 ① 前后缀最大值数组、② 单调栈（按层积水）、③ 双指针（呼应 s4-1）三种方法实现，并说明每种方法的"积水量累加视角"。

**验收标准**：
- 方法①：`leftMax[i]`、`rightMax[i]` 各扫一遍预处理，`water += min(leftMax[i], rightMax[i]) - height[i]`（取不到负值）——**按列**累加，O(n) 时间 O(n) 空间。
- 方法②：栈内保持高度**递减**；弹出 `bottom` 时，以 `height[stack.peek()]` 为新左墙、当前 `height[i]` 为右墙，累加**一层**水：`(min(左,右) - bottom) * (i - stack.peek() - 1)`——按层累加，O(n) 时间 O(n) 空间。
- 方法③：左右指针向中间走，始终移动**较矮**的一侧并维护 `leftMax`/`rightMax` 两个变量，把方法① 的空间降到 **O(1)**；要能讲清"为什么矮的一侧可以结算"（另一侧必有更高的墙兜住）。
- 三解都正确、并能说出"按列 vs 按层"的视角差异。

**参考答案要点**：
```java
// ① 前后缀最大值（按列）
long trapPrefix(int[] h) {
    int n = h.length; if (n < 3) return 0;
    int[] lm = new int[n], rm = new int[n];
    for (int i = 0; i < n; i++) lm[i] = i == 0 ? h[0] : Math.max(lm[i - 1], h[i]);
    for (int i = n - 1; i >= 0; i--) rm[i] = i == n - 1 ? h[n - 1] : Math.max(rm[i + 1], h[i]);
    long w = 0;
    for (int i = 0; i < n; i++) w += Math.min(lm[i], rm[i]) - h[i];   // 恒 ≥ 0
    return w;
}
// ② 单调栈（按层）：栈内递减，弹出即为"凹槽底部"
long trapStack(int[] h) {
    Deque<Integer> st = new ArrayDeque<>(); long w = 0;
    for (int i = 0; i < h.length; i++) {
        while (!st.isEmpty() && h[i] > h[st.peek()]) {
            int bottom = st.pop();
            if (st.isEmpty()) break;                        // 没有左墙，水会流走
            int dist = i - st.peek() - 1;
            w += (long) (Math.min(h[i], h[st.peek()]) - h[bottom]) * dist;
        }
        st.push(i);
    }
    return w;
}
// ③ 双指针 O(1) 空间
long trapTwoPtr(int[] h) {
    int l = 0, r = h.length - 1, lm = 0, rm = 0; long w = 0;
    while (l < r) {
        if (h[l] < h[r]) {                                  // 右侧必有更高的墙兜住左边
            if (h[l] >= lm) lm = h[l]; else w += lm - h[l];
            l++;
        } else {
            if (h[r] >= rm) rm = h[r]; else w += rm - h[r];
            r--;
        }
    }
    return w;
}
```
- 关键洞察：方法① 的 `leftMax/rightMax` 本质就是"前缀最大值"这一族工具（与 `s4-1` 的滑窗、`s4-6` 的单调队列共享"预处理换查询"的内核）；若要支持动态修改高度，就得上树状数组或线段树。
- 追问：若把"接水量"改成"任意区间 `[l,r]` 内的接水量、多次查询"，前缀和能不能直接套用？→ 不能。接水量含 `min`，不满足线性可加（`f(a)+f(b) ≠ f(a∪b)`），前缀和/差分这类"可逆累加"工具全部失效。工程上要把区间最大值（用 sparse table 或树状数组）与左右边界高度组合起来做离线/在线查询结构，属于本节工具的能力边界之外——识别"什么时候工具不管用"比会写模板更重要。
