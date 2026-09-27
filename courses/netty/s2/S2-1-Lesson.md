# EventLoop、Channel、ChannelPipeline 与 Handler · 讲义

> 前两阶段我们讲"为什么"（IO 模型、Reactor、NIO 的坑）。从这里起进入 **Netty 本体**。本节是全包**重要度最高（5/5）**的一节：把 Netty 启动骨架和七大核心接口的关系钉死，讲透 `ChannelPipeline` 这条双向责任链怎么传播事件与异常，以及"Handler 到底在哪个线程跑、能不能共享、重活为什么必须换线程池"。理解本节，后面 ByteBuf、编解码、线程模型全都是它的推论。（核心精讲，含源码级走查）

## 一、启动骨架：一段代码把七大接口全串起来

```java
ServerBootstrap b = new ServerBootstrap();
b.group(bossGroup, workerGroup)                 // ① 两个 EventLoopGroup（主从 Reactor，s1-2）
 .channel(NioServerSocketChannel.class)         // ② Channel 工厂（服务端监听通道）
 .option(ChannelOption.SO_BACKLOG, 128)         //    作用于 boss 的 ServerChannel
 .childOption(ChannelOption.TCP_NODELAY, true)  //    作用于每个 accept 出来的 child Channel
 .childHandler(new ChannelInitializer<SocketChannel>() {
   protected void initChannel(SocketChannel ch) {
     ch.pipeline()                               // ③ ChannelPipeline：这条连接的事件处理链
       .addLast(new LineBasedFrameDecoder(256))  // ④ 入站 Handler（解码）
       .addLast(new StringDecoder())
       .addLast(new BizHandler());               // ⑤ 业务 Handler
   }
 });
Channel serverCh = b.bind(8080).sync();          // ⑥ bind 返回 ChannelFuture（异步结果，s3-1）
```

**七大核心接口一句话职责**（务必背下这张关系，面试画得出）：

| 接口 | 职责 | 数量关系 |
|---|---|---|
| **`EventLoopGroup`** | 一堆 EventLoop 的容器，负责挑选/分配 | 1 组 = N 个 EventLoop |
| **`EventLoop`** | 单线程 + 一个 Selector 的循环体；`extends ScheduledExecutorService` | 1 EventLoop : 多 Channel |
| **`Channel`** | 一条连接/一个监听的抽象（JDK channel 的封装） | 1 Channel : 1 Pipeline : 1 EventLoop |
| **`ChannelPipeline`** | 该连接的 Handler 双向责任链 | 每 Channel 一条 |
| **`ChannelHandler`** | 你的业务/编解码逻辑 | 每条 pipeline 多个 |
| **`ChannelHandlerContext`** | Handler 与 pipeline 的**连接点**，携带"下一个是谁"与所属 EventLoop | 每 Handler 一个 |
| **`ChannelFuture`** | 异步结果句柄（`addListener` 回调，不阻塞） | 每个异步操作一个 |

**黄金绑定关系**（三条，决定一切线程模型）：
1. 一个 `Channel` **一生只注册到一个 `EventLoop`**（s1-2 铁律）。
2. 一个 `EventLoop` 可承载**多个 Channel**；一个 `EventLoopGroup` 含多个 EventLoop。
3. 一个 `Channel` **恰好一条 `Pipeline`**，pipeline 上每个 Handler 有各自的 `ChannelHandlerContext`。

## 二、ChannelPipeline：双向链表 + 头尾哨兵

Pipeline 是一个**侵入式双向链表**，两端各有一个**内置哨兵**：

```
  Head(安全网)  ⇄  InboundHandler1  ⇄  OutboundHandler1  ⇄ ... ⇄  Tail(回收/告警)
   入站起点                                     出站终点
```
- **`HeadContext`**：持有真正的 JDK `java.nio.channels.Channel`，是所有**出站**事件的最终执行者（真正把字节写进 socket），也是**入站**事件的起点（`fireChannelRead` 从这里发出）。它内部还会做 `inboundBuffer` 累加与 `read()` 的自动/手动流控（`channel.read()`、`AUTO_READ`，见 s3-2 背压）。
- **`TailContext`**：所有入站事件的终点。如果消息一路传到 Tail 还没被消费，它会 **`ReferenceCountUtil.release(msg)`** 释放 ByteBuf（防泄漏），并把 `channelRead` 忽略、把异常 `logger.warn` 出来。
  > 这就是"**入站消息你没人处理会被 Tail 悄悄 release**"的出处 —— 忘了 addLast 业务 handler，数据就"凭空消失"，是新手常见"我的消息呢"事故。

**入站 / 出站方向规则（必须刻进肌肉记忆）**：

| 事件 | 方向 | 传播起点 |
|---|---|---|
| 入站 `channelRead` / `channelActive` / `userEventTriggered` / `exceptionCaught` | **Head → Tail**（入站 handler `channelRead()`） | 由 Head `fireChannelRead` |
| 出站 `write` / `connect` / `bind` / `flush` | **Tail → Head**（出站 handler `write()`） | 由你调 `ctx.write()` 的那个 ctx 向前 |

- **入站 handler 只处理入站、出站 handler 只处理出站**：`ChannelInboundHandler` 收 `channelRead`；`ChannelOutboundHandler` 收 `write/flush`。方向相反，别注册错基类。

## 三、传播规则：从 `ctx` 走还是从 `channel` 走，差别巨大

这是本节最容易写错、面试最爱问的点。

```java
ctx.write(msg);         // 从"当前 handler 的下一个"开始向 Tail→Head 传播出站：只经过【你之后】的出站 handler
ctx.channel().write(msg); // 从 Tail 开始传播：经过【整条链所有】出站 handler
```

- **入站同理**：`ctx.fireChannelRead(msg)` 只把消息交给**下一个**入站 handler；`channel.pipeline().fireChannelRead(msg)` 从 **Head** 重新跑一遍。
- **出站从 ctx 处向 Head 方向传播**：`ctx.write` 只经过"位于当前 handler **靠 Head 一侧**"的出站 handler；`channel().write`/`pipeline().write` 从 **Tail** 起，经过**全部**出站 handler。编码器通常 addLast 在业务 handler **之前**（更靠 Head），所以业务里 `ctx.writeAndFlush(pojo)` 往 Head 传播时**照样会经过编码器**完成编码 —— 但用 `ctx.write` 更尊重链的局部性、不会重复触发下游出站 handler，是默认推荐。
- **`write` ≠ `flush`**：`write` 只把数据放进出站缓冲，`flush` 才真正刷到 socket。`writeAndFlush` 是二者合体；高频小写用 `FlushConsolidationHandler` 合批 flush 省 syscall（s3-2）。

## 四、异常传播：一路向 Tail 冒泡，兜底在 exceptionCaught

任何 handler 抛出的异常，Netty 调 `ctx.fireExceptionCaught(cause)`，**沿入站方向（Head→Tail）从当前向 Tail 传播**，逐个交给后续 `ChannelInboundHandler.exceptionCaught(ctx, cause)`，直到有人处理。

- **默认行为**：若没人接管，最终到 `TailContext.exceptionCaught` → 打一条 `WARN: An exception was thrown by a user handler's exceptionCaught() method while handling the following exception` 或 `LoggingHandler` 输出，**连接不会自动关**。
- **最佳实践**：在最靠近链尾（业务侧）的入站 handler 里重写 `exceptionCaught`：**记日志 + `ctx.close()`**（或返回错误帧再关）。因为异常后字节流状态已不可信，继续读只会错位（呼应 networks/s2-2：不可信就重建）。
- 解码器抛的 `TooLongFrameException`、`IOException`（连接重置）都走这条路 —— 你要在这里区分"客户端异常断开（正常，降级日志）"vs"真 bug（告警）"，否则满屏 `Connection reset` 噪音。

> 记住："**入站事件向 Tail 冒泡、异常也向 Tail 冒泡**" —— 尾部的兜底 handler 注册在最后，天然成为"全链异常/未消费消息的最后一道防线"。

## 五、Handler 的执行线程与 `@ChannelHandler.Sharable`

**问题**：一个 `channelRead` 到底在哪个线程跑？
**答**：默认在**该 Channel 绑定的那个 EventLoop 线程**上跑（呼应 s1-2、s1-3"一个 Channel 一个线程"）。所以你 pipeline 里**所有 handler 对同一个 Channel 都在同一线程串行执行** → 改 Channel 级共享状态无锁。

**那 `@ChannelHandler.Sharable` 是什么？**
- 一个 Handler 实例**被多个 Channel 的 pipeline 同时引用**时，必须标 `@Sharable`，否则 Netty 在 `addLast` 时抛 `ChannelHandler.Sharable annotation is missing`。
- 标了 Sharable = 你承诺"**这个 handler 无（危险的）per-channel 状态**"。它会被并发地、从**不同 EventLoop 线程**调用 → **内部可变字段必须自己保证线程安全**（用 `ChannelHandlerContext` 或 `AttributeKey` 存连接级状态，而不是实例字段）。
- 反例：`new BizHandler()` 里放 `Map<Channel,...>` 或普通 `int count` 想跨连接共享又标 Sharable → 数据竞争。**正解**：per-connection 状态用 `ctx.channel().attr(KEY)` 或干脆**每连接 new 一个非 Sharable handler**（默认就该这样）。

## 六、重活为什么必须走单独线程池（回到那条铁律）

Handler 跑在 EventLoop 上，EventLoop 又承载多个 Channel。**在 handler 里做阻塞操作（DB/RPC/大计算/sleep）会卡住该 EventLoop 上所有连接的读写**（s1-2 作业 2 实验复现过）。两种正确姿势：

1. **把重活丢到业务线程池**：注册 handler 时指定 `EventExecutorGroup`，Netty 就用该组的线程跑这个 handler 的方法，处理完自动切回 Channel 的 EventLoop 继续传播 —— 你不用手写同步：
   ```java
   EventExecutorGroup biz = new DefaultEventExecutorGroup(16);
   pipeline.addLast(biz, new BlockingBizHandler()); // 这个 handler 在 biz 线程执行
   ```
2. **自己 submit + 回调里回写**：`bizPool.submit(() -> {...; ctx.writeAndFlush(resp); })` —— `writeAndFlush` 会被 Netty 转回 EventLoop 执行，安全。

> 关键澄清：`ctx.executor().execute(task)` 只是**在当前 Channel 的 EventLoop 上异步**跑（还是那个 IO 线程，**没逃离阻塞**）；要真正并行重活必须用**独立的 `DefaultEventExecutorGroup` / 业务线程池**。这俩常被混为一谈，面试爱挖。

## 七、三大行业场景钩子

- **电商**：交易网关 pipeline 典型为 `[SslHandler] → [LengthFieldBasedFrameDecoder] → [StringDecoder] → [AuthHandler] → [BizHandler(挂 biz 线程池)]`。鉴权/风控要调下游 → 必须放独立线程池，否则一次下游抖动拖垮整条 EventLoop 上的所有商户连接。
- **金融**：行情推送把"编码 + 写"放 EventLoop（轻），把"聚合/打包快照"放业务组；SslHandler 的握手与加解密在 EventLoop 上，密文量大时评估 CPU 或用 `handlerMoved` 调整顺序。共享的限流器标 `@Sharable` + 内部 `AtomicLong`，连接级会话态用 `AttributeKey`。
- **电力**：终端上报 pipeline 里 `IdleStateHandler`（心跳，s3-2）必须放链**头部**（入站最先看到空闲事件）；每连接 new 非共享 handler 存"该终端的半包缓存/序列号"，绝不能图省事用 Sharable 实例字段 —— 几十万终端串号就是数据竞争事故。

## 八、要点回顾

1. **七大接口黄金关系**：`EventLoopGroup→N×EventLoop→各承载多 Channel`；`1 Channel = 1 Pipeline`，`1 Channel 终身绑 1 EventLoop`。
2. **Pipeline = 双向链表 + Head/Tail 哨兵**：Head 持 JDK Channel、管真正读写与 `inboundBuffer` 流控；Tail 兜底 `release` 未消费消息、告警未处理异常。
3. **方向铁律**：入站 Head→Tail、出站 Tail→Head；入站 handler 收入站、出站收出站。`ctx.write`（从当前起）vs `channel().write`（从 Tail 起）范围不同；`write` 不刷、`flush` 才刷。
4. **异常沿链冒泡到 Tail 兜底**，默认不关连接；须在业务侧 `exceptionCaught` 记日志 + `close`。
5. **Handler 默认跑在 Channel 的 EventLoop 线程** → 串行免锁；跨连接共享必须 `@Sharable` 且自保线程安全，per-connection 态用 `AttributeKey`/每连接 new。
6. **阻塞重活必须挂独立 `DefaultEventExecutorGroup`/业务线程池**；`ctx.executor()` 只是同 EventLoop 异步，没逃离阻塞。
