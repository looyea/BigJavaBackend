# Reactor 模式：从单线程到主从多 Reactor · 课后作业

> 两题各 50 分：一题手写三代 Reactor 的骨架并对比吞吐，一题分析"一个 Channel 绑一个 EventLoop"的并发后果。

## 作业 1：手写"单 Reactor"并改造成"主从 Reactor"（50 分）

**要求**：
1. 用 JDK NIO（`Selector`+`ServerSocketChannel`）实现一个 **单 Reactor 单线程** echo：一个线程 `select()` → 分发 accept/read/write。压测记录 QPS/RT。
2. 保持"读+解码"在 Reactor 线程，但把"业务处理"（这里用一个 sleep 50 ms 模拟）投到**固定线程池**，改造成**单 Reactor 多线程**，再压测对比。
3. 再把 accept 拆到单独的 boss 线程、read/write 拆到 N 个 worker（各持一个 Selector），改造成**主从多 Reactor**，对比不同 worker 数（1/2/核数/2×核数）下的吞吐。
4. 画出你的三次改动分别消除了哪个瓶颈。

**验收标准**：
- 版本 1 在"业务耗时"时吞吐崩塌，并解释原因（IO 被业务阻塞）。
- 版本 2 业务不再拖垮 IO，但 accept/读写单线程在高连接下见顶。
- 版本 3 吞吐随 worker 数上升到核数附近后趋平/回落，能解释"超过核数为何不再涨甚至变差"。

**参考答案要点**：
- 演进主线：把"慢的"从"快的关键路径"上一步步剥离——先剥业务，再剥 accept/读写。
- worker 数最佳≈CPU 核数；超过后上下文切换与 epoll 空转成本上升，收益递减。
- Netty 用 `NioEventLoopGroup(boss)` + `NioEventLoopGroup(worker)` 把这三代固化成了 API。

## 作业 2：证明"EventLoop 串行化 = 免锁但怕慢 Handler"（50 分）

**要求**：
1. 在一个 Netty echo 服务里，给某 Channel 的 Handler 加一个"连接级计数字段"（如已收消息数），在 `channelRead` 里 `count++` 并打印。说明为什么这里**不需要 `AtomicInteger`/加锁**也线程安全。
2. 再在同一个 Handler 的 `channelRead` 里插入 `Thread.sleep(2000)`，用**另一个连接**发到同一 worker EventLoop（可把 worker 线程数设为 1 强制同线程），观察第二个连接的响应被拖慢。
3. 用 `ctx.executor().execute(...)` 或独立业务线程池把 sleep 挪出 EventLoop，复测第二个连接不再被卡。
4. 总结"单线程绑定的收益"与"它的代价及规避手段"。

**验收标准**：
- 正确解释串行化带来的无锁安全（同一 Channel 事件在同一线程按序跑）。
- 复现"一个慢 Handler 连累同 EventLoop 其它连接"，并给出"重活移出 IO 线程"的正解。
- 点明并行粒度是 EventLoop 数：想同时提升隔离度和吞吐，是加 worker 数 + 独立业务线程池。

**参考答案要点**：
- Netty Handler 默认运行在其 Channel 绑定的 EventLoop 上 → 单线程串行 → 无数据竞争。
- sleep 占住 EventLoop → 该线程负责的**所有**连接读写排队 → 表现为成批连接变慢（不是单个）。
- 对策：`ctx.executor()`（仍在该 Channel 的 EventLoop，仅异步化）vs 业务 `EventExecutorGroup`（真正换线程）区别要说清（s3-1）。
