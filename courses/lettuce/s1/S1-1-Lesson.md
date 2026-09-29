# Lettuce 架构与 Jedis 的本质差异

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：从 IO 模型层面讲透两大客户端的分水岭——**Jedis 是"一个连接=一条 Socket 的同步阻塞封装"**，类非线程安全，多线程必须靠连接池各借各的；**Lettuce 构建在 Netty 之上（呼应 netty 包）**，RESP 协议编解码全异步，**单条连接可被多线程安全共享**（命令多路复用+流水线），连接池反而只是特定场景的补充。理解"共享单连接"为什么成立（Redis 单线程按序处理、响应与请求同序）、它在什么场景失效（阻塞命令/事务/MUX vs POOL），并据此解释 Spring Boot 2.x 起默认 Lettuce 的原因。

## 一、两条技术路线的分野（★★★★☆）

| 维度 | Jedis | Lettuce |
| --- | --- | --- |
| 底层 IO | 裸 Socket + 同步阻塞（BIO） | **Netty 异步非阻塞**（NIO/epoll） |
| 客户端类线程安全 | **不安全**（Connection 被多线程共用会串响应） | `StatefulRedisConnection`/`RedisCommands` **线程安全** |
| 并发模型 | 线程↔连接 1:1，靠 `JedisPool` 撑并发 | 多线程共享单连接，命令流水线上线 |
| 同步/异步/响应式 | 只有同步（异步靠自己加线程） | 一套 API 三形态：sync / async / reactive |
| 集群拓扑支持 | 较新客户端也支持，但历史包袱多 | 原生 `RedisClusterClient`+自适应拓扑刷新 |
| 典型故障 | 池耗尽 `Could not get a resource from the pool` | 误在共享连接上跑阻塞命令连累全部 |

```java
// 例子目的：同一份并发压测在两种客户端下的连接用量差异（概念对比代码）
// Jedis：100 个工作线程 → 连接池必须配到 ~100，每个线程 borrow→命令→return
try (Jedis jedis = jedisPool.getResource()) {        // 借连接：池空则阻塞直到 maxWait 超时抛异常（错误用法：池 10 配 200 并发 → JedisExhaustedPoolException 雪崩式超时）
    jedis.get("k");                                  // 该连接同一时刻只服务一个线程：RESP 请求-响应在 Socket 上严格串行
}                                                    // 归还连接（正确：try-with-resources 必还，漏还=池泄漏）
// Lettuce：100 个工作线程共用 1 条连接
RedisCommands<String, String> cmd = sharedConn.sync(); // sync() 只是给"共享线程安全代理"，内部仍是 Netty 异步写+当前线程等 Future（正确使用结果：1 条 TCP 连接吃下全部并发，命令在管道里排队，Redis 单线程按序回包）
cmd.get("k");                                        // 多线程各拿各的响应，靠"请求-响应同序"配对，不会串
// 结论：高并发短命令场景，Lettuce 用 1/N 的连接数达到同等吞吐——这正是 Spring Boot 2.x 把它设为默认的原因
```

## 二、共享单连接为什么成立（★★★★☆，面试深水区）

三个前提缺一不可：

1. **Redis 服务端单线程**执行命令、**同一连接上的响应与请求严格同序**——客户端只要按 FIFO 配对请求与响应即可（netty 包里的"无锁串行化"在服务端的镜像）。
2. Lettuce 在 Netty pipeline 里做 **RESP 编解码 + `CommandHandler` 队列**：写侧把命令挂入出站队列，读侧按序 pop 对应 Future——多路复用发生在**协议层**而非连接层。
3. 失败重连、断线期间命令进**有界缓冲**（可配），避免瞬时抖动全量报错。

**失配场景**（共享连接帮不上忙，要拆连接）：`BLPOP`/`MONITOR` 等**阻塞命令**会占住整条连接的响应序（后面的命令全等它）；`MULTI/EXEC` 事务期间该连接被独占；`WATCH` 乐观事务语义要求会话隔离——这些要么走专用连接，要么直接改用 `Redisson` 的事务对象。

## 三、线程模型：Netty EventLoop 的正确姿势（★★★☆☆）

- Lettuce 的 IO 由 Netty `EventLoopGroup` 驱动（默认 2×CPU 线程数，`ClientResources` 可全局共享）；**业务线程调用 sync API 时并不干等 IO**——它 block 在响应 Future 上，IO 线程收发与编解码。
- 异步/响应式 API 时回调默认也在 **IO 线程**执行：重逻辑必须 `thenRunAsync(..., bizExecutor)` 切走（netty s3-1 的"不要在 EventLoop 里干活"同款纪律）。
- `ClientResources.eventExecutorGroup` 就是给回调准备的线程池，全局共享一份，避免每个客户端实例各建一套。

```java
// 例子目的：全局共享 ClientResources + 单连接复用的标准建法
ClientResources res = ClientResources.builder()          // 一个应用一份（正确：内含 EventLoop/缓冲池，每客户端各建=线程数失控）
        .eventExecutorGroup(DefaultEventExecutorGroup.create(8))  // 回调线程池：异步链路的重活放这里（错误用法：不设，在 IO 线程里反序列化大对象 → 拖慢全部连接的读写）
        .build();
RedisClient client = RedisClient.create(res, RedisURI.builder().with(host, 6379).withTimeout(Duration.ofMillis(200)).build());
StatefulRedisConnection<String, String> conn = client.connect();   // 一条连接，应用启动时建好、全局共用（正确：无需池！断线自动重连由 Lettuce 负责）
conn.sync().set("k", "v");                               // 任意业务线程直接调用，线程安全
// 正确使用结果：连接数从"线程数"降维到"个位数"，文件描述符与 TCP 缓冲内存同步锐减
// 错误用法：把 BLPOP 放到这条共享连接上 → 阻塞期间所有线程的普通 GET 排队等它，全应用超时（阻塞命令必须专用连接或 POOL 模式）
```

## 四、动手题

1. 同机分别用 JedisPool(maxTotal=N) 与 Lettuce 单连接做 200 线程 GET 压测，记录两端**TCP 连接数**（`ss -tnp`）与 P99。
2. 在 Lettuce 共享连接上执行 `blpop`（超时 10s），期间并发跑 GET，观察排队效应；再为阻塞命令拆专用连接复测。
3. 把回调重活（50ms 睡眠）分别放在默认线程与 eventExecutorGroup 上，用 `LATENCY` 观测共享连接的吞吐差异。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| Jedis：`Could not get a resource from the pool` | 池太小/连接被慢命令长期占用/漏 close 泄漏 |
| Lettuce：偶发全部命令超时后恢复 | 共享连接上跑了阻塞命令或大 key 序列化 |
| Lettuce 频繁重连报错（LettuceConnectionFactory） | 6.2 前默认 `autoReconnect` 与 Redis 空闲断连竞态，升级或配 `CancelServerKeepAlive` 类参数 |
| 回调里再调 Redis 造成死锁感 | 在 IO 线程回调里同步等同连接响应（单线程模型的坑，同 netty s3-1） |
| 每个 @Bean 各 new RedisClient | ClientResources 未共享，Netty 线程组×实例数爆炸 |

## 六、关联技术栈

- **向前**：Netty EventLoop/流水线/背压 ↔ netty s1~s3；RESP 协议 ↔ networks 应用层
- **向后**：连接池、Cluster 支持细节 ↔ s1-2；与 Redisson 分工 ↔ s1-3
- **横向**：Redis 单线程按序处理 ↔ redis s1；高并发连接数与 FD 治理 ↔ 高并发专区

## 七、本节小结

Jedis 与 Lettuce 的本质差异是**并发模型代际差**：Jedis 把 Socket 直白封装成"线程独占连接"，并发=池里连接数，简单直观但连接昂贵；Lettuce 借 Netty 把**多路复用做进协议层**——`CommandHandler` 队列按"请求-响应同序"配对，让**一条线程安全的连接被任意多线程共享**，连接数从 O(线程) 降到 O(1)。代价是要守住三条纪律：阻塞命令与事务拆专用连接、回调重活切出 IO 线程、ClientResources 全局共享。Spring Boot 2.x 默认 Lettuce 正是这套模型之争的终局注脚——下一节看连接池到底还需不需要、Cluster/Sentinel 与异步响应式 API 怎么开。
