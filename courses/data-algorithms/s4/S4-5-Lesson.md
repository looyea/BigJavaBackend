# 回溯与搜索：在决策树上做带撤销的 DFS

> 本节约属核心精讲（重要度 4/5）。回溯不是一种"算法"，而是一种**穷举的工程管理方式**：当问题没有可证明的贪心性质、又没有可复用的重叠子问题时，你唯一能做的就是系统地遍历所有候选——并用剪枝把指数级塌缩到可算的规模。排列、组合、子集、N 皇后、数独、正则匹配、SQL 优化器的 join 顺序、支付路由的渠道尝试、工作流的条件分支展开，本质都是同一棵树。

## 一、本质：决策树 + 选择/递归/撤销三段式

### 1.1 把问题画成一棵树

任何"分多步做决定、每步有多个选项"的问题，其全部候选解构成一棵**决策树**：

- 根 = 空状态
- 一层的每个节点 = 在第 `k` 步做一个选择
- 叶子（或路径上的某点）= 一个完整候选解 / 一个可行解
- 从根到当前节点的路径 = 已经做出的选择序列（`path`）

```
// 图目的：把"每个节点都要收进答案"这件事看对——子集问题的答案包括根与叶
子集问题 [1,2,3] 的决策树（每个节点都在收集答案）
                    []
          /          |          \
       [1]          [2]         [3]
      /   \           |
   [1,2] [1,3]      [2,3]
     |
  [1,2,3]
答案 = 全部 8 个节点，包括空集
→ 应用判据：本题在递归入口无条件先 res.add(path)；而排列只在 path.size()==n 的叶子处收集，两者区别就来自这棵树
```

**画不出这棵树，就写不出回溯。** 写代码前的第一件事是在纸上画出：有几层？每层候选是什么？答案在叶子还是沿途收集？层与层之间有无约束？

### 1.2 三段式模板

回溯的全部机理就是这三行，缺一不可：

```java
// 例子目的：这是框架草图（带伪码占位），它必须被具体题型实例化才能运行；具体实例见下一节子集/排列代码
void backtrack(状态 state, 选择列表 choices) {
    if (满足结束条件) {                        // 命中叶子：当前 path 就是一个候选解
        result.add(new ArrayList<>(path));   // ① 注意：必须是拷贝！存引用的话回溯完 path 被清空，结果全空
        return;                               // 返回上一层去尝试别的分支
    }
    for (选择 : choices) {
        if (不合法 / 被剪枝) continue;        // ② 约束检查前置，比递归后再判省掉整棵子树
        path.add(选择);                       // ③ 做选择：状态前进
        backtrack(更新后的状态, 新选择列表);     // ④ 进入下一层
        path.remove(path.size() - 1);         // ⑤ 撤销选择 ← 回溯的灵魂，少了它兄弟分支会被污染
    }
}
```

**撤销（⑤）为什么是灵魂**：`path` 是所有递归层共享的一个可变对象。如果不撤销，返回上一层时它会带着下一层的污染。撤销让"进入节点前"与"离开节点后"的状态严格一致，从而一条 `path` 数组能复用遍历整棵树——这就是 DFS 相对 BFS 的核心优势：**空间只有 O(树高)，而不是 O(树宽)**。

> 易错点 ①：`result.add(path)` 加的是引用，回溯结束后 `path` 被清空，结果集里全是空列表。必须 `new ArrayList<>(path)` 快照。这是 Java 面试里回溯题最常见的扣分点。

## 二、三类高频题型：区别只在"下一层候选集"

排列/组合/子集这三兄弟，骨架完全相同，唯一差别是 `choices` 怎么给。把这一点吃透，就不用背三种模板。

### 2.1 子集（Subset）：从 `start` 往后选，每个节点都收集

```java
// 例子目的：LeetCode 78 子集——[1,2,3] 生成 8 个无重复子集，沿途每个节点都收集
static List<List<Integer>> subsets(int[] nums) {          // 入口：对外只暴露这一个方法
    List<List<Integer>> res = new ArrayList<>();          // 结果集，引用递归共享传递，避免反复 return 拷贝
    dfsSubsets(nums, 0, new ArrayList<>(), res);   // 从 start=0、空路径起步
    return res;                                    // 递归填完后可直接返回，共 2^n 个元素
}
static void dfsSubsets(int[] nums, int start, List<Integer> path, List<List<Integer>> res) {   // 递归体：start 控本层候选起点
    res.add(new ArrayList<>(path));            // 沿途每个节点都是答案（必须拷贝快照）
    for (int i = start; i < nums.length; i++) {
        path.add(nums[i]);                      // 做选择
        dfsSubsets(nums, i + 1, path, res);    // i+1：只能往后选，天然无序不重复
        path.remove(path.size() - 1);           // 撤销：回到上一层时的 path 形态
    }
}
// 应用与正确结果：subsets(new int[]{1,2,3}) 返 8 个子集 → [[], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]]
// 错误用法：把 res.add(new ArrayList<>(path)) 改成 res.add(path) → 返回的 8 个列表全是空（存的是同一个引用）
// 错误用法：递归传 start 而非 i+1 → 同一元素在本路径里反复入选，无限递归抛 StackOverflowError
```

- `start` 参数的作用是**强制组合的升序索引顺序**，避免 `[1,2]` 与 `[2,1]` 被当作两个答案。组合/子集类问题去重的第一道闸门就是它。
- 复杂度：2ⁿ 个节点 × 每个拷贝 O(n) = **O(n·2ⁿ)**。

### 2.2 排列（Permutation）：每层从全集中选"未用过的"

排列有序，所以不能用 `start` 截断，必须用 `used[]` 标记哪些元素已在路径中：

```java
// 例子目的：LeetCode 46 全排列——只有叶子是答案，靠 used[] 保证同一路径不重复用元素
static List<List<Integer>> permute(int[] nums) {          // 入口
    List<List<Integer>> res = new ArrayList<>();          // 结果集，最终 size = n!
    dfsPerm(nums, new boolean[nums.length], new ArrayList<>(), res);   // used 全 false 开始
    return res;
}
static void dfsPerm(int[] nums, boolean[] used, List<Integer> path, List<List<Integer>> res) {   // used 与 path 同时做选择/同时撤销
    if (path.size() == nums.length) {          // 只有叶子是答案
        res.add(new ArrayList<>(path));        // 拷贝快照入库，否则后续撤销会把已存的答案清空
        return;                                 // 找到一个完整排列，回溯
    }
    for (int i = 0; i < nums.length; i++) {    // 每层都从全体元素里找未用过的（不用 start 截断）
        if (used[i]) continue;                 // 同一路径不重复使用元素
        used[i] = true;  path.add(nums[i]);     // 两个标记同时做选择
        dfsPerm(nums, used, path, res);         // 进入下一层，固定当前位的元素
        path.remove(path.size() - 1);  used[i] = false;   // 两个撤销必须成对
    }
}
// 应用与正确结果：permute(new int[]{1,2,3}) 返 6 个排列（3!）
// 错误用法：只删掉 used[i]=false 这一行 → 第一层返完后全部元素仍标记已用，第二层起全 continue，结果只剩 1 个排列（经典 bug）
```

- 复杂度 **O(n·n!)**：n! 个排列，每个长度 n。注意 `used[]` 也要撤销——只撤销 `path` 忘撤销 `used` 是经典死锁 bug（第二层起全部 `continue`，结果只剩一个排列）。

### 2.3 组合总和（Combination Sum）：可重复选，故传 `i` 而非 `i+1`

```java
// 例子目的：LeetCode 39 组合总和——c 中元素可重复使用，凑满 target；递归传 i 而非 i+1
static List<List<Integer>> combinationSum(int[] c, int target) {   // 入口
    List<List<Integer>> res = new ArrayList<>();          // 结果集
    Arrays.sort(c);                                     // 为剪枝准备（排完才能 break）
    dfsComb(c, 0, target, new ArrayList<>(), res);        // 从 start=0、余额 target 起步
    return res;
}
static void dfsComb(int[] c, int start, int remain, List<Integer> path, List<List<Integer>> res) {   // remain = 还差多少
    if (remain == 0) { res.add(new ArrayList<>(path)); return; }   // 恰好凑平 → 一个合法组合
    for (int i = start; i < c.length; i++) {   // 升序索引遍历，天然避免 [2,3] 与 [3,2] 重复
        if (c[i] > remain) break;             // ★ 剪枝：排序后本层后续都超，整层 break
        path.add(c[i]);                        // 做选择：装上面额 c[i]，余额随之减少
        dfsComb(c, i, remain - c[i], path, res);   // i 而非 i+1：允许再次选自己
        path.remove(path.size() - 1);          // 撤销：换下一个面额前把本层选择退回去
    }
}
// 应用与正确结果：combinationSum(new int[]{2,3,6,7}, 7) 返 [[2,2,3], [7]]
// 错误用法：把 break 写成 continue → 结果仍对但剪枝失效，候选集大时耗时量级上升
// 错误用法：把递归参数 i 改成 i+1 → 同一面额不能再用，[2,2,3] 直接丢失（这就不再是 39 题而是 40 题）
```

这一行的 `i` vs `i + 1` 就是"元素可重复使用"与"不可重复使用"的分水岭。面试手写题经常靠这一个字符区分 39 题与 40 题。

## 三、同层去重：`排序 + if (i > start && nums[i]==nums[i-1]) continue`

含重复元素的组合/排列（LC 40 组合总和 II、47 全排列 II、78 的子集去重版）需要在**同一层**跳过相同值，但**同一条路径内**允许相同值（因为它们来自不同层）：

```java
// 例子目的：同层去重的正确写法与"写成 i>0 误杀合法解"的对比
Arrays.sort(nums);   // 去重前必须排序，让相同值相邻
for (int i = start; i < nums.length; i++) {
    if (i > start && nums[i] == nums[i - 1]) continue;   // ★ 同层去重：本层已试过这个值就跳过
    // 注意是 i > start 而不是 i > 0：i > 0 会连合法路径一起砍掉
    ...
}
// 应用（nums=[1,1,2]、求子集）：正确写法得 6 个子集 [[], [1], [1,1], [1,1,2], [1,2], [2]]
// 错误写法 i>0 的结果：[1,1] 这类含重复值的解被误杀，只剩 4 个（不报错，直接少答案）
```

**为什么 `i > start` 而不是 `i > 0`**：`start` 是本层的起点。`i > start` 表示"在本层里，这个值和它前面一个已尝试的值相同"→ 跳过。而 `i == start` 时即使值与上一层相同也是合法的（不同层），这条路径才能生成 `[1,1]` 这类含重复值的解。用 `i > 0` 会把所有含重复元素的解错误消除，是最常见的写法事故。

## 四、剪枝：让指数级真正可算

剪枝不改变复杂度上界的量级，但决定"能不能在 1 秒内跑完"。三条工程级原则：

| 剪枝类型 | 做法 | 例子 |
|---|---|---|
| **可行性剪枝** | 约束不满足立即 `continue`/`return` | 组合总和中 `c[i] > remain` 直接 `break` |
| **最优性剪枝** | 当前部分解已劣于已知最优，砍掉 | 求最小花费时 `if (cost >= minCost) return` |
| **对称性剪枝** | 固定一半的选择砍掉镜像分支 | N 皇后第一行只枚举前 n/2 列再对称复制 |

### N 皇后：约束检查用哈希集合降到 O(1)

N 皇后的朴素写法每放一子要扫整个棋盘 O(n²)。把三条约束线转成数学表达式，用 Set 做 O(1) 判定：

```java
// 在 (row, col) 放皇后：
//   列冲突           → col
//   主对角线 row-col  → 同一斜线上 row-col 恒定（值域 -(n-1)~n-1）
//   副对角线 row+col  → 同一斜线上 row+col 恒定
static int totalNQueens(int n) {
    return solve(0, n, new boolean[n], new boolean[2 * n], new boolean[2 * n]);   // 三个占用数组分别对应列/两族斜线
}
static int solve(int row, int n, boolean[] cols, boolean[] diag1, boolean[] diag2) {
    if (row == n) return 1;                    // 逐行放置，行天然不冲突；放满 n 行即一个合法布局
    int count = 0;
    for (int col = 0; col < n; col++) {
        int d1 = row - col + n, d2 = row + col;   // +n 平移到非负下标（否则 d1 为负直接越界）
        if (cols[col] || diag1[d1] || diag2[d2]) continue;   // O(1) 判冲突，替 O(n²) 扫盘
        cols[col] = diag1[d1] = diag2[d2] = true;             // 做选择
        count += solve(row + 1, n, cols, diag1, diag2);
        cols[col] = diag1[d1] = diag2[d2] = false;  // 撤销（三处必须同时撤销，漏一个则后续层误判己占）
    }
    return count;
}
// 应用与正确结果：totalNQueens(4)=2、totalNQueens(8)=92
// 错误用法：把 d1 算成 row+col、d2 也算 row+col → 两族斜线变成同一族，非法布局被当作合法计进答案
```

把 `boolean[]` 换成位掩码（`int` 的 bit 当列占用标记），20 皇后都能秒出——这正是下一节 s4-6 位运算与回溯结合的威力：一个 `int` 存一行的列冲突，冲突判定变成 `(mask & cols) == 0`。

## 五、回溯 vs 动态规划 vs 搜索：什么时候用哪个

这是本节真正要建立的判断力。三者在决策树上同源，选择依据是**"你要什么"和"子问题是否重叠"**：

| 你要的东西 | 子问题 | 该用 | 理由 |
|---|---|---|---|
| 所有解 / 任一解 / 计数（小规模） | 不重叠或需完整展开 | **回溯** | 必须枚举，无法压缩 |
| 最优值 / 计数（大规模，有重叠） | 重叠、可状态化 | **动态规划**（s4-4） | 记忆化把指数降为多项式 |
| 最短步数 / 最少操作层数 | 无权图 | **BFS** | 层序保证首次到达即最短 |
| 存在性、可行性、带启发式 | 有可采纳启发函数 | **A\* / 带剪枝 DFS** | 启发函数引导优先分支 |

关键判据：**回溯要"打印路径"，DP 只要"一个数"。** DP 在压缩时丢掉了路径信息（只保留最优值），所以一旦题目要求"输出所有方案""输出具体方案字典序最小"，就必须回到回溯，或者用 DP 算边界 + 回溯构造答案的两段式（LC 139 单词拆分 + 单词字典回溯输出即为此例）。

**回溯与 DFS/BFS 的关系**：回溯 = 在**隐式**解空间树上做 DFS + 撤销；`s3-1` 里的图 DFS/BFS 是同一套框架在**显式**图上的应用，区别只在"是否需要撤销"——图上走过后不需要"未走过"，所以无撤销；而决策树的路径状态必须精确还原。BFS 在解空间树上也能枚举，但队列会存下整层（O(树宽)），所以求"所有解"几乎一律用 DFS 回溯。

## 六、三大行业场景钩子

- **电商**：促销叠加规则穷举——"给定 N 张互斥/可叠加优惠券，求订单到手价最小的组合"，是标准的组合枚举 + 最优性剪枝；商品 SKU 属性笛卡尔积生成（颜色×尺码×版本）就是排列型回溯，需在生成时按库存可用性剪枝。
- **金融**：支付路由降级尝试——主渠道→备渠道→三方代扣，每次尝试失败即撤销并进入下一分支，是带状态的 DFS；风控规则引擎的条件分支展开（决策树全路径覆盖测试用例生成）本质是回溯，用路径覆盖率达到 100% 作为终止条件。
- **电力**：负荷转供方案搜索——某变电站故障后，在配电网拓扑中搜索"把失电负荷转由哪些备用馈带、开关操作序列最少"，是在真实图上做回溯 + 辐射网约束剪枝（不允许成环），与 N 皇后的约束集合同构。

## 七、要点回顾

1. 回溯 = 决策树上的 DFS + **撤销**；写码前先画树：几层、每层候选、答案在哪收集、有无层间约束。
2. 三段式：做选择 → 递归 → 撤销选择；`used[]` 也要撤销；收集答案必须**拷贝快照**。
3. 排列用 `used[]`（O(n·n!)）、子集/组合用 `start`（O(n·2ⁿ)）；`i` vs `i+1` 决定元素可否重复使用。
4. 同层去重 = 排序 + `if (i > start && nums[i]==nums[i-1]) continue`；写成 `i > 0` 会误杀合法解。
5. 剪枝分可行性 / 最优性 / 对称性三类；N 皇后用 `row±col` 集合或位掩码把约束检查降到 O(1)。
6. 要"所有解/具体路径"→ 回溯；要"最优值/计数"且子问题重叠 → DP；要"最少步数"→ BFS。
7. 空间上 DFS 只有 O(树高)、BFS 要 O(树宽)，故枚举全部解必用 DFS。
