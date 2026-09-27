# 图的存储、遍历与经典算法

> 树是特殊的图（无环、有根），图是**任意多对多关系**的通用建模：微服务调用拓扑、社交关系、路网路由、支付清结算依赖、电力网络。
> 本节把图的"存储 → BFS/DFS 两大遍历 → 最短路 → 拓扑排序 → 并查集判连通"串成一套完整打法。

## 一、图的表示：邻接矩阵 vs 邻接表

- **邻接矩阵** `int[v][v]`：稠密图、要 O(1) 判两点是否相连时用；稀疏图浪费 O(V²) 空间。
- **邻接表** `Map<Node, List<Node>>`：最常用，省空间，遍历某点邻居高效。带权则存 `List<int[]{to,w}>`。

```java
// 稀疏图首选：邻接表。有向图只挂出边；无向图一条边存两次
Map<Integer, List<int[]>> graph = new HashMap<>();   // int[]{邻居, 权重}
graph.computeIfAbsent(u, k -> new ArrayList<>()).add(new int[]{v, w});
```

术语：度/入度/出度、连通（无向）/强连通（有向）、权重、DAG（有向无环图）。

## 二、两大遍历骨架：BFS 用队列、DFS 用栈

**这是整个图论的地基，务必刻进肌肉记忆。** 区别只在"取下一个点"用队列还是栈。

```java
// BFS：层扩散，求无权最短路/最少步数
void bfs(int s){
    Queue<Integer> q = new ArrayDeque<>();
    q.offer(s); visited[s] = true; int dist = 0;
    while(!q.isEmpty()){
        int sz = q.size();                 // 分层（同 s1-3 层序技巧）
        for(int i=0;i<sz;i++){
            int u = q.poll();
            for(int[] e : graph.get(u)) if(!visited[e[0]]){ visited[e[0]]=true; q.offer(e[0]); }
        }
        dist++;                            // 走完一层 = 距离 +1
    }
}
// DFS：一路走到底再回退，判连通/找路径/回溯/拓扑/环检测
void dfs(int u){ visited[u]=true; for(int[] e: graph.get(u)) if(!visited[e[0]]) dfs(e[0]); }
```

| | BFS（队列） | DFS（栈/递归） |
|---|---|---|
| 顺序 | 逐层、就近 | 一条路走到底 |
| 典型 | 无权最短路、最少步、层级、六度 | 连通性、判环、拓扑、路径枚举、强连通 |
| 空间 | O(最宽层) | O(最深路径/递归栈) |

> `visited` 数组不可省——图有环，不标记会无限循环（这点和树不同，树天然无环）。

## 三、最短路径

- **无权图**：直接 BFS，第一次到达即最短跳数。
- **单源正权最短路 Dijkstra**：贪心 + **优先队列（堆，见 s2-3）**，每次取当前最近未定点松弛其邻居。O((V+E) log V)。

```java
// Dijkstra：小顶堆按"当前距离"取最近点
PriorityQueue<long[]> pq = new PriorityQueue<>((a,b)->Long.compare(a[1],b[1])); // {node, dist}
pq.offer(new long[]{src,0});
while(!pq.isEmpty()){
    long[] cur = pq.poll(); int u=(int)cur[0]; long d=cur[1];
    if(d > dist[u]) continue;                       // 陈旧条目跳过
    for(int[] e: graph.get(u)){                     // 松弛
        if(dist[e[0]] > d + e[1]){ dist[e[0]] = d + e[1]; pq.offer(new long[]{e[0], dist[e[0]]}); }
    }
}
```

- **有负权**：Bellman-Ford（能检测负环）；**多源最短路**：Floyd（O(V³)，DP 思想）。
- 场景：导航/物流路径、网络路由收敛、依赖传播最短影响链。

## 四、拓扑排序与环检测：DAG 的执行顺序

对**有向无环图**求一个线性序，使每条边 u→v 都满足 u 在 v 前。Kahn 算法（BFS + 入度）：

```java
Queue<Integer> q = new ArrayDeque<>();
for(int v : nodes) if(indeg[v]==0) q.offer(v);
List<Integer> order = new ArrayList<>();
while(!q.isEmpty()){
    int u = q.poll(); order.add(u);
    for(int[] e : graph.get(u)) if(--indeg[e[0]]==0) q.offer(e[0]);  // 删边，入度归零才入队
}
// order.size() < 顶点数 ⇒ 存在环（这些点入度永远降不到 0）
```

工程用途：**任务编排 / CI 依赖 / Maven-Gradle 构建顺序 / Spring Bean 初始化次序 / 课程表可行性判断**——判环就是判断"依赖能否被满足"。

## 五、并查集：另一条判连通的路

只需回答"两点是否连通 / 一共几个连通块"、且边是**逐步合并**进来时，并查集（s2-4）比 BFS 更省：`union` 合并、`find` 判同组，近 O(α(n))。Kruskal 最小生成树也靠它。区别记忆：**要遍历/路径 → BFS/DFS；只要动态归属/连通计数 → 并查集。**

## 六、本节要点回顾

1. 表示：稀疏用邻接表、稠密/判边用邻接矩阵；无向图一条边存两次。
2. BFS 用队列（最短路/分层）、DFS 用栈/递归（连通/判环/拓扑/回溯），`visited` 防环必带。
3. 最短路：无权 BFS、正权 Dijkstra(堆)、负权 Bellman-Ford、多源 Floyd。
4. 拓扑排序 = 入度 0 出发 + 删边，"结果数 < 顶点数即有环"，是编排/依赖的正解。
5. 判连通：遍历 or 并查集，按"要不要路径 / 是否动态合并"选。

下一节：排序算法全景——把快/归/堆放回它们真正的工程语境（Arrays.sort 双轴 vs TimSort、稳定性、外部排序），并解释比较下界。
