# EventLoop 线程模型、Future/Promise 与优雅关闭 · 面试题

> 这组题筛"真用 Netty 上过生产"的人：线程模型一问便知深浅，`sync()` 死锁、优雅关闭丢包是最常见的实战伤疤。

## 考点 1：EventLoop 内部结构

**起手**：一个 EventLoop 里有什么？它怎么调度 IO 和任务？

**期望**：
- 1 EventLoop = 1 线程 + 1 Selector + taskQueue + scheduledTaskQueue。
- 每轮：select → processSelectedKeys（IO）→ runAllTasks（**有任务数/时间配额**，防止普通任务饿死 IO）。
- Channel 终身绑一个 EventLoop（s1-2/s2-1）。

**追问链**：
1. `execute()` 会新开线程吗？→ 不。它保证"在该 EventLoop 线程执行"（`inEventLoop` 直接 run 否则入队），是调度不是并行。

## 考点 2：重活隔离（工程必考）

**起手**：handler 里要调 RPC（阻塞 5 ms），怎么办？

**期望**：
- 直接调 → 占住 EventLoop，连累同组所有 Channel（一线程多连接）。
- 隔离：`addLast(new DefaultEventExecutorGroup(n), handler)` 或自建业务池 submit；写完 `ctx.writeAndFlush` 由 Netty 自动切回 EventLoop，免手写同步。
- 或全异步：异步客户端 + `addListener` 回调，压根不阻塞。
- 澄清：`ctx.executor()` 仍是 EventLoop 线程，**不能**隔离阻塞。

**追问链**：
1. 业务线程能直接改 Channel 的共享状态吗？→ 别；要么 `execute` 回 EventLoop，要么保证线程安全。写操作交给 Netty 切回即可。

## 考点 3：Future/Promise 与 sync 死锁

**起手**：`writeAndFlush(...).sync()` 有什么风险？

**期望**：
- 在 **EventLoop 线程内** 调 `sync()/await()` → 等待完成的正是当前线程的事件循环 → **自锁死**；Netty 有"blocking the event loop"检测抛异常。
- 正解：`addListener((ChannelFuture f)->{ if(!f.isSuccess()) f.channel().close(); })`。
- main 启动期 `bind().sync()` 不在 EventLoop 线程，安全。
- Promise 是 future 的可写端（`trySuccess/tryFailure`），用于自写异步/桥接回调，`PromiseCombiner` 聚合。

**追问链**：
1. addListener 回调在哪个线程？→ future 已完成则当前线程，否则该 Channel 的 EventLoop。重活仍需再投业务池。

## 考点 4：优雅关闭（发布必考）

**起手**：Netty 服务怎么做到"发布不丢请求"？

**期望**：
- **先摘流量**（LB/注册中心置 not-ready，呼应 networks/s2-2）→ `bossGroup.shutdownGracefully()` 停 accept → 处理完 in-flight → `workerGroup.shutdownGracefully(quietPeriod, timeout)` → `await` → 关业务线程池。
- quietPeriod：这段时间无新任务就提前结束；timeout：强制上限。**设 0 会砍掉正在处理的请求**。
- 关键认知：**关 EventLoopGroup 不自动关已建立连接**，长连接要自己回"最后一帧/GOAWAY"再 `channel.close()`。

**追问链**：
1. 为什么每次发布总有几百 `Connection reset`？→ 没先摘流量就关进程，LB 仍打流量 / in-flight 被砍 / 未 drain。

## 考点 5：定时任务精度 + ChannelGroup（收尾加分）

**期望**：
- EventLoop `schedule` 复用其定时队列，**IO 忙时任务延后** → "尽力而为、不早于设定时间"，非硬实时；海量/精度敏感用 `HashedWheelTimer`（时间轮 O(1)，但注意其线程里别再阻塞）。空闲检测（s3-2）阈值要留最坏延迟余量。
- `ChannelGroup`（`DefaultChannelGroup`）做 1 写 N 广播，按 EventLoop 分桶并发、断连自动摘除；百万连接广播要防**背压**（`isWritable`）与 fd/内存上限。
- 全景串线：s1（模型）→ s2（抽象/内存/编解码）→ s3（线程/优雅关闭/背压/实战）即"Netty 从能用到用好"。
