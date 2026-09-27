# 课后作业 · 递归与分治

> 2 题，一题递归改迭代，一题分治设计，附验收标准与参考答案。

## 作业 1：二叉树中序遍历——递归改迭代（50分）

**要求**：分别用递归和"迭代 + 显式栈"实现中序遍历，并说明深链为何递归会爆栈而迭代不会。

**验收标准**：
- 迭代版：沿左子树压栈 → 弹出访问 → 转向右子树，用 `ArrayDeque` 作栈。
- 能解释"递归栈深度=树高 O(n) 有溢出风险；显式栈放堆上受内存限制"。

**参考答案要点**：
```java
List<Integer> inorderIter(TreeNode root){
    List<Integer> res = new ArrayList<>(); Deque<TreeNode> st = new ArrayDeque<>();
    TreeNode cur = root;
    while(cur!=null || !st.isEmpty()){
        while(cur!=null){ st.push(cur); cur=cur.left; }   // 一路压左
        cur = st.pop(); res.add(cur.val);                  // 弹出即访问（中序）
        cur = cur.right;                                   // 转向右
    }
    return res;
}
```

## 作业 2：分治求"最大子数组和"（50分）

**要求**：用分治（O(n log n)）求最大子数组和，并指出它与 Kadane 动态规划（O(n)）的关系。

**验收标准**：
- 分治：答案 = max(左半最大、右半最大、**跨越中点的最大**)，跨界部分从 mid 向两侧扩展线性求。
- 递归式 T(n)=2T(n/2)+O(n) → O(n log n)（主定理）。
- 能说明"子问题在这里独立，但存在更优的 O(n) DP 解（见 s4-4）"。

**参考答案要点**：
- `cross(mid)`：从中点向左累计求最大左后缀 + 向右最大右前缀。
- 归并式分治能练"分解/合并"手感；但重叠子问题视角下 Kadane（`dp[i]=max(a[i], dp[i-1]+a[i])`）更优——正好说明"能 DP 时优先 DP 把 log 拿掉"。
