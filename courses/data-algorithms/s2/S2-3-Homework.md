# 课后作业 · 堆、优先队列与堆排序

> 2 题，一题手写堆操作，一题 Top-K / 中位数设计，附验收标准与参考答案。

## 作业 1：手写数组上的小顶堆（50分）

**要求**：实现 `siftUp(i)`、`siftDown(i)`、`offer(v)`、`poll()`、`heapify(int[] a)`（O(n) 建堆）。

**验收标准**：
- 下标换算正确：`parent=(i-1)/2, left=2i+1, right=2i+2`。
- `heapify` 从最后一个非叶节点 `n/2-1` 倒序下沉，复杂度 O(n)。

**参考答案要点**：
```java
void siftDown(int[] a, int i, int n){
    while(2*i+1 < n){
        int c = 2*i+1, r = c+1;
        if(r < n && a[r] < a[c]) c = r;         // 取较小孩子
        if(a[i] <= a[c]) break;                  // 已满足堆序
        swap(a, i, c); i = c;                     // 下沉
    }
}
void heapify(int[] a){ for(int i=a.length/2-1;i>=0;i--) siftDown(a,i,a.length); } // O(n)
```

## 作业 2：数据流中位数（50分）

**要求**：设计 `addNum(int)` 与 `findMedian()`，使任意时刻求中位数尽量快。分析复杂度。

**验收标准**：
- 用**大顶堆**存较小一半、**小顶堆**存较大一半，维持两堆大小差 ≤ 1。
- 插入 O(log n)，查询中位数 O(1)（取堆顶）。

**参考答案要点**：
```java
PriorityQueue<Integer> lo = new PriorityQueue<>(Collections.reverseOrder()); // 大顶：小半
PriorityQueue<Integer> hi = new PriorityQueue<>();                            // 小顶：大半
void add(int x){
    lo.offer(x);
    hi.offer(lo.poll());                    // 先丢给 lo 再把 lo 最大转给 hi，保证 lo≤hi
    if(hi.size() > lo.size()) lo.offer(hi.poll());  // 平衡到 lo 不小於 hi
}
double median(){ return lo.size()==hi.size() ? (lo.peek()+hi.peek())/2.0 : lo.peek(); }
```
- 关键不变式：`lo` 全部 ≤ `hi` 全部，且 `|size(lo)-size(hi)|≤1`；偶数取两堆顶均值。
- 引申：求"滚动 K 分位数 / 滑动窗口最大"分别对应双堆与单调队列（见 s4-6）。
