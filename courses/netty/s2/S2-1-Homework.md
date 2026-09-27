# EventLoop、Channel、ChannelPipeline 与 Handler · 课后作业

> 两题各 50 分：一题动手验证 Pipeline 传播与执行线程，一题设计一条真实网关 pipeline 并论证每步放置与线程归属。

## 作业 1：观测 Pipeline 传播顺序与 Handler 线程（50 分）

**要求**：
1. 搭一个 Echo 服务，pipeline 依次 `addLast`：`A`(inbound, 打印 `A-in`)、`B`(outbound, 打印 `B-write`)、`C`(inbound，收到消息后 `ctx.write("resp")` 再打印 `C-in`)、`D`(outbound, 打印 `D-write`)。发送一条消息，**写出**入站与回写阶段各自的打印顺序，验证"入站 Head→Tail、出站从 ctx 处向 Head"。
2. 把 `D` 换成放在 `C` **靠 Head 一侧**（即 addLast 顺序变成 A、D、B、C），再对比 `C` 用 `ctx.write` vs `ctx.channel().write` 时 `D/B` 是否被触发，验证"起点不同、经过的出站集合不同"。
3. 在每个 handler 打印 `Thread.currentThread().getName()`：确认同一连接所有 handler 都在**同一个 EventLoop 线程**；再把 worker group 线程数设为 1，开多条连接，确认它们**共用**一个 EventLoop。
4. 给 `C` 挂一个 `DefaultEventExecutorGroup`，打印线程名变化，观察回写仍被切回 EventLoop。

**验收标准**：
- 传播顺序与 Netty 实际一致，能说清 `ctx.write` 与 `channel().write` 的差异实验结论。
- 用线程名证明"同 Channel 串行、跨 Channel 才并行"。
- 证明"挂业务组后 handler 在业务线程跑、但写回自动切 EventLoop"，无需手写同步。

**参考答案要点**：
- 入站：A→C；`ctx.write` 从 C 向 Head 传播经过 B（经过其靠 Head 侧的出站 handler），不经过位于 C 靠 Tail 侧的出站 handler。
- 加 `EventExecutorGroup`：C 的方法在 biz 线程执行；`ctx.writeAndFlush` 内部 `safeSetUserDefinedWritability`/`executor.inEventLoop()` 判断后把写任务转回 Channel 的 EventLoop。

## 作业 2：为电商交易网关设计 Pipeline（50 分）

**背景**：一条 TCP 长连接接入，协议为"4 字节长度 + Protobuf body"，需要 TLS、鉴权（调下游用户中心 RPC）、限流（全局）、业务下单（调订单服务 + DB）。

**要求**：
1. 写出完整 pipeline 顺序（`addLast` 顺序），标注每个 handler 是入站/出站/双工、是否 `@Sharable`、运行在 EventLoop 还是业务线程池，并给理由。
2. 说明 `IdleStateHandler`（心跳，s3-2）该放哪、为什么必须在最前。
3. 指出哪些 handler 一旦放错顺序会导致"解不出帧/明文进了解密器/半包被当整包"。
4. 给出异常兜底 handler 的 `exceptionCaught` 实现（区分正常断开 vs bug、是否 close）。

**验收标准**：
- 顺序合理：`SslHandler → LengthFieldBasedFrameDecoder → ProtobufDecoder → IdleStateHandler → 鉴权(业务池) → 限流(Sharable) → 下单(业务池) → 编码器 → 异常兜底(最后)`。
- 正确解释：编解码器顺序不可乱；有阻塞下游的（鉴权/下单）必须挂业务线程池；全局限流无 per-connection 态可 Sharable 共享；连接级会话态用 `AttributeKey`。
- `exceptionCaught` 记日志并按类型决定是否 `ctx.close()`。

**参考答案要点**：
- `IdleStateHandler` 放头部否则空闲事件被前面 handler 吞掉/延迟。
- 一次 RPC 若放 EventLoop：下游 P99 抖动 → 该 EventLoop 上所有商户连接排队 → 雪崩。业务线程池隔离。
- Sharable 误用（把连接计数放共享实例字段）→ 串号事故；用 `AttributeKey` 承载"该连接鉴权结果/序列号"。
