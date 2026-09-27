# Reactor 模式：从单线程到主从多 Reactor · 讲义

> 上一节（s1-1）我们得到结论：高并发网络的事实标准是"IO 多路复用（epoll）"。但多路复用只解决"**一个线程怎么同时盯很多 fd**"，它把"谁就绪了"告诉你之后，**接下来谁来 accept、谁来读、谁来算、谁来写、怎么编排这些角色** —— 这就是本节 Reactor 要回答的。Reactor 是 Netty、Redis、Nginx、Node.js、gRPC 共同的线程骨架。（重要度 4/5，重点标准）

## 一、一句话定义：Reactor = 事件分发器

**Reactor（反应堆）模式的核心**：用**一个（或少量）线程**跑 IO 多路复用循环，专门"等待就绪事件 → 分发给对应处理器"；把"**非阻塞地读写网络**"和"**耗时的业务处理**"分开。

三个角色先记牢，后面所有变体都是围绕这三者的排布：

| 角色 | 干什么 | 关键点 |
|---|---|---|
| **Reactor** | `epoll_wait` 等事件，把事件 dispatch 给 Handler | 不碰业务，纯分发 |
| **Acceptor** | 处理 OP_ACCEPT，建立连接、注册读事件 | 是 Handler 的一种（专门管新连接） |
| **Handler** | 处理 OP_READ/OP_WRITE，编解码 | **不能在这里做耗时操作**，否则卡住整个 Reactor |

> 反面模式：**在 Handler 里同步查数据库 / 调下游 RPC** → 这一个 EventLoop 上所有其它连接全被拖死。Reactor 的铁律是"IO 线程绝不阻塞"，重活必须丢给业务线程池（s3-1）。

## 二、Reactor vs Proactor：谁做数据拷贝

回到 s1-1 的两阶段（等就绪 / 拷贝）。两种模式的分界正在这里：

- **Reactor**：Reactor 只负责"**fd 就绪了，你来读**"。真正的 `read`/`write`（数据从内核拷到用户）**由 Handler 自己同步做** —— 所以 Reactor 配的是**同步非阻塞**（多路复用）。
- **Proactor**：底层（AIO）直接把数据**拷贝完**了，再告诉你"读好了，数据在缓冲区里你直接用"。发起 IO 的是框架，完成时回调 —— 配的是**真异步（AIO）**。

**为什么现实中 Reactor 是主流、Proactor 少见？** 因为 Linux 网络 AIO 不成熟（s1-1 讲透），拿不到"内核帮你拷完再通知"的语义，于是大家退回到"多路复用 + Reactor"。**Netty 名义上两种 transport 都有，但生产用的 epoll/NIO transport 本质是 Reactor。**

## 三、三代 Reactor：单线程 → 线程池 → 主从多 Reactor

### 版本 1：单 Reactor 单线程

```
        ┌──────────────── 一个线程 ────────────────┐
客户端 ─▶│ Reactor(epoll_wait) ─┬─▶ Acceptor(accept) │
        │                      └─▶ Handler(read/decode/【业务】/write) │
        └──────────────────────────────────────────┘
```
- 全部塞在一个线程：accept、read、业务处理、write 都串行。
- 优点：无线程安全负担、无上下文切换、最好写。**Redis 就是这套**（单线程命令处理 + 多路复用）—— 因为它的"业务"是内存操作，够快，不需要并行。
- 缺点：**一旦业务耗时，全服务器卡住**；无法利用多核做计算。

### 版本 2：单 Reactor 多线程（把业务挪出去）

```
客户端 ─▶ Reactor(1 线程) ─▶ Acceptor / Handler(read+decode)
                                 │ 把"解码后的任务"投递
                                 ▼
                          业务线程池(Worker Group) ── 算完 ──▶ 回 Reactor 写
```
- Reactor 线程只做"读 + 解码"，把**已解码的请求**丢进线程池跑业务，业务结果再交回 Reactor 线程写出。
- 解决了"业务阻塞拖垮 IO"。但 **accept + 所有连接的 read/write 仍挤在一个 Reactor 线程** → 连接数一高，这个单点 Reactor 本身成为瓶颈（"accept 瓶颈"、"一个线程搬运所有 fd"）。

### 版本 3：主从 Reactor 多线程（Netty 的模型）★

```
                 ┌────────────  主 Reactor (boss group)  ───────────┐
 客户端 connect ─▶│  只干一件事：Acceptor accept 新连接               │
                 └───────────────────────┬──────────────────────────┘
                                 把已建立的 Channel 注册到 ↓（轮询/取模选一个）
        ┌──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
   从 Reactor#1     从 Reactor#2   从 Reactor#3  ... 从 Reactor#N   (worker group)
   (独立 epoll +    各自负责一批   连接：read/decode/【投递业务线程池】/write)
```
- **主 Reactor（boss）**：只负责 **accept**，accept 完把连接**分配**给某个从 Reactor。
- **从 Reactor（worker）**：每个是**独立线程 + 独立 epoll**，各自维护一批连接，负责这些连接的读写与编解码。
- 一把 `accept` 的活被拆到 1 个 boss，海量 read/write 被均摊到 N 个 worker → **既消除了 accept 单点，又用满了多核**。这正是 Netty `NioEventLoopGroup(1)` 作 boss、`new NioEventLoopGroup()`（默认 2×核数）作 worker 的经典 `ServerBootstrap` 写法（s2-1、s3-1）。

> Redis 6.0 之后也引入**多线程 IO**（多个 io thread 并行做 read/write 的 syscall），但**命令执行仍是单线程** —— 相当于"版本 2 的 IO 并行化"，印证了"Reactor 变体是按需演进、不必一步到位"。

## 四、铁律：为什么"一个 Channel 只绑一个 EventLoop"

主从模型里有个关键约束：**一个连接（Channel）一旦被分配给某个从 Reactor（EventLoop），它整个生命周期都只由这一个线程处理读、解码、编码、写。** 这不是实现偷懒，而是**有意的设计**，理由三条：

1. **无锁串行化**：同一 Channel 的所有事件在单线程里按序执行 → 你在一个 Handler 里改共享状态（如某连接的编解码中间态、会话对象）**天然线程安全，不用加锁**。加锁会让高并发下争用爆表。
2. **避免乱序**：如果 read 在 A 线程、write 在 B 线程，两个方向的数据处理就可能交错，字节流的定界/状态机（s2-3）会错乱。
3. **缓存亲和**：连接的缓冲区始终被同一线程触碰，CPU cache/TLB 命中更高。

代价与对策：
- **一个慢 Handler 会连累同 EventLoop 上的所有其它连接**（它们共用一个线程）→ 再次强调"IO 线程不碰重活"，重活 `channel.eventLoop().parent()` 之外交给业务线程池（s3-1 的 `DefaultEventExecutorGroup`）。
- **不同 Channel 之间才并行**：并行的粒度是"EventLoop 数"，不是"连接数"。想提并行度就调 worker 线程数，而不是给单连接开线程。

> 记住这句对照：**"线程数由 EventLoopGroup 决定、与连接数解耦；连接数由 fd/内存决定、可以百万"。** 这就是 Reactor 相对 BIO"一连接一线程"（s1-1 作业 1）的根本胜利。

## 五、三大行业场景钩子

- **电商**：营销/交易网关用 Netty 做前端长连接接入 —— 就是主从 Reactor：boss group accept，几十个 worker EventLoop 均摊数万客户端连接；下单逻辑投递到业务线程池，绝不在 EventLoop 里同步调库存服务（否则一次慢 RPC 拖垮一整批连接）。
- **金融**：行情推送服务器"1 写 N 读"百万订阅连接，靠 worker group 多 EventLoop 分摊写；对**撮合**这种强顺序、CPU 敏感的计算，反而常回到"单 Reactor 单线程 + 无锁队列"（类 Disruptor）保序，与 Redis 单线程同理 —— 选型看"要不要并行"。
- **电力**：主站对百万终端的 TCP 接入，单机 Netty 主从 Reactor 扛连接 + 前置多台做水平拆分；EventLoop 数按核数设，避免"worker 比核多"反而增加切换。

## 六、要点回顾

1. Reactor = **事件分发器**三角色（Reactor/Acceptor/Handler）；铁律"**IO 线程绝不阻塞**"，重活走业务线程池。
2. **Reactor 配同步非阻塞（多路复用）、Proactor 配真异步（AIO）**；因 Linux 网络 AIO 不成熟，现实主流是 Reactor。
3. 三代演进：**单线程（Redis）→ 单 Reactor 多线程（拆出业务）→ 主从多 Reactor（Netty，拆 accept 与读写、消单点 + 用多核）**。
4. **一个 Channel 终身绑一个 EventLoop** → 无锁串行化 + 保序 + 缓存亲和；代价是"慢 Handler 连累同僚"。
5. 并行粒度 = **EventLoop 数**，不是连接数；连接数靠 fd/内存撑到百万，与线程数解耦。
