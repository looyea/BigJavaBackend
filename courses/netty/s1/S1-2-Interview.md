# Reactor 模式：从单线程到主从多 Reactor · 面试题

> Reactor 是"IO 模型"往上一层的必考话题：面试官用它筛你是"只背过 epoll"还是"真懂线程怎么编排"。答好要能画出三代模型、说清每代解决了什么、并落到 Netty 的 boss/worker。

## 考点 1：Reactor 是什么、和 IO 模型什么关系

**起手**：多路复用讲完了，Reactor 又是什么？

**期望**：
- 多路复用只回答"一个线程怎么同时等很多 fd"；Reactor 回答"**就绪之后谁来 accept/读/算/写、怎么编排**"。
- 三角色：Reactor（`epoll_wait`+分发）、Acceptor（处理新连接）、Handler（读写+编解码）。铁律：**IO 线程绝不阻塞**。

**追问链**：
1. Reactor vs Proactor？→ Reactor 由 Handler 自己同步读写（配同步非阻塞/多路复用）；Proactor 由底层 AIO 拷完再回调（配真异步）。Linux 网络 AIO 不成熟 → 现实主流是 Reactor。

## 考点 2：三代模型演进（画图题）

**起手**：从单线程 Reactor 讲到你熟悉 Netty 的多 Reactor，每一步为什么改？

**期望**：
1. **单 Reactor 单线程**：accept+read+业务+write 全串行。好写无锁，但业务一慢全服卡、用不上多核。→ Redis 属这类（内存操作快）。
2. **单 Reactor 多线程**：把解码后的**业务**丢 Worker 线程池，Reactor 只做 IO。解决"业务拖垮 IO"，但 accept+读写仍单线程 → 高并发下 Reactor 成瓶颈。
3. **主从多 Reactor**：**boss 专职 accept**，把连接轮询分给**多个 worker（各独立线程+epoll）**分摊读写。消除 accept 单点 + 用满多核。→ Netty。

**追问链**：
1. worker 线程数怎么定？→ 约 CPU 核数（Netty 默认 2×核数）；过多反而增切换、epoll 空转。
2. boss 要不要多个？→ 一般 1 个够，accept 很轻；除非新建连接速率极端，可用 SO_REUSEPORT 多进程（networks/s4-1）。

## 考点 3："一个 Channel 绑一个 EventLoop"（高频深问）

**起手**：Netty 里一个连接能用几个线程处理？为什么这么设计？

**期望**：
- **一个 Channel 全生命周期只绑一个 EventLoop 线程**。三大收益：① 同 Channel 事件串行 → 改其状态**无锁即线程安全**；② 保证字节流处理**顺序**（编解码状态机不乱）；③ 缓存亲和。
- 并行发生在 **Channel 之间（不同 EventLoop）**，不是单 Channel 内部。

**追问链**：
1. 那一个 Handler 里 sleep/同步 RPC 会怎样？→ 连累**同一 EventLoop 上的所有其它连接**一起卡 —— 这就是"IO 线程不碰重活"的原因。
2. 重活怎么正确地挪出去？→ 投递业务线程池；处理完要回写 Channel 时，Netty 会自动把写任务切回该 Channel 的 EventLoop（保证串行），无需你手动同步。
3. 想给单个超连接业务提并行怎么办？→ 单 Channel 不能多 IO 线程；要么优化该业务、要么拆成多连接。

## 考点 4：横向对比与选型（架构视野收尾）

**期望**：
- **Redis**：单 Reactor 单线程执行命令（6.0 加多线程仅并行化 IO syscall，执行仍单线程，保序且免锁）。
- **Nginx**：多进程 + 每进程单 Reactor（epoll ET），进程间用共享内存/accept mutex 协调。
- **Netty**：主从多 Reactor，boss/worker 两组 EventLoopGroup。
- **Node.js**：libuv 单线程 Reactor（事件循环）+ 线程池兜底文件/DNS。
- 选型直觉：**要并行计算** → 多 Reactor（Netty）；**强顺序/纯内存快操作** → 单线程 Reactor 反而更简单高效（Redis、撮合）。别为了多核硬上并行把无锁串行化的好处丢了。
