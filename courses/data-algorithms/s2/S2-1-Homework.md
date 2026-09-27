# 课后作业 · 二叉树与二叉搜索树

> 2 题，一题手写 BST 核心操作，一题遍历变形，附验收标准与参考答案。

## 作业 1：实现 BST 的插入 / 查找 / 删除（60分）

**要求**：实现 `insert(v)`、`search(v)`、`delete(v)`，删除需处理"双子节点用中序后继替换"的情形。

**验收标准**：
- 三操作平均 O(h)；删除后仍满足 BST 性质。
- 双子删除：找右子树最小节点（中序后继）顶上，再删那个后继。

**参考答案要点**：
```java
TreeNode delete(TreeNode t, int v){
    if(t==null) return null;
    if(v < t.val) t.left = delete(t.left, v);
    else if(v > t.val) t.right = delete(t.right, v);
    else {
        if(t.left==null) return t.right;      // 0/1 个孩子
        if(t.right==null) return t.left;
        TreeNode s = minNode(t.right);         // 双子：取中序后继
        t.val = s.val;
        t.right = delete(t.right, s.val);
    }
    return t;
}
```

## 作业 2：遍历综合——锯齿层序 + 判平衡（40分）

**要求**：
1. 之字形（zigzag）层序：第一层正序、第二层逆序交替。
2. 判断一棵树是否高度平衡（任意节点左右子树高度差 ≤ 1），要求 O(n)。

**验收标准**：
- zigzag 在层序基础上按层号决定 `addLast/addFirst` 或收集后反转。
- 判平衡用后序自底向上返回高度，遇到不平衡提前返回 -1 剪枝，避免每层重复求高度退化成 O(n²)。

**参考答案要点**：
- zigzag：`if(depth%2==1) Collections.reverse(level);` 或用 `ArrayDeque` 两头取放。
- 平衡：`int h(t){ if(t==null)return 0; int l=h(left); if(l==-1)return -1; int r=h(right); if(r==-1||abs(l-r)>1)return -1; return max(l,r)+1; }`，返回 -1 作"已不平衡"哨兵即后序剪枝技巧。
