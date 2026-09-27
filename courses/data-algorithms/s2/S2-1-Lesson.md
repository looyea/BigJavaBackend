# 二叉树与二叉搜索树

> 上一节的哈希放弃了有序；从这里开始进入**有序的世界**。二叉树是一切成败平衡树、红黑树、B 树、堆、Trie 的地基。
> 本节练两件事：① 四种遍历与"由遍历序列还原树"的心智模型；② BST 的有序性如何支撑查找/范围/前后最近，以及它为什么会退化——那正是下一节平衡树登场的原因。

## 一、二叉树：递归定义的结构

二叉树是每个节点至多两个孩子（left/right）的树，天然递归：一棵树 = 根 + 左子树 + 右子树。几个必须门儿清的概念：

- **深度/高度**：根到某节点的路径长；树的高度是最深叶子的深度。
- **满二叉树 / 完全二叉树**：完全二叉树除最后一层外每层填满、最后一层靠左连续——**堆就是靠这个性质才能用数组存**（下节）。
- **二叉树性质**：第 i 层最多 \(2^{i-1}\) 个节点；高度 h 最多 \(2^h-1\) 个；n 个节点的最小高度 \(\lfloor \log_2 n \rfloor +1\)。

```java
class TreeNode {
    int val; TreeNode left, right;
    TreeNode(int v){ val = v; }
}
```

## 二、四种遍历：一棵树的四把钥匙

| 遍历 | 顺序 | 典型用途 |
|---|---|---|
| 前序 | 根 → 左 → 右 | 复制/序列化树、前缀表达式 |
| 中序 | 左 → 根 → 右 | **BST 中得到升序序列**（核心！） |
| 后序 | 左 → 右 → 根 | 自底向上计算、删除树、后缀表达式 |
| 层序 | 逐层，队列驱动 | BFS、按层处理、最短路径 |

```java
// 递归三兄弟，一行顺序切换即变体
void inorder(TreeNode t){ if(t==null) return; inorder(t.left); visit(t); inorder(t.right); }

// 层序：队列（上一节的 FIFO 在这里复用）
List<List<Integer>> levelOrder(TreeNode root){
    List<List<Integer>> res = new ArrayList<>();
    if(root==null) return res;
    Deque<TreeNode> q = new ArrayDeque<>(); q.offer(root);
    while(!q.isEmpty()){
        int sz = q.size(); List<Integer> level = new ArrayList<>();
        for(int i=0;i<sz;i++){                 // sz 锁定"当前层节点数"——分层的关键技巧
            TreeNode n = q.poll(); level.add(n.val);
            if(n.left!=null)  q.offer(n.left);
            if(n.right!=null) q.offer(n.right);
        }
        res.add(level);
    }
    return res;
}
```

> 递归深度过大（如退化成链）会 **StackOverflowError**，生产/做题都要会改"显式栈 + 迭代"（回溯、 Morris 遍历是进阶备选）。

## 三、由遍历序列还原树：抓住"根"

- **前序 + 中序** 或 **后序 + 中序** 能唯一确定一棵二叉树；**前序 + 后序不能**（无法区分只有一个孩子的情况）。
- 原理：前序首元素 / 后序末元素是**根**，拿根去**中序**里切分——左边是左子树、右边是右子树，递归即可。

```java
// 前序定位根、中序分左右：根在中序的下标 = 左子树大小，据此切两段前序
TreeNode build(int[] pre, int[] in){ return helper(pre,0,pre.length-1,in,0,in.length-1); }
```

## 四、BST：中序有序带来一切能力

**二叉搜索树**满足：任一节点 `左子树所有值 < 节点值 < 右子树所有值`（递归成立）。于是：

- **查找/插入/删除**：每次比较淘汰一半子树，平均 O(log n)——和二分查找同构。
- **范围查询** `[lo,hi]`：中序遍历 + 剪枝（当前值 < lo 只往右、> hi 只往左），高效列出区间。
- **floorKey / ceilingKey**（不超过/不小于某值的最近键）：沿查找路径记录候选，BST/Treemap 的招牌能力，哈希做不到。
- **第 K 小**：中序遍历数到第 K 个。

```java
boolean searchBST(TreeNode t, int v){
    if(t==null) return false;
    if(v==t.val) return true;
    return v < t.val ? searchBST(t.left,v) : searchBST(t.right,v);  // 每步砍一半
}
// 删除节点：叶子直删；单孩子接上；双孩子→用右子树最小值(中序后继)替换再删那个后继
```

## 五、BST 的阿喀琉斯之踵：退化

BST 的 O(log n) **依赖树够平衡**。若按升序插入 `1,2,3,4,5`，每个新节点都挂在右孩子上，树退化成**一条链表**，查找变 O(n)：

```
理想平衡：      退化链表：
     3              1
    / \              \
   2   4              2
                        \
                         3  ...  → 每次只排除 1 个，O(n)
```

**这就是必须让树"自平衡"的动机**：靠旋转或随机化把高度重新压回 O(log n)。下一节红黑树 / AVL 就是解药。

## 六、验证与常见题型

- **验证 BST**：不能只比较父子，要传 `(min,max)` 上下界递归（BST 是"整棵子树"的约束，不是"父子"约束）。
- **最近公共祖先 LCA**（BST 版可利用有序性 O(log n) 下潜；普通二叉树版用后序回溯）。
- **直径 / 最大深度 / 路径和**：都在"后序 + 自底向上返回子树信息"的框架里。

## 七、本节要点回顾

1. 二叉树递归定义；前中后序 + 层序四把钥匙，中序对 BST 即升序。
2. 前序+中序 / 后序+中序 能还原树，靠"根在中序里切左右"。
3. BST 用有序性支撑查找/范围/floor-ceil/第K小，平均 O(log n)。
4. BST 致命弱点是按序插入退化成链表 → 引出下一节自平衡树。

下一节：AVL 与红黑树——用旋转和颜色规则把高度锁死在 O(log n)，以及为什么工程偏爱"没那么平衡"的红黑树。
