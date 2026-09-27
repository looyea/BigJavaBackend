# 实际面试题 · 连接池、Cluster/Sentinel 与异步/响应式 API

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。考"你们 Lettuce 配没配池、Cluster 客户端怎么处理、pipeline 怎么写"。

## 题 1：你们项目 Lettuce 用了连接池吗？为什么？

**期望时长**：60 秒

**答题要点**：

- 先讲默认：Lettuce 共享单连接（MUX）多数场景够用，池不是必需品；
- 我们是否开池的判据：有没有阻塞命令/事务会话、单连接 EventLoop 是否饱和、要不要链路隔离；
- 若配池：max-wait 必须设（借不到快速失败），并说明 MUX→POOL 是往 Jedis 模型回退，得有数据支撑。

**追问链**：Spring Boot 里怎么才算真开了池？→ `shareNativeConnection=false`（或事务/阻塞 API 触发），且 classpath 有 commons-pool2；否则 `lettuce.pool.*` 配了也可能是僵尸配置。

## 题 2：用 Lettuce 怎么实现 pipeline？和 Jedis 的 pipeline 有何区别？

**答题要点**：

- Lettuce：`async()` + `autoFlushCommands(false)` → 循环发命令攒队列 → `flushCommands()` → 统一 `get()`；同连接天然多路复用。
- Jedis：`Pipeline` 对象攒命令 + `sync()` 收全部响应——本质也是客户端批量，但要独占一条池连接。
- 语义提醒：pipeline 只是"批量发送减少 RTT"，命令间**可被其它客户端插入**，不保证原子性。

**追问链**：需要"一批命令原子执行"怎么办？→ 用 Lua 脚本或 MULTI/EXEC（且都得占专用连接/会话）；Lua 注意别在脚本里跑重循环，会阻塞单线程。

## 题 3：应用连的是 Redis Cluster，客户端要做哪些配置才健壮？

**答题要点**：

- 用 `RedisClusterClient` + 部分种子节点即可（自动发现全量拓扑）；
- 开 `validateTopologyOnRedirect` / adaptive refresh，failover/扩缩容后按 MOVED 触发秒级刷新；
- 命令层面守 Cluster 约束：多 key 操作要同槽（hash tag），跨槽 MGET/Lua/事务不可用；
- 超时+重试策略（超时勿配太长，让 MOVED 重试兜底）。

**追问链**：MOVED 和 ASK 客户端处理有何不同？→ MOVED：刷新槽表后按新归属重发（持久）；ASK：迁移中的临时转发，本次去目标试、不更新缓存（呼应 redis s1-2）。

## 题 4：sync / async / reactive 三套 API 怎么选？

**答题要点**：

- sync：常规业务、代码最简（内部仍是异步，只是帮你 block 等 Future）；
- async：需要 pipeline/批量编排（`CompletableFuture.allOf`）；
- reactive：全栈响应式（WebFlux/Gateway），返回 Mono/Flux，避免线程阻塞模型；
- 共同纪律：回调/操作符里不跑阻塞代码，重活切出 IO 线程（`publishOn` 到业务池）。

**追问链**：sync 既然内部是异步，为什么还要 async？→ sync 每次调用仍占用当前线程等结果，无法表达"多命令并行编排/流水线"，那是 async 的用武之地。

## 题 5：线上反馈"Redis 偶尔整体超时几秒后自己好了"，用 Lettuce 视角排查。

**答题要点**：

- 客户端：共享连接上是否有阻塞命令/大 key 序列化（连坐全应用，s1-1 经典坑）；回调有没有在 IO 线程跑重活。
- 网络/服务端：Cluster 是否刚 failover（拓扑未刷新期间重定向风暴）；Redis SLOWLOG 是否有大 O 命令（`KEYS`/大 `HGETALL`）。
- 系统：Lettuce 默认 `autoReconnect` 期间命令进有界缓冲，缓冲满则快速失败——看是否触顶。
- 取证：`ClientResources` 事件总线日志 + `LATENCY` + 服务端 slowlog 三方对齐时间线。

**追问链**：怎么预防？→ 大 key 治理（redis s2-3）、阻塞命令独立连接、adaptive 拓扑刷新常开、给命令设合理 timeout 而非无限等。
