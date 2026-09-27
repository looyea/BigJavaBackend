# 课后作业 · 图的存储、遍历与经典算法

> 2 题，一题手写 BFS/DFS 应用，一题拓扑排序实战，附验收标准与参考答案。

## 作业 1：岛屿数量（BFS/DFS 连通块）（50分）

**要求**：给定 `'1'`(陆地)/`'0'`(水) 的二维网格，统计相连陆地组成的岛屿个数（四连通）。

**验收标准**：
- 遍历每个未访问的 '1'，从它 BFS/DFS 淹没整块（标记 visited/改成 '0'），计数 +1。
- 能分析时间与空间复杂度（O(mn)）。

**参考答案要点**：
```java
int countIslands(char[][] g){
    int c=0;
    for(int i=0;i<g.length;i++) for(int j=0;j<g[0].length;j++)
        if(g[i][j]=='1'){ bfs(g,i,j); c++; }   // 每发现一块新陆地，洪水填充整岛
    return c;
}
// bfs：队列四方向扩散，把访问到的 '1' 置 '0' 防重复（这就是图的 visited）
```

## 作业 2：任务编排的拓扑排序 + 环检测（50分）

**要求**：n 个任务，给定依赖对 `[a,b]` 表示 b 依赖 a（a 先做）。输出一个可执行顺序；若无法完成（有环）返回空。

**验收标准**：
- 建图 + 入度表；Kahn 队列从入度 0 出发；`order.size()==n` 才有解。
- 能追问：若要求"最少批次并行执行"（每批内任务互不依赖），怎么改？

**参考答案要点**：
```java
List<Integer> topo(int n, int[][] dep){       // dep[i]=[a,b]: a→b
    List<List<Integer>> g = ...; int[] indeg = new int[n];
    for(int[] d: dep){ g.get(d[0]).add(d[1]); indeg[d[1]]++; }
    Queue<Integer> q = new ArrayDeque<>();
    for(int i=0;i<n;i++) if(indeg[i]==0) q.offer(i);
    List<Integer> order = new ArrayList<>();
    while(!q.isEmpty()){ int u=q.poll(); order.add(u);
        for(int v: g.get(u)) if(--indeg[v]==0) q.offer(v); }
    return order.size()==n ? order : List.of();
}
```
- "最少批次"：把 Kahn 改成**按层处理**（每轮处理当前队列全部 = 一批），层数即最少批次数——正是 BFS 分层技巧。
