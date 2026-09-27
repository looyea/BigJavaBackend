# EventLoop、Channel、ChannelPipeline 与 Handler · 面试题

> 这是 Netty 面试的**核心考区**，几乎必问 Pipeline。答好要能：画出双向链表、说清入站出站方向与 ctx/channel 差异、解释 Handler 线程模型与 Sharable、并主动点出"IO 线程不阻塞"。能讲 HeadContext/TailContext 是明显的加分档。

## 考点 1：Channel / EventLoop / Pipeline 关系（开场图题）

**起手**：Netty 一个连接对应几个线程、几条 pipeline？

**期望**：
- 1 Channel = 1 Pipeline；Channel **终身绑定一个 EventLoop（单线程）**；一个 EventLoop 可服务多个 Channel。
- 收益：同 Channel 所有事件在该线程串行 → 改 Channel 状态**无锁线程安全**、保序、缓存亲和。

**追问链**：
1. 为什么不一个连接一个线程？→ 那是 BIO（s1-1），连接数=线程数会打爆；Reactor 让线程数与连接数解耦。
2. 那 CPU 密集业务怎么并行？→ 不同 Channel 落在不同 EventLoop 上并行；单 Channel 内不能加 IO 线程。

## 考点 2：Pipeline 结构 + 入站/出站方向

**起手**：ChannelPipeline 是什么结构？事件怎么流？

**期望**：
- 侵入式**双向链表**，两端内置 **HeadContext / TailContext**。
- **入站**（channelRead、channelActive、userEventTriggered、exceptionCaught）Head→Tail；**出站**（write、connect、bind、flush）Tail→Head。入站 handler 只收入站、出站只收出站。
- HeadContext 持真正的 JDK Channel，是出站最终执行者 + 入站起点，并管 `inboundBuffer`/`read()` 流控；TailContext 是入站终点，兜底 `release` 未消费消息、告警未处理异常。

**追问链**：
1. 消息没人处理会怎样？→ 到 Tail 被 `ReferenceCountUtil.release`，ByteBuf 回收、`channelRead` 被忽略 → "消息凭空消失"，所以业务 handler 别忘加。
2. `write` 和 `flush` 区别？→ write 只入出站缓冲，flush 才刷 socket；高频小写用 `FlushConsolidationHandler` 合批（s3-2）。

## 考点 3：ctx.write vs channel.write（细节杀手）

**起手**：`ctx.writeAndFlush` 和 `channel.writeAndFlush` 有何不同？

**期望**：
- `ctx.write` 从**当前 handler 向 Head** 传播，只经过其靠 Head 一侧的出站 handler；`channel().write` 从 **Tail** 起经过全部出站 handler。
- 默认推荐 `ctx.write`，尊重责任链局部性、避免重复触发。

**追问链**：
1. 编码器在业务 handler 靠 Head 侧，业务里 `ctx.write(pojo)` 会经过编码器吗？→ 会（向 Head 传播途中遇到）。
2. 入站侧 `ctx.fireChannelRead` vs `pipeline.fireChannelRead`？→ 前者给**下一个**入站 handler，后者从 Head 重跑。

## 考点 4：Handler 线程与 @Sharable

**起手**：一个 handler 的 channelRead 跑在哪个线程？什么时候要 `@ChannelHandler.Sharable`？

**期望**：
- 默认跑在 **Channel 绑定的 EventLoop 线程**（除非注册时指定了 `EventExecutorGroup`）。
- 一个 handler 实例被**多连接 pipeline 共享**时必须 `@Sharable`，且它会被不同 EventLoop 线程并发调用 → 无危险可变状态 / 自保线程安全；per-connection 状态放 `AttributeKey` 或每连接 new。

**追问链**：
1. 把连接计数写成共享 handler 的实例字段 `int count` 会怎样？→ 数据竞争、串号；要么 `AtomicInteger` 且接受全局语义，要么用 `AttributeKey` 存连接级。
2. 不标 Sharable 却复用实例？→ `addLast` 抛 `Sharable annotation is missing`。

## 考点 5：IO 线程绝不阻塞（工程观必考）

**起手**：在 handler 里同步调 RPC/查库会怎样？怎么办？

**期望**：
- 会**卡住该 EventLoop 上所有其它连接**（一线程多连接）→ 雪崩。
- 解法：① 重活挂 `DefaultEventExecutorGroup`/业务线程池（`addLast(biz, handler)`，写完自动切回 EventLoop）；② 全异步 `ChannelFuture.addListener` 回调。
- 澄清：`ctx.executor().execute()` 只是同 EventLoop 异步，**没逃离阻塞**，不能解这个问题。

## 考点 6：异常传播（收尾）

**期望**：
- 异常经 `ctx.fireExceptionCaught` 沿入站方向向 Tail 冒泡，逐个 `exceptionCaught`；没人管到 Tail 只打 WARN、**不自动关连接**。
- 实践：业务侧最末入站 handler 重写 `exceptionCaught` → 记日志 + 按类型 `ctx.close()`（异常后字节流不可信），并区分"客户端正常断开（降噪）"vs"真 bug（告警）"。

**加分全景**：能把 s1（IO 模型/Reactor/NIO 的坑）→ s2（Netty 如何封装）→ s3（线程模型/背压实战）串成"Netty 存在的理由与用法"一条线，就是最高档回答。
