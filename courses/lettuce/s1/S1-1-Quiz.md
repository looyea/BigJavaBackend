# 小测验 · Lettuce 架构与 Jedis 的本质差异

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. Jedis 实例不能多线程共享的根本原因是？（15分）

- A. Jedis 内部没有加锁的代码
- B. 它封装的是"一条 Socket 上的同步请求-响应"，多线程共用同一连接会让命令与响应在流上交错错配
- C. Jedis 不支持 Redis 新命令
- D. 连接池不允许共享

> 答案：B
> 解析：RESP 在同一 Socket 上严格一进一出配对；两线程同时写命令，读响应时无法区分归属——错的是"会话独占"模型本身，不是"忘了加 synchronized"。Lettuce 用协议层命令队列解决了配对问题。

### 2. Lettuce "单连接多线程共享"成立依赖的服务端前提是？（15分）

- A. Redis 支持多线程 IO
- B. Redis 单线程按序执行命令，同一连接的响应与请求严格同序
- C. Redis 开了 AOF
- D. 客户端用了 pipelining

> 答案：B
> 解析：正因服务端按 FIFO 处理并回包，客户端 CommandHandler 才能按序 pop 配对 Future——这就是"多路复用在协议层"的支点。

### 3. 【多选】哪些场景下 Lettuce 也应拆出专用连接（或改用池/POOL 模式）？（20分）

- A. 执行 BLPOP/BRPOP 等阻塞命令
- B. MULTI/EXEC 事务与 WATCH 乐观锁的会话期
- C. 普通 GET/SET 高并发读
- D. MONITOR 调试（响应流被持续占用）

> 答案：ABD
> 解析：阻塞命令/事务/监控都会"独占连接时序"，放到共享连接上会连累全部业务线程；C 恰是共享单连接的主场，无需拆。

### 4. 判断：用了 Lettuce 就完全不需要任何连接池，包括 Spring 的 LettuceConnectionFactory 高级 API。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：基础 API 下共享连接确实免池；但 Spring Data Redis 的**事务、阻塞操作、订阅**需要绑定独占连接，`LettuceConnectionFactory` 提供 MUX（默认共享）与 **POOL** 两种模式，此时 commons-pool2 仍有位置（见 s1-2）。

### 5. 填空题：Lettuce 的 IO 由 Netty ______ 驱动，异步回调默认运行在 IO 线程上，重逻辑应切到 `ClientResources` 的 ______ 或业务线程池；`ClientResources` 在一个应用里应当 ______（填"每个客户端各建"或"全局共享一份"）。（20分）

> 答案：EventLoopGroup / eventExecutorGroup（回调线程池）/ 全局共享一份

### 6. 为什么说"Spring Boot 2.x 默认从 Jedis 换成 Lettuce"是模型之争的必然？给出三点理由。（20分）

> 参考答案：
> - 连接成本：共享单连接把 TCP 连接数从 O(业务线程) 降到 O(1)，FD/内存/握手开销同步骤降，云原生多副本下更显著
> - API 形态：sync/async/reactive 三位一体，与 WebFlux 响应式栈天然同构（Jedis 只有同步）
> - 运维能力：Cluster 拓扑自动刷新、TLS、断线重连等现代特性在 Lettuce 上更完整
> - 补一句边界：代价是阻塞命令/事务需拆连接、回调线程纪律——不是免费午餐
