# EventLoop 线程模型、Future/Promise 与优雅关闭 · 小测验

### 1. 一个 EventLoop 每轮循环的正确优先级是（15分）

- A. 先跑完所有普通任务再处理 IO
- B. select 处理就绪 IO → 再按配额跑 taskQueue/定时任务 → 回到 select
- C. 只处理 IO，任务另开线程跑
- D. 随机顺序

> 答案：B
> 解析：EventLoop run() 每轮先 select+processSelectedKeys 处理 IO，再 runAllTasks（有任务数/时间配额，防饿死 IO），循环。IO 优先于普通任务。

### 2. `channel.eventLoop().execute(task)` 的语义是（15分）

- A. 新开一个线程并行执行 task
- B. 确保 task 在该 EventLoop 线程上执行（已在则直接跑，否则入其队列）
- C. 把 task 投到业务线程池
- D. 立即阻塞等待 task 完成

> 答案：B
> 解析：execute 是"调度到该 EventLoop 线程"，`inEventLoop()` 为真就直接 run、否则入队。它不是并行化，也不能把阻塞重活挪离 IO 线程。

### 3.【多选】关于把"阻塞重活"（RPC/DB/大计算）从 IO 线程隔离，正确做法有（20分）

- A. `pipeline.addLast(new DefaultEventExecutorGroup(16), bizHandler)` 让该 handler 在业务线程执行
- B. 自建业务线程池 `submit`，处理完在回调里 `ctx.writeAndFlush`，写回会被 Netty 切回 EventLoop
- C. `ctx.executor().execute(bizTask)` 因为换了 executor 就等价于隔离到了非 IO 线程
- D. 用异步客户端 + `ChannelFuture.addListener` 回调，根本不阻塞

> 答案：ABD
> 解析：C 错。`ctx.executor()` 默认仍是该 Channel 的 EventLoop，只是异步化、没逃离阻塞。A/B/D 是真正把工作挪出 IO 线程的方式。

### 4. 在 EventLoop 线程里对刚提交的 write future 调 `sync()`/`await()` 会（10分）

- A. 正常阻塞到写完
- B. 可能自锁死——等待完成的事件循环正是当前线程，Netty 会检测并抛阻塞 EventLoop 异常
- C. 自动切业务线程
- D. 触发 GC

> 答案：B
> 解析：future 的完成依赖本 EventLoop 继续跑，而你在其上阻塞等待 → 死锁。Netty 有"blocking the event loop"检测。正确做法用 `addListener` 回调；main 启动期 `bind().sync()` 因非 EventLoop 线程才安全。

### 5. `shutdownGracefully(quietPeriod, timeout, unit)` 中 quietPeriod 的作用是（10分）

- A. 强制立即关闭所有连接
- B. 在该静默期内若无新任务则提前完成关闭，给 in-flight 请求一个 drain 窗口
- C. 设置线程数
- D. 关闭 boss group 的超时

> 答案：B
> 解析：quietPeriod 是"安静期"——这段时间没有新任务就结束关闭，到 timeout 强制停；给正在处理的请求收尾时间。设 0 会砍掉 in-flight 请求。且它不会自动关已建立连接，需自己回最后一帧再 close。

### 6. 简答：用 Netty 实现"行情服务器向 5 万订阅连接广播一条快照"。请说明用哪个 API、如何避免拖垮 EventLoop、慢消费者如何处理，以及发布时如何优雅下线。（30分）

> 参考答案：
> - 要点：用 `DefaultChannelGroup`（add 各订阅 Channel），`group.writeAndFlush(snapshot)` 一次广播；内部按 EventLoop 分桶并发写、连接断开自动移除。
> - 要点：序列化/打包快照这类 CPU 活不要占 EventLoop —— 在业务线程池算好编码结果（或直接共享同一个 ByteBuf，注意引用计数 retain 每连接一份/或共享只读）再交 EventLoop 写；避免一次大计算饿死同组其它连接。
> - 要点：慢消费者用 `channel.isWritable()`（WriteBufferWaterMark，s3-2）判背压，不可写则丢弃/降级/断开该订阅，别把发送缓冲堆爆内存。
> - 要点：优雅下线——先从 LB/注册中心摘流量、停止新订阅加入，再 `workerGroup.shutdownGracefully(quiet,timeout)` 给 in-flight 写完，必要时先向各连接发"最后一帧/GOAWAY"再 `close`；配合 `addListener` 不用 sync 阻塞。
> - 加分：提 5 万连接要盯 fd 上限（`ulimit -n`）、直接内存用量与广播的 CPU 摊薄。
