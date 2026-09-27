# 实际面试题 · Lettuce 架构与 Jedis 的本质差异

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。考"你们用 Jedis 还是 Lettuce、为什么、单连接怎么扛并发"。

## 题 1：Lettuce 和 Jedis 最本质的区别是什么？

**期望时长**：60 秒

**答题要点**：

- 并发模型代际差：Jedis = 一条 Socket 的同步阻塞封装，实例非线程安全，靠连接池"线程独占连接"撑并发；
- Lettuce = 基于 Netty 的异步非阻塞客户端，命令多路复用做在**协议层**，**一条连接线程安全可被多线程共享**。
- 结果：连接数从 O(业务线程) 降到 O(1)，且提供 sync/async/reactive 三形态 API。

**追问链**：为什么说 Jedis 非线程安全是"模型问题"不是"没加锁"？→ 同一 Socket 上多线程写命令、读响应会错配归属，加锁只是把它退化成串行独占，等于回到连接池模型——不如一开始就用异步配对。

## 题 2：Lettuce 单连接共享为什么不会让响应串？

**答题要点**：

- 依赖 Redis 单线程**按序处理、按序回包**，同一连接响应与请求严格同序。
- 客户端 `CommandHandler` 维护出站命令队列，写时入队、读时按序弹出配对 CompletableFuture——FIFO 即正确性保证。
- Netty pipeline 负责 RESP 编解码，IO 线程收发，业务线程在 Future 上等待。

**追问链**：这个前提什么时候被打破？→ 阻塞命令（BLPOP/MONITOR）、MULTI/EXEC、WATCH 会独占连接时序——必须拆专用连接或用 POOL 模式。

## 题 3：那 Lettuce 还需要连接池吗？

**答题要点**：

- 基础 API：一般不需要，共享连接即可；
- Spring Data Redis 高级 API：事务/阻塞/订阅需绑定独占连接，`LettuceConnectionFactory` 提供 MUX（默认共享）与 POOL 两种，后者才引入 commons-pool2。
- 高并发下也可选择性用池分摊单连接 IO 线程压力（多 EventLoop）。

**追问链**：`ClientResources` 要注意什么？→ 全局共享一份（含 EventLoopGroup、buffer 池），每个 RedisClient 各建会导致 Netty 线程数×实例数爆炸；回调重活放 eventExecutorGroup，别堵 IO 线程。

## 题 4：线上 Jedis 报 `Could not get a resource from the pool`，怎么排查？

**答题要点**：

- 三类根因：① 池配置 maxTotal/maxWaitToo 小、并发高；② 连接被慢命令/大 key 长期占用未还；③ 代码漏 close（异常路径）致泄漏。
- 排查：池监控（active/idle/waiters）、`ss -tnp` 看真实连接、慢日志、审 try-with-resources。
- 治本：调池+超时、修复泄漏，或迁移到 Lettuce 共享连接模型根除借还事故。

**追问链**：Jedis 的 close 是关闭连接吗？→ 归还给池（`returnResource` 语义），不是真正关 Socket；所以"忘了 close"=池里可用连接越来越少，是慢性泄漏。

## 题 5：为什么 Spring Boot 2.x 把默认客户端从 Jedis 换成 Lettuce？

**答题要点**：

- 连接经济：云原生多副本下，共享连接大幅削减 TCP/FD/内存开销。
- 栈匹配：WebFlux/响应式兴起，Lettuce 的 reactive API 与 Netty 同构，Jedis 只有同步。
- 现代特性：Cluster 拓扑自动刷新、TLS、断线自动重连更完善。

**追问链**：换 Lettuce 后就高枕无忧？→ 换来的是新纪律：阻塞命令拆连接、回调别在 IO 线程、ClientResources 共享——用错照样全应用超时；且极少数依赖 Jedis 特定行为的老代码要回归测试。
