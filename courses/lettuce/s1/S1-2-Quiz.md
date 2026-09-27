# 小测验 · 连接池、Cluster/Sentinel 与异步/响应式 API

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. Lettuce 获得 pipeline 收益（1000 个 GET 约 1 次 RTT）的正确操作序列是？（15分）

- A. sync API 循环 get，JIT 会自动合并
- B. `async()` 后 `autoFlushCommands(false)` → 循环发命令攒队列 → `flushCommands()` 一次写出 → 统一收 Future
- C. `reactive()` 直接 for 循环订阅
- D. 把命令拼成一个字符串一次发送

> 答案：B
> 解析：默认 autoFlush=true 时每条命令立即发出，逐条等 Future 等于没有流水线；关刷写攒批再 flush 才是 pipeline 三件套。D 违反 RESP 协议。

### 2. Cluster 发生主从 failover 后，Lettuce 客户端长时间仍连旧主报错，首查什么？（15分）

- A. Redis 密码是否变更
- B. 是否开启 `validateTopologyOnRedirect` / adaptive refresh——槽表过期时靠 MOVED 触发后台刷新
- C. JDK 版本
- D. 连接池 max-active

> 答案：B
> 解析：客户端本地缓存槽表，默认周期刷新（60s）跟不上 failover；开按重定向触发的自适应刷新可秒级收敛。与池无关（Cluster 模式走 RedisClusterClient 连接管理）。

### 3. 【多选】哪些是"给 Lettuce 启用连接池/多连接"的正当理由？（20分）

- A. 单条连接的 Netty EventLoop 读写已饱和（万级 QPS 短命令）
- B. 业务里有 BLPOP 等阻塞命令与 MULTI 事务会话
- C. 听说池能提升性能，先配上再说
- D. 核心链路与跑批任务要做连接级隔离

> 答案：ABD
> 解析：C 是典型反模式——MUX 够用时加池反而引入借还开销与排队风险（且把连接经济优势退回 Jedis 模型）。A/B/D 都有明确的技术动因，且配池必须设 max-wait 快速失败。

### 4. 判断：Sentinel 部署下，Lettuce 需要在应用里自研"监听主库切换并重建连接"的代码。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：`RedisURI.withSentinel(...).withSentinelMasterId("mymaster")` 即可——客户端订阅哨兵的 `+switch-master` 频道自动跟随新主，无需自研。

### 5. 填空题：三套 API 中，返回 `RedisFuture`(CompletableFuture) 的是 ______，返回 `Mono/Flux` 的是 ______；Spring Boot 配 `spring.data.redis.lettuce.pool.max-wait=200ms` 的作用是 ______。（20分）

> 答案：async / reactive / 借连接最多等 200ms，超时抛异常快速失败（防池满时无限排队）

### 6. 说出两种"pipeline、MGET、Lua"都能做的批量场景里你的选择与理由。（20分）

> 参考答案：
> - 纯读多 key（同槽）：优先 MGET——单命令原子完成、无客户端攒批纪律要求；跨槽 Cluster 则按槽分组各自 MGET
> - 读改写带逻辑（如扣减+判断）：Lua——服务端原子执行，避免 pipeline 中间态被并发插入（pipeline 命令间可被别的客户端插入）
> - 大量互相独立的一次性命令（无原子性需求、键分布广）：async pipeline，攒批 flush
> - 收口：三者都是"减 RTT"，但原子性语义不同——pipeline≠事务≠Lua 原子块
