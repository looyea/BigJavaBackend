# 课后作业 · 回溯与搜索

> 2 题，一题为带约束枚举 + 剪枝（数独），一题为回溯与 BFS 的对照选型，附验收标准与参考答案。

## 作业 1：解数独——约束集与"最受限变量优先"剪枝（50分）

**要求**：给定 9×9 棋盘（`.` 表示空格），填入数字使其每行、每列、每个 3×3 宫恰好含 1–9。写出回溯解法，并说明两处可优化点：① 冲突检查从 O(9) 扫行列宫降到 O(1)；② 每次不固定顺序扫描，而是选"候选数最少"的空格先填。

**验收标准**：
- 三段式正确，填入/撤销成对出现，`path` 即棋盘本身（原地修改 + 还原）。
- 用 `boolean[9][9]` 三组标记（rows / cols / boxes）代替扫描；`box = (r/3)*3 + c/3`。
- 空格的候选集大小 = `9 - 已用数`，选最小者展开，可显著减少搜索节点（MRV 启发式）。
- 找到一个解即返回（存在性），因此 `if (dfs(...)) return true;` 必须在递归返回处短路。

**参考答案要点**：
```java
boolean[][] row = new boolean[9][9], col = new boolean[9][9], box = new boolean[9][9];
boolean solve(char[][] b, int filled) {
    if (filled == 81) return true;
    int bestR = -1, bestC = -1, bestCnt = 10; int[] bestMask = null;   // MRV：候选最少
    for (int r = 0; r < 9; r++) for (int c = 0; c < 9; c++) {
        if (b[r][c] != '.') continue;
        int mask = candidates(r, c);                    // bit k 置位表示数字 k+1 可填
        int cnt = Integer.bitCount(mask);                // 呼应 s4-6 位运算
        if (cnt < bestCnt) { bestCnt = cnt; bestR = r; bestC = c; bestMask = new int[]{mask}; }
        if (cnt == 1) break;                             // 唯一候选可直接定，剪枝
    }
    if (bestCnt == 10) return false;                     // 有空格但无候选 → 死路
    int mask = bestMask[0];
    for (int d = 0; d < 9; d++) {
        if ((mask & (1 << d)) == 0) continue;
        int k = d + 1, bi = (bestR / 3) * 3 + bestC / 3;
        if (row[bestR][d] || col[bestC][d] || box[bi][d]) continue;
        row[bestR][d] = col[bestC][d] = box[bi][d] = true;   // 做选择
        b[bestR][bestC] = (char) ('0' + k);
        if (solve(b, filled + 1)) return true;               // 命中即短路
        b[bestR][bestC] = '.';                               // 撤销
        row[bestR][d] = col[bestC][d] = box[bi][d] = false;
    }
    return false;
}
```
- 追问：若题目要求"数独有几个解"，`return true` 短路必须改成累加计数且**不短路**——存在性搜索与计数搜索的差别就在这一句。

## 作业 2：单词接龙——为什么"最少变换次数"要用 BFS 而不是回溯（50分）

**要求**：给定 `beginWord`、`endWord` 与词表，每次只能改一个字母且中间词必须在词表中，求最短转换序列包含的单词数；无解返回 0。先用 BFS 求解，再解释若改用回溯枚举所有路径会有什么问题。

**验收标准**：
- BFS 按层扩展，首次到达 `endWord` 的层号即答案（无权图最短路，呼应 s3-1）。
- 用 `visited` 集合去重，且必须在**入队时**标记而不是出队时标记，否则同一词会被重复入队导致爆炸。
- 明确指出回溯的问题：需要枚举全部路径才知道最短，指数级；且字符串变换图含环，无深度上界会无限递归。

**参考答案要点**：
```java
int ladderLength(String begin, String end, List<String> wordList) {
    Set<String> dict = new HashSet<>(wordList), seen = new HashSet<>();
    if (!dict.contains(end)) return 0;
    Queue<String> q = new ArrayDeque<>();
    q.offer(begin); seen.add(begin);
    for (int step = 1; !q.isEmpty(); step++) {
        for (int size = q.size(); size > 0; size--) {      // 关键是"按层"取 size
            String w = q.poll();
            if (w.equals(end)) return step;
            char[] cs = w.toCharArray();
            for (int i = 0; i < cs.length; i++) {
                char old = cs[i];
                for (char c = 'a'; c <= 'z'; c++) {
                    cs[i] = c;
                    String next = new String(cs);
                    if (dict.contains(next) && seen.add(next)) q.offer(next);   // 入队即标记
                }
                cs[i] = old;
            }
        }
    }
    return 0;
}
```
- 若要求输出**所有**最短路径：两段式——先 BFS 求出每词的最短距离（同时记录前驱集合），再回溯沿前驱从 `end` 构造路径。这正是课上讲的"DP/BFS 算边界 + 回溯构造答案"，单靠回溯或单靠 BFS 都做不好。
- 复杂度：O(N · L²)（N 词数、L 词长，`new String` 开销 L、逐位改 26 次近似 26L ≈ L）。
