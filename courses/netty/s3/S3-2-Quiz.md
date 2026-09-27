# 心跳、空闲检测、背压与百万连接调优 · 小测验

### 1. 长连接系统必须做应用层心跳，主要原因是（15分）

- A. TCP 太慢
- B. SO_KEEPALIVE 默认探测间隔约 2 小时且中间设备会静默丢半开连接，对端崩溃/拔网线时本端 read 不返回，连接假死
- C. Netty 不支持 keepalive
- D. 心跳能提升带宽

> 答案：B
> 解析：TCP keepalive 太钝（7200s）且 NAT/防火墙/LB 可能静默丢弃半开连接不通知，导致"假死"。应用层周期性 Ping/Pong + 超时判死才能及时发现并重建。

### 2. `IdleStateHandler` 触发空闲时做了什么（15分）

- A. 自动关闭连接
- B. 自动发送心跳
- C. 向 pipeline 发出一个 IdleStateEvent（userEventTriggered），由下游 handler 决定策略
- D. 抛异常

> 答案：C
> 解析：它只是检测器，发 IdleStateEvent；关连接/发心跳是你在 userEventTriggered 里写的策略。后面必须跟处理 handler，否则事件到 Tail 被忽略。

### 3.【多选】关于 `WriteBufferWaterMark` 与背压，正确的有（20分）

- A. 出站缓冲超过 highWaterMark 时 `channel.isWritable()` 变 false，低于 lowWaterMark 恢复 true（迟滞防抖）
- B. 一旦不可写，Netty 会自动阻塞 write 调用直到能写
- C. 一旦不可写，Netty 会自动丢弃要写的数据
- D. 降速/丢弃/关慢消费者的责任在应用：应根据 isWritable 主动处理，并向上游传导背压

> 答案：AD
> 解析：B、C 错。`write()` 既不阻塞也不拒绝，仍会接收并堆进缓冲；水位只给你 isWritable 标志，处置是应用的事（丢弃需记得 release ByteBuf），并应端到端把"慢"往上游传导。

### 4. `FlushConsolidationHandler` 的作用是（10分）

- A. 加密
- B. 把多次 flush 合并为每 N 次/定时真正刷一次，减少高频小写的 syscall 开销
- C. 自动重连
- D. 压缩数据

> 答案：B
> 解析：合批 flush，配合"用 ctx.write 攒、适时 flush 一次"显著降 syscall、提吞吐；放靠近 Head 的出站位置，极端情况略增延迟有定时兜底。

### 5. 百万连接场景下，最先把单机打满的资源通常是（10分）

- A. CPU
- B. 文件描述符（fd）与内核 conntrack 表、每连接内存
- C. 磁盘
- D. 网络带宽

> 答案：B
> 解析：每连接 1 fd → `ulimit -n` 先破（Too many open files）；百万连接 nf_conntrack 表易满（静默丢包）、每连接缓冲/会话内存累积。EventLoop 数与连接数解耦不是瓶颈。

### 6. 简答：设计一个"服务端管理百万终端长连接"的心跳+背压方案：说明 readerIdle/writerIdle 取值原则、为何不能设太小、以及推送时如何避免慢终端拖垮全场。（30分）

> 参考答案：
> - 要点：客户端 writerIdle 定时发 Ping（如 30s），服务端 readerIdle 设 > 心跳间隔×2~3（如 90s+）：留足对端发心跳 + 网络抖动 + EventLoop 定时高负载偏晚（s3-1）的余量，否则正常空闲被误杀。
> - 要点：服务端 readerIdle 触发→判客户端死→close 并清理会话/ChannelGroup；用 HashedWheelTimer 管海量超时，别每连接一个 schedule。
> - 要点：设 readerIdle 太小会因一次 GC/CPU 抖动就误断开海量连接 → 惊群重连风暴，务必留 buffer。
> - 要点：推送用 `isWritable`（WriteBufferWaterMark）判慢消费者：不可写则丢弃非关键/降级/或直接断开慢终端让其重连，绝不无界堆发送缓冲把内存拖爆、连累同 EventLoop 其它连接。
> - 加分：配合 epoll transport、SO_REUSEPORT 多进程分摊 accept、fd/conntrack/MaxDirectMemorySize 调优与 pendingTasks/direct memory/CLOSE_WAIT 监控告警。
