# 二叉树与二叉搜索树

> 上一节的哈希放弃了有序；从这里开始进入**有序的世界**。二叉树是一切成败平衡树、红黑树、B 树、堆、Trie 的地基。
> 本节练两件事：① 四种遍历与"由遍历序列还原树"的心智模型；② BST 的有序性如何支撑查找/范围/前后最近，以及它为什么会退化——那正是下一节平衡树登场的原因。

## 一、二叉树：递归定义的结构

二叉树是每个节点至多两个孩子（left/right）的树，天然递归：一棵树 = 根 + 左子树 + 右子树。几个必须门儿清的概念：

- **深度/高度**：根到某节点的路径长；树的高度是最深叶子的深度。
- **满二叉树 / 完全二叉树**：完全二叉树除最后一层外每层填满、最后一层靠左连续——**堆就是靠这个性质才能用数组存**（下节）。
- **二叉树性质**：第 i 层最多 \(2^{i-1}\) 个节点；高度 h 最多 \(2^h-1\) 个；n 个节点的最小高度 \(\lfloor \log_2 n \rfloor +1\)。

```java
// 例子目的：定义二叉树节点，并立即组装出一棵可用的小树（定义必配应用）
class TreeNode {
    int val; TreeNode left, right;
    TreeNode(int v){ val = v; }
}

// 应用：手工拼装    2
//                / \
//               1   3
TreeNode root = new TreeNode(2);          // 建根节点，val=2
root.left = new TreeNode(1);              // 左孩子挂载：中序将出现 1 在 2 之前
root.right = new TreeNode(3);             // 右孩子挂载：它已是一棵合法 BST
System.out.println(root.left.val);        // 正确使用结果：输出 1（未挂载时为 null，直接 .val 会招 NullPointerException）
```

## 二、四种遍历：一棵树的四把钥匙

| 遍历 | 顺序 | 典型用途 |
|---|---|---|
| 前序 | 根 → 左 → 右 | 复制/序列化树、前缀表达式 |
| 中序 | 左 → 根 → 右 | **BST 中得到升序序列**（核心！） |
| 后序 | 左 → 右 → 根 | 自底向上计算、删除树、后缀表达式 |
| 层序 | 逐层，队列驱动 | BFS、按层处理、最短路径 |

```java
// 例子目的：展示四种遍历在同一棵树上的不同访问次序（接上节拼装的 root）
void inorder(TreeNode t){ if(t==null) return; inorder(t.left); visit(t); inorder(t.right); }   // 对 BST → 升序 1,2,3
void preorder(TreeNode t){ if(t==null) return; visit(t); preorder(t.left); preorder(t.right); } // 先根 → 2,1,3（适合序列化）
void postorder(TreeNode t){ if(t==null) return; postorder(t.left); postorder(t.right); visit(t); } // 后根 → 1,3,2（适合自底向上计算）
```
// 例子目的：层序遍历——队列（上一节的 FIFO 在这里复用），sz 快照保证分层
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
    return res;                                        // 对上面那棵 2/1/3 树 → 正确使用结果 [[2], [1, 3]]
}
```

> 递归深度过大（如退化成链）会 **StackOverflowError**，生产/做题都要会改"显式栈 + 迭代"（回溯、 Morris 遍历是进阶备选）。

## 三、由遍历序列还原树：抓住"根"

- **前序 + 中序** 或 **后序 + 中序** 能唯一确定一棵二叉树；**前序 + 后序不能**（无法区分只有一个孩子的情况）。
- 原理：前序首元素 / 后序末元素是**根**，拿根去**中序**里切分——左边是左子树、右边是右子树，递归即可。

```java
// 前序定位根、中序分左右：根在中序的下标 = 左子树大小，据此切两段前序
// 例子目的 + 应用：由 pre=[2,1,3]、in=[1,2,3] 还原出上一节那棵树
TreeNode build(int[] pre, int[] in){ return helper(pre,0,pre.length-1,in,0,in.length-1); }
TreeNode restored = build(new int[]{2,1,3}, new int[]{1,2,3});   // 前序首元素 2 是根，去中序定下标 1 切左[1]/右[3]
System.out.println(restored.left.val);                            // 正确使用结果：输出 1，还原成功
// 错误用法：前序+后序（pre=[2,1], post=[1,2]）无法唯一还原 → 孩子归属左还是右歧义，还原结果不合法
```

## 四、BST：中序有序带来一切能力

**二叉搜索树**满足：任一节点 `左子树所有值 < 节点值 < 右子树所有值`（递归成立）。于是：

- **查找/插入/删除**：每次比较淘汰一半子树，平均 O(log n)——和二分查找同构。
- **范围查询** `[lo,hi]`：中序遍历 + 剪枝（当前值 < lo 只往右、> hi 只往左），高效列出区间。
- **floorKey / ceilingKey**（不超过/不小于某值的最近键）：沿查找路径记录候选，BST/Treemap 的招牌能力，哈希做不到。
- **第 K 小**：中序遍历数到第 K 个。

```java
// 例子目的：BST 的查找与 floorKey（哈希做不到的"前一个最近键"）
boolean searchBST(TreeNode t, int v){
    if(t==null) return false;                         // 走到空 → 未命中，返回 false
    if(v==t.val) return true;                          // 命中当前节点
    return v < t.val ? searchBST(t.left,v) : searchBST(t.right,v);  // 每步砍一半，平均 O(log n)
}
// 应用：对 root(2, 左 1, 右 3) 查找
System.out.println(searchBST(root, 3));                // 正确用例输出：true（2→右→3 命中）
System.out.println(searchBST(root, 9));                // 正确用例输出：false（走到 null）
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

## 七、例子：正确用法与错误用法

```java
// 例子目的：演示BST 验证的正确写法与"只比父子"的错误写法，以及升序插入退化后的栈溢出后果
import java.util.*;

class Node {
    int val; Node left, right;
    Node(int v) { val = v; }
}

public class BSTDemo {

    // 知识点 1 正确用法：BST 验证必须传递整棵子树的上下界
    static boolean valid(Node n, long min, long max) {
        if (n == null) return true;                            // 空子树天然合法
        if (n.val <= min || n.val >= max) return false;        // 当前值越出祖先划定的区间 → 不合法
        return valid(n.left, min, n.val) && valid(n.right, n.val, max);   // 左子树全 < n.val，右子树全 > n.val
    }

    // 知识点 2 错误用法：只比较直接父子 → 把不合法的树判成合法
    static boolean validWrong(Node n) {
        if (n == null) return true;
        if (n.left != null && n.left.val >= n.val) return false;   // 只看左孩子 < 自己
        if (n.right != null && n.right.val <= n.val) return false;  // 只看右孩子 > 自己
        return validWrong(n.left) && validWrong(n.right);
    }

    static Node insert(Node n, int v) {                       // 按 BST 规则插入（不做任何平衡）
        if (n == null) return new Node(v);
        if (v < n.val) n.left = insert(n.left, v); else n.right = insert(n.right, v);
        return n;
    }

    public static void main(String[] args) {
        // 这棵树父子关系局部成立，但 6 在 4 的右子树里却 < 8 → 整棵不合法
        Node bad = new Node(8);
        bad.left = new Node(4);
        bad.left.right = new Node(6);
        bad.right = new Node(10);
        System.out.println(valid(bad, Long.MIN_VALUE, Long.MAX_VALUE));     // 正确算法输出：false（6 越界）
        System.out.println(validWrong(bad));                                 // 错误算法输出：true —— 漏判，这是面试与审代码高频陷阱

        // 知识点 3 错误用法：升序数据建 BST → 退化成链表，树高 = n
        Node chain = new Node(1);
        Node cur = chain;
        for (int i = 2; i <= 200_000; i++) { cur.right = new Node(i); cur = cur.right; }   // 逐次挂右孩子（这里用迭代建树，把溢出留给递归查找）
        try {
            System.out.println(search(chain, 200000));                        // 递归下潜 20 万层 → 尚未返回值就抛异常
        } catch (StackOverflowError e) {
            System.out.println("退化后果：递归深度=节点数，抛 StackOverflowError");   // 输出该行
        }
        // 正确取向：要高度保证 O(log n) 必须用自平衡结构（下一节 AVL/红黑树，或 TreeMap）
        NavigableMap<Integer, String> tm = new TreeMap<>();                // JDK 红黑树，插入自动旋转
        for (int i = 1; i <= 200_000; i++) tm.put(i, "v" + i);              // 仍保持有序且高度 ~log n
        System.out.println(tm.lowerKey(100) + "," + tm.ceilingKey(100));    // 正确用例输出：99,100（floor/ceil 是哈希做不到的）
    }

    static boolean search(Node n, int v) {
        if (n == null) return false;
        return v == n.val || search(v < n.val ? n.left : n.right, v);        // 递归版，仅适用于平衡树
    }
}
```

## 八、本节要点回顾

1. 二叉树递归定义；前中后序 + 层序四把钥匙，中序对 BST 即升序。
2. 前序+中序 / 后序+中序 能还原树，靠"根在中序里切左右"。
3. BST 用有序性支撑查找/范围/floor-ceil/第K小，平均 O(log n)。
4. BST 致命弱点是按序插入退化成链表 → 引出下一节自平衡树。

下一节：AVL 与红黑树——用旋转和颜色规则把高度锁死在 O(log n)，以及为什么工程偏爱"没那么平衡"的红黑树。
