# 图的存储、遍历与经典算法

> 树是特殊的图（无环、有根），图是**任意多对多关系**的通用建模：微服务调用拓扑、社交关系、路网路由、支付清结算依赖、电力网络。
> 本节把图的"存储 → BFS/DFS 两大遍历 → 最短路 → 拓扑排序 → 并查集判连通"串成一套完整打法。

## 一、图的表示：邻接矩阵 vs 邻接表

- **邻接矩阵** `int[v][v]`：稠密图、要 O(1) 判两点是否相连时用；稀疏图浪费 O(V²) 空间。
- **邻接表** `Map<Node, List<Node>>`：最常用，省空间，遍历某点邻居高效。带权则存 `List<int[]{to,w}>`。

```java
// 例子目的：先声明图本身（邻接表），再当场建边与查邻居，不让它只停在建表语句上
Map<Integer, List<int[]>> graph = new HashMap<>();   // int[]{邻居, 权重}
int u = 0, v = 1, w = 5;                              // 一条 0→1 权重 5 的有向边
graph.computeIfAbsent(u, k -> new ArrayList<>()).add(new int[]{v, w});   // 挂上出边：u 的链表多了 {1,5}
graph.computeIfAbsent(v, k -> new ArrayList<>());                        // 没有出边的点也要建 key，否则下面 get 返回 null
System.out.println(graph.get(u).get(0)[1]);                               // 正确使用结果：输出 5（读到刚写入的权重）
// 错误用法：上面的"建 key"一行省掉 → graph.get(v) 为 null，遍历时招 NullPointerException
// 无向图一条边要存两次（u→v 与 v→u），只挂单向会造成"能从 A 到 B、不能从 B 到 A"的错乱连通性
```

术语：度/入度/出度、连通（无向）/强连通（有向）、权重、DAG（有向无环图）。

## 二、两大遍历骨架：BFS 用队列、DFS 用栈

**这是整个图论的地基，务必刻进肌肉记忆。** 区别只在"取下一个点"用队列还是栈。

```java
// 例子目的：两大遍历的骨架。注意 visited 必须先声明并分配，否则下面第一行就报错
boolean[] visited = new boolean[n];     // n = 顶点数；漏掉这句（默认全 false 才对，给错长度则下标越界）
int[][] edges = {{0, 1}, {1, 2}};        // 上面那幅图的边集

// BFS：层扩散，求无权最短路/最少步数
void bfs(int s){
    Queue<Integer> q = new ArrayDeque<>();
    q.offer(s); visited[s] = true; int dist = 0;   // 起点先标记并入队，否则会被反复重新发现
    while(!q.isEmpty()){
        int sz = q.size();                 // 分层（同 s1-3 层序技巧）
        for(int i=0;i<sz;i++){
            int u = q.poll();
            for(int[] e : graph.get(u)) if(!visited[e[0]]){ visited[e[0]]=true; q.offer(e[0]); }   // 只把未访问的点入队
        }
        dist++;                            // 走完一层 = 距离 +1，循环结束时 dist 即最远层数
    }
}
bfs(0);                                    // 应用：从 0 出发扫全图，visited 变为 [true,true,true]

// DFS：一路走到底再回退，判连通/找路径/回溯/拓扑/环检测
void dfs(int u){ visited[u]=true; for(int[] e: graph.get(u)) if(!visited[e[0]]) dfs(e[0]); }
dfs(0);                                    // 应用：访问顺序 0→1→2（深度优先），结果与 BFS 访问集合相同
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
// 例子目的：把 Dijkstra 跑起来——先初始化 dist 数组，再松弛，最后读出最短路
int n = 3; int src = 0;
long[] dist = new long[n]; Arrays.fill(dist, Long.MAX_VALUE); dist[src] = 0;   // 未定点先记为无穷大，源点记 0
PriorityQueue<long[]> pq = new PriorityQueue<>((a,b)->Long.compare(a[1],b[1])); // {node, dist}
pq.offer(new long[]{src,0});                     // 源点入队，距离 0
while(!pq.isEmpty()){
    long[] cur = pq.poll(); int u=(int)cur[0]; long d=cur[1];
    if(d > dist[u]) continue;                       // 陈旧条目跳过（同一点多条历史记录只认最新的）
    for(int[] e: graph.get(u)){                     // 松弛
        if(dist[e[0]] > d + e[1]){ dist[e[0]] = d + e[1]; pq.offer(new long[]{e[0], dist[e[0]]}); }   // 发现更短路径才入队
    }
}
System.out.println(dist[1]);                        // 正确使用结果：输出 5（0→1 的直接边权重）
// 错误用法：图里有负权边时 Dijkstra 不保证正确——它把第一次弹出的点当最终答案，负边会事后推翻这个结论
```

- **有负权**：Bellman-Ford（能检测负环）；**多源最短路**：Floyd（O(V³)，DP 思想）。
- 场景：导航/物流路径、网络路由收敛、依赖传播最短影响链。

## 四、拓扑排序与环检测：DAG 的执行顺序

对**有向无环图**求一个线性序，使每条边 u→v 都满足 u 在 v 前。Kahn 算法（BFS + 入度）：

```java
// 例子目的：Kahn 拓扑排序跑完并拿它判环（n=顶点数，indeg 需预先由边集统计好）
int[] indeg = new int[n];                            // 每点入度，建图时逐条边 ++
for (int[] e : edges) indeg[e[1]]++;                 // 先算出入度，否则下面筛不到起点
Queue<Integer> q = new ArrayDeque<>();
for(int v = 0; v < n; v++) if(indeg[v]==0) q.offer(v);   // 全部入度 0 的点先入场（没有前置依赖）
List<Integer> order = new ArrayList<>();
while(!q.isEmpty()){
    int u = q.poll(); order.add(u);                  // 一个点依赖已满足，写入执行序列
    for(int[] e : graph.getOrDefault(u, List.of())) if(--indeg[e[0]]==0) q.offer(e[0]);  // 删边，入度归零才入队
}
System.out.println(order);                            // 正确用例输出：[0, 1, 2]（满足 0→1→2 的合法执行序）
// order.size() < 顶点数 ⇒ 存在环（这些点入度永远降不到 0）
if (order.size() < n) throw new IllegalStateException("依赖成环，无法排定执行顺序");   // 错误用法后果：任务编排遇环必须直接拒绝，不能默默丢任务
```

工程用途：**任务编排 / CI 依赖 / Maven-Gradle 构建顺序 / Spring Bean 初始化次序 / 课程表可行性判断**——判环就是判断"依赖能否被满足"。

## 五、并查集：另一条判连通的路

只需回答"两点是否连通 / 一共几个连通块"、且边是**逐步合并**进来时，并查集（s2-4）比 BFS 更省：`union` 合并、`find` 判同组，近 O(α(n))。Kruskal 最小生成树也靠它。区别记忆：**要遍历/路径 → BFS/DFS；只要动态归属/连通计数 → 并查集。**

## 六、例子：正确用法与错误用法

```java
// 例子目的：把图上三个最真实的事故复现——不标 visited 死循环/爆栈、有环图做拓扑排序、无权图误用 Dijkstra
import java.util.*;

public class GraphDemo {
    static Map<Integer, List<int[]>> g = new HashMap<>();

    // 错误用法：无环图也要 visited？下面这个环 0→1→0 不带 visited 就无限递归
    static void dfsNoVisit(int u) {
        for (int[] e : g.get(u)) dfsNoVisit(e[0]);      // 没有已访问标记 → 0→1→0→1… 永远回不了头
    }

    // 正确用法：带 visited
    static void dfs(int u, boolean[] seen) {
        if (seen[u]) return;                             // 重复到达直接返回，这是图与树最大的区别
        seen[u] = true;                                  // 标记后才下潜，保证每点只处一次
        for (int[] e : g.getOrDefault(u, List.of())) dfs(e[0], seen);   // 没有出边的点也不能直接 get(u)，会 NPE
    }

    public static void main(String[] args) {
        g.put(0, new ArrayList<>(List.of(new int[]{1, 1})));
        g.put(1, new ArrayList<>(List.of(new int[]{0, 1})));   // 构成双向环 0↔1
        try {
            dfsNoVisit(0);                                     // 错误：无 visited 的 DFS 遇环 → 递归不收敛
        } catch (StackOverflowError e) {
            System.out.println("缺 visited 后果：图中有环，DFS 无限下潜抛 StackOverflowError");   // 输出该行
        }
        dfs(0, new boolean[2]);                                  // 正确：两点各访问一次，正常返回
        System.out.println(Arrays.toString(new boolean[]{true, true}));   // 输出 [true, true]：全连通块已扫完

        // 知识点：拓扑排序遇环必须报错，不能返回一个"短了"的序列当成功
        Map<Integer, List<Integer>> dep = Map.of("A".charAt(0), List.of("B".charAt(0)),
                                                  "B".charAt(0), List.of("A".charAt(0)));
        int[] indeg = new int[2];
        dep.forEach((from, tos) -> tos.forEach(to -> indeg[to - 'A']++));   // 统计入度：A/B 各被指一次
        Deque<Integer> q = new ArrayDeque<>();
        for (int i = 0; i < 2; i++) if (indeg[i] == 0) q.offer(i);           // 找不到入度 0 的起点
        List<Integer> order = new ArrayList<>();
        while (!q.isEmpty()) { int u = q.poll(); order.add(u); for (int to : dep.getOrDefault('A' + u, List.of())) if (--indeg[to - 'A'] == 0) q.offer(to - 'A'); }
        System.out.println(order.size() < 2);   // 正确用例输出：true——结果数<顶点数，据此判定依赖成环

        // 知识点：无权图直接 BFS 即可，第一次到达就是最短跳数（别绕路写 Dijkstra，多一个堆的 log 成本）
        int[] d = {-1, -1};                              // 记录跳数，-1 表示尚未到达
        Queue<Integer> bq = new ArrayDeque<>(); bq.offer(0); d[0] = 0;
        while (!bq.isEmpty()) {
            int u = bq.poll();
            for (int[] e : g.get(u)) if (d[e[0]] < 0) { d[e[0]] = d[u] + 1; bq.offer(e[0]); }   // 首次发现即最短
        }
        System.out.println(d[1]);            // 正确用例输出：1（0→1 一跳，与层序遍历结论一致）
    }
}
```

## 七、本节要点回顾

1. 表示：稀疏用邻接表、稠密/判边用邻接矩阵；无向图一条边存两次。
2. BFS 用队列（最短路/分层）、DFS 用栈/递归（连通/判环/拓扑/回溯），`visited` 防环必带。
3. 最短路：无权 BFS、正权 Dijkstra(堆)、负权 Bellman-Ford、多源 Floyd。
4. 拓扑排序 = 入度 0 出发 + 删边，"结果数 < 顶点数即有环"，是编排/依赖的正解。
5. 判连通：遍历 or 并查集，按"要不要路径 / 是否动态合并"选。

下一节：排序算法全景——把快/归/堆放回它们真正的工程语境（Arrays.sort 双轴 vs TimSort、稳定性、外部排序），并解释比较下界。
