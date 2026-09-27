# EventLoop 线程模型、Future/Promise 与优雅关闭 · 讲义

> s1-2 立了"IO 线程绝不阻塞"的规矩，s2-1 讲了 Handler 默认跑在 Channel 的 EventLoop 上。本节把这套**线程模型**彻底讲透：无锁串行化到底赚了什么、`execute/inEventLoop` 的调度语义、`Future/Promise` 怎么"不阻塞地拿异步结果"、`ChannelGroup` 怎么跨线程广播，以及生产发布必踩的**优雅关闭** `shutdownGracefully`。最后点一下定时任务在 EventLoop 上的精度问题。（重要度 4/5，重点标准）

## 一、EventLoop 到底是什么

一个 `EventLoop` = **一个线程 + 一个 Selector + 一个任务队列（`taskQueue`）+ 一个定时任务队列（`scheduledTaskQueue`）**。它的 `run()` 死循环每轮干三件事：

```
for (;;) {
    int readyKeys = select(timeout);          // ① IO：epoll_wait（s1-1）
    if (readyKeys > 0) processSelectedKeys(); // ② 处理就绪 Channel（读→fireChannelRead、写）
    runAllTasks(ioDeadlineNanos);             // ③ 执行 taskQueue 里投递来的普通/定时任务（有配额、防饿死 IO）
}
```
- **IO 任务优先于普通任务**：`runAllTasks` 每轮有上限（如 64 个任务或到 deadline）就回去 `select`，防止你堆太多 `execute` 任务把网络事件饿死 —— 理解这点才明白"重活为什么该去独立线程池而不是 EventLoop 队列"。
- `EventLoopGroup` 是 N 个 EventLoop 的数组；新 Channel 通过 `childExecutorFactory`/取模**绑到其中一个，终身不变**（s1-2、s2-1）。

## 二、无锁串行化：赚了什么、陷阱在哪

**赚**（同 Channel 单线程串行的红利）：
1. Handler 里改 Channel 级状态**免锁**（s2-1）。
2. 事件严格有序，字节流状态机不会乱。
3. 无跨线程上下文切换、缓存亲和。

**陷阱**：
- **一个 EventLoop 上跑太久 = 饿死同组其它 Channel**（它们共享这一个线程）。所以慢任务要么去业务线程池，要么切分。
- **`execute()` 不总是新开线程**：语义是"**确保在**该 EventLoop 线程上执行"——

```java
// 例子目的：展示 execute() 的真实语义——"调度到该 EventLoop 跑"而非"新开线程并行"
if (eventLoop.inEventLoop()) {   // 已经在目标线程 → 直接 run，不入队
    runAddTask(task);
} else {
    taskQueue.add(task);          // 不在 → 投到该 EventLoop 队列，由其线程稍后跑
}
// 正确使用结果：任务无论来自哪个线程，最终都在这一个 EventLoop 线程串行执行（无锁保序）
// 错误用法：误以为 ctx.executor().execute(阻塞活) 能把重活挑离 IO 线程 → 它仍在 EventLoop 跑，照样卡死同组所有连接
```
`inEventLoop()` 还有带 `threadType` 的重载，配合 `DefaultEventExecutorGroup` 判断"是不是那个业务线程"。搞清楚"**execute 是把任务调度到 EventLoop，而不是并行化**"，就不会误以为 `ctx.executor().execute` 能把重活挪走（它挪不开，s2-1 已强调）。

## 三、重活分离：EventLoopGroup vs DefaultEventExecutorGroup

两种"换线程"要分清：

| 手段 | 线程归属 | 用途 |
|---|---|---|
| `pipeline.addLast(bizGroup, handler)`（bizGroup=`DefaultEventExecutorGroup`） | 该 handler 方法在 **biz 线程**跑 | 让**特定 handler** 阻塞式重活不占 IO 线程 |
| `channel.eventLoop().execute(task)` / `ctx.executor().execute` | 仍在 **该 Channel 的 EventLoop** | 只是异步化/序列化到 EventLoop，**不逃离阻塞** |
| 自建 `ExecutorService`（业务线程池）+ 回调里 `ctx.write` | 业务线程执行，**写回自动切 EventLoop** | 通用重活隔离 |

**规范姿势**（s2-1 作业实验过）：读/解码/编码/写这些**轻**的留在 EventLoop；调 RPC/DB、大计算、加解密大块等**重**的放业务 `EventExecutorGroup` 或线程池；跨线程写完由 Netty 自动切回 EventLoop，你**不用手写同步**，但**别在业务线程直接操作 Channel 的非线程安全状态**。

## 四、Future / Promise：不阻塞地拿异步结果

Netty 所有异步操作（`connect/bind/write/read/close`）返回 **`ChannelFuture`**（`Future<Void>` 的增强）。**绝不要 `sync()`/`await()` 阻塞 EventLoop**，用监听器：

```java
// 例子目的：用 addListener 回调拿异步写结果，绝不阻塞 EventLoop
channel.writeAndFlush(msg).addListener((ChannelFuture f) -> {
    if (f.isSuccess()) { /* 写出成功 */ }
    else { f.cause().printStackTrace(); f.channel().close(); }  // 写失败关连接
});
// 正确使用结果：不阻塞当前线程，写完在 EventLoop 回调里判断成败/处理异常
// 错误用法：在同一 EventLoop 线程里写 future.sync()/await() → sync 等的正是在跑的当前线程，永远等不到→自锁死（Netty 抛 "blocking the current eventLoop"）
```
- **`addListener` 的执行线程**：若 future 已完成，监听器**在当前线程**同步跑；未完成则注册，将来由**该 Channel 的 EventLoop**跑。所以监听器里做的仍是 IO 安全级别的事，重活还得再投业务池。
- **`Promise`** 是 `ChannelFuture` 的"可写端"（`setSuccess/tryFailure/setFailure`）—— 你把异步结果回填给它，别人addListener。自写异步 API、桥接第三方回调常用 `Promise` + `PromiseCombiner`（聚合多个）。
- 反例：`future = ch.write(buf); future.sync();` 写在 EventLoop 线程里 → **自锁死**（sync 等的事件循环正是当前线程，永远等不到）→ Netty 会抛 `blocking the event loop` 检测。这是 Netty 新手最经典的死锁。

## 五、ChannelGroup：跨连接广播

`DefaultChannelGroup` 管理一批 Channel（按 EventLoop **内部分桶**，广播时对每个桶并发 `writeAndFlush`，减少跨线程），做"1 写 N"（聊天室、行情推送、IM 下行、配置广播）：

```java
// 例子目的：用 DefaultChannelGroup 对一批连接做"1 写 N"广播
ChannelGroup group = new DefaultChannelGroup(eventLoopGroup.next()); // 可传 Executor
group.add(channel);                       // 新连接入组
...
group.writeAndFlush(pushMsg);             // 向组内所有连接广播（自动按 EventLoop 分桶并发）
ChannelGroupFuture f = group.newCloseFuture(); // 或 group.close()
// 正确使用结果：一条消息高效扇出到上万订阅连接，断开的 Channel 自动从组移除
// 错误用法：百万连接广播不管背压→ 慢消费者把组内写缓冲堆满→ 直内存 OOM（应用 isWritable()/分组限流丢弃慢连接）
```
- 断开的 Channel 会被**自动移除**（监听 `channelInactive`/`CLOSE`）。
- 百万连接广播注意**背压**：慢消费者把组内写缓冲堆满 → 配合 `isWritable`（s3-2）或分组限流，否则内存爆。

## 六、优雅关闭：shutdownGracefully（发布不丢请求的关键）

进程收到下线信号时，正确顺序呼应 networks/s2-2「先摘流量、再关连接」：

```java
// 例子目的：优雅关闭两个 EventLoopGroup，给 in-flight 请求一个 drain 窗口
// 1)（可选但推荐）先从 LB 摘除 / 标记 not-ready，让新流量不再进来
// 2) 关闭 worker 与 boss group，触发已 accept 连接的 in-flight 处理收尾
Future<?> wf = workerGroup.shutdownGracefully(2, 27, TimeUnit.SECONDS); // quietPeriod=2s, timeout=27s
Future<?> bf = bossGroup.shutdownGracefully();
wf.await();  // 主线程（非 EventLoop）等两组真正终止
// boss 关 → ServerChannel 关闭、停止 accept；worker 关 → 不再处理新读，但队列里任务会尽力收尾
// 正确使用结果：正在处理的请求在 quietPeriod 内平滑跑完再退出，滚动发布零 502
// 错误用法：shutdownGracefully(0,0,...) → 无 drain 窗口，正在处理的请求被直接砍掉（丢包/半截响应）
```
- **`shutdownGracefully(quietPeriod, timeout, unit)`**：在 `quietPeriod` 内若无新任务则提前结束；到 `timeout` 强制停。给 in-flight 请求一个 drain 窗口（别设 0，否则正在处理的请求被砍）。
- 关 EventLoopGroup **不会自动关你已建立的连接** —— 要优雅地回 `GOAWAY`/最后一帧再 `channel.close()`（HTTP/2、长连接协议自己实现，呼应 networks/s2-2 第七节）。
- 配套：`ServerBootstrap.childOption(SO_LINGER)`、业务线程池也要 `shutdown + awaitTermination`；`channel.close().await()` 等写完再退。
- **`sync()` 在 main 里等 `bind` 完成**是启动期（非 EventLoop 线程），阻塞无害；生产 EventLoop 线程内才禁阻塞。

## 七、定时任务精度（隐藏坑）

`eventLoop.schedule(task, delay, unit)` 复用 EventLoop 的 `scheduledTaskQueue`。精度受两个因素影响：
1. **IO 忙时任务延后**：一轮 `select`+`processSelectedKeys` 若耗时长（比如某连接大量可读、或你 handler 有慢逻辑），排到的定时任务要等 `runAllTasks` 才跑 → **定时心跳/超时判定会偏晚**（s3-2 空闲检测依赖它，高负载下"检测阈值"要留余量）。
2. **`select` 的 timeout**：EventLoop 用带超时的 `select(wakeupDeadline)` 保证到点能醒；但若被 `wakeup` 风暴/空轮询干扰（s1-3），计时可能抖动。

> 结论：Netty 定时任务是"**尽力而为、不早于设定时间**"，非硬实时。对精度敏感的场景（金融撮合超时）要么留 buffer，要么用独立 `HashedWheelTimer`（Netty `io.netty.util.HashedWheelTimer`，O(1) 海量定时任务更省，但单线程需注意 handler 里别再阻塞）。

## 八、三大行业场景钩子

- **电商**：秒杀网关 `DefaultChannelGroup` 向前端长连接广播库存变更；发布用 `shutdownGracefully(2,25s)` 配合 K8s `preStop`+摘流量，做到滚动发布零 502；写回统一走 `addListener` 不回压 EventLoop。
- **金融**：RPC 客户端（Dubbo 就是 Netty）用 `Promise` 把"请求→响应"配成异步 future，业务线程池解阻塞；撮合侧慎用 EventLoop 定时（精度），改独立 `HashedWheelTimer` 管超时。
- **电力**：主站对海量终端用 EventLoop `schedule` 发轮询/心跳，但要意识到"高负载时定时偏晚"，超时阈值按最坏延迟设；`ChannelGroup` 分区域管理终端连接做批量下发。

## 九、要点回顾

1. **EventLoop = 1 线程 + 1 Selector + 任务队列 + 定时队列**；IO 优先、`runAllTasks` 有配额防饿死。
2. **无锁串行化**：同 Channel 免锁保序；陷阱是慢任务饿死同组 Channel。`execute()` 是"调度到 EventLoop"不是"并行化"。
3. **重活分离**：`addLast(DefaultEventExecutorGroup, handler)` 或自建业务池才真换线程；`ctx.executor()` 换不出去。写完自动切回 EventLoop。
4. **Future/Promise**：一律 `addListener` 回调，**别在 EventLoop 里 `sync()/await()`（会自锁）**；Promise 是异步结果可写端。
5. **ChannelGroup** 做 1 写 N 广播，内部按 EventLoop 分桶并发、自动摘除断连；注意广播背压。
6. **优雅关闭** `shutdownGracefully(quiet,timeout)` 给 drain 窗口 + 先摘流量（networks/s2-2）；EventLoop 定时任务"尽力而为不早于设定"，精度敏感用 HashedWheelTimer。
