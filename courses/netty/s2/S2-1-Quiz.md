# EventLoop、Channel、ChannelPipeline 与 Handler · 小测验

### 1. 关于 Channel / EventLoop / Pipeline 的绑定关系，正确的是（15分）

- A. 一个 Channel 可被多个 EventLoop 并行处理读写
- B. 一个 EventLoop 只能服务一个 Channel
- C. 一个 Channel 终身绑定一个 EventLoop，且恰好拥有一条 Pipeline
- D. 一条 Pipeline 可以被多个 Channel 共享

> 答案：C
> 解析：这是 Netty 的黄金绑定：1 Channel = 1 Pipeline，且 Channel 一生只注册到一个 EventLoop（无锁串行化的基础）。一个 EventLoop 可承载多个 Channel；Pipeline 每连接一条不共享。

### 2. 入站事件（如 channelRead）在 Pipeline 中的传播方向是（15分）

- A. Tail → Head
- B. Head → Tail
- C. 只在当前 handler 停止
- D. 双向同时

> 答案：B
> 解析：入站 Head→Tail，出站（write/connect）Tail→Head。入站 handler 处理入站、出站 handler 处理出站，方向相反。

### 3.【多选】关于 `ctx.write(msg)` 与 `ctx.channel().write(msg)`，下列说法正确的有（20分）

- A. `ctx.write` 从当前 handler 处向 Head 方向传播，只经过其靠 Head 一侧的出站 handler
- B. `channel().write` 从 Tail 开始，经过整条链的全部出站 handler
- C. 两者完全等价，用哪个都一样
- D. 一般优先用 `ctx.write`，尊重责任链局部性、避免重复触发下游出站 handler

> 答案：ABD
> 解析：C 错。二者传播起点不同、经过的出站 handler 集合不同。A/B/D 正确描述了差异与推荐用法。

### 4. 一条入站消息一路传到 Tail 都没被任何 handler 消费，Netty 默认会（10分）

- A. 抛异常并关闭连接
- B. 由 TailContext `release` 掉该消息（ByteBuf 被释放），channelRead 被忽略
- C. 缓存起来等下次
- D. 自动回写给客户端

> 答案：B
> 解析：TailContext 是入站终点，会 `ReferenceCountUtil.release(msg)` 兜底防止 ByteBuf 泄漏，并忽略未处理消息——所以忘了加业务 handler，消息会"凭空消失"。

### 5. 一个 Handler 要标 `@ChannelHandler.Sharable` 的前提是（10分）

- A. 它性能足够高
- B. 它会被多个 Channel 的 pipeline 同时引用，且自身无危险的可变 per-channel 状态（线程安全）
- C. 它是入站 handler
- D. 它实现了 `channelRead`

> 答案：B
> 解析：Sharable = 同一实例被多条连接并发从不同 EventLoop 线程调用，必须自保线程安全，连接级状态要用 AttributeKey/ctx 而非实例字段。跨连接共享却不标 Sharable，addLast 会抛异常。

### 6. 简答：在 Netty 的 Handler 里做"同步查数据库/调下游 RPC"为什么危险？正确做法有哪两种？`ctx.executor().execute(...)` 能否解决，为什么？（30分）

> 参考答案：
> - 要点：Handler 默认跑在 Channel 绑定的 EventLoop 线程上，而一个 EventLoop 承载多个 Channel → 阻塞它会**拖垮同 EventLoop 上所有其它连接的读写**（不是只影响自己）。
> - 要点：正解一 = 把重活挂到**独立业务线程池 / `DefaultEventExecutorGroup`**（`pipeline.addLast(bizGroup, handler)` 或 `bizPool.submit`，写完 Netty 自动切回 EventLoop）。
> - 要点：正解二 = 全异步化（用异步客户端 + `ChannelFuture.addListener` 回调），根本不阻塞。
> - 要点：`ctx.executor().execute(task)` **不能解决** —— 它只是把任务排到**同一个 Channel 的 EventLoop** 上异步跑，还是那个 IO 线程，阻塞照阻塞；要逃离必须换真正的独立线程池。
> - 加分：点出"IO 线程绝不阻塞"这条铁律来自 Reactor 模型（s1-2），并提 per-channel 状态免锁正是靠这种串行化。
