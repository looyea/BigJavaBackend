# EventLoop 线程模型、Future/Promise 与优雅关闭 · 课后作业

> 两题各 50 分：一题复现"EventLoop 内 sync 自锁 + 重活饿死同组连接"，一题做带优雅关闭的 Echo/广播服务并验证零丢请求发布。

## 作业 1：复现两类线程模型事故（50 分）

**要求**：
1. 在某个 Channel 的 `channelRead`（EventLoop 线程）里写 `channel.writeAndFlush(resp).sync()`，观察 Netty 抛"阻塞 EventLoop"类异常或卡死，解释死锁成因。
2. 把 worker group 线程数设为 1，在一个 handler 的 `channelRead` 里 `Thread.sleep(500)`；开 20 条连接并发发请求，测量"第二条连接的响应延迟"远大于单连接时（被同 EventLoop 串行拖累）。
3. 分别用 ① `addLast(new DefaultEventExecutorGroup(8), bizHandler)` 与 ② 自建线程池 `submit`+回调 `ctx.writeAndFlush` 两种方案改造，复测第 2 步延迟恢复正常。
4. 记录三种写法下 `Thread.currentThread()` 的名字，佐证"谁在哪个线程跑、写回是否切回 EventLoop"。

**验收标准**：
- 说清 sync 自锁 = "等的事件循环是当前线程"；给出 addListener 正解。
- 用延迟数据证明"单 EventLoop 承载多 Channel，慢 handler 连累同组"。
- 两种隔离方案都生效，并解释写回为何无需手动同步。

**参考答案要点**：
- EventLoop 每轮 select+IO+runAllTasks（有配额）；sleep 占住该线程 → 同组连接排队。
- `DefaultEventExecutorGroup`/业务池把重活挪出，写回经 `inEventLoop()` 判断自动切回 Channel 的 EventLoop。

## 作业 2：带优雅关闭的广播服务 + 发布零丢包验证（50 分）

**背景**：一个 Netty 服务，boss+worker(=核数)，业务是收到请求后异步处理再回写，同时向 `ChannelGroup` 内所有连接广播心跳。

**要求**：
1. 用 `DefaultChannelGroup` 维护连接，`shutdownGracefully(quiet,timeout)` + 注册 ShutdownHook 实现优雅下线：先停 accept（关 boss）、停止向 group 加新连接、给 in-flight 请求 drain 窗口、再关 worker。
2. 用压测客户端持续发请求（带自增序号 + 客户端校验响应完整性），在处理逻辑里注入 ~10 ms 耗时，**在压测中途 `kill -TERM` 服务进程**，统计：发布窗口内**丢失/失败的请求数**。
3. 对比"直接 `kill -9`（无优雅）"vs"优雅关闭"两种下的失败数，验证优雅关闭显著降低丢包。
4. 若仍有丢包，改进：`preStop` 先摘流量、`timeout` 调大覆盖 P99 处理时间、写回 `addListener` 里对失败连接 `close`。

**验收标准**：
- 说清"关 EventLoopGroup 不自动关已建立连接"，需自己 drain + 回最后一帧再 close。
- 给出优雅 vs 暴力的丢包对比数据。
- 关联 networks/s2-2 第七节"发布失败三连（reset/EOF/Broken pipe）"根因，指出应先摘流量。

**参考答案要点**：
- 顺序：注册中心/LB 摘除 → `bossGroup.shutdownGracefully()`（停新建）→ 停止接收新请求但处理完 in-flight → `workerGroup.shutdownGracefully(quiet,timeout)` → `await` → 关业务线程池。
- quietPeriod 给"没有新任务就提前结束"的缓冲，避免砍掉正在跑的请求。
