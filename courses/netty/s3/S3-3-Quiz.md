# Netty 实战：HTTP 服务、RPC 与生态集成 · 小测验

### 1. 用 Netty 写 HTTP 服务时，把分块到达的请求攒成完整 FullHttpRequest 的 handler 是（15分）

- A. `HttpServerCodec`
- B. `HttpObjectAggregator`
- C. `ChunkedWriteHandler`
- D. `HttpRequestDecoder`

> 答案：B
> 解析：HttpServerCodec 只做编解码；请求以 head + 若干 HttpContent 分块入站，Aggregator 聚合成 FullHttpRequest（其 maxContentLength 必设防大包）。ChunkedWriteHandler 用于大响应流式写。

### 2. Dubbo/RocketMQ 这类基于 Netty 的 RPC，如何把"多路复用的乱序响应"关联回各自的调用（15分）

- A. 每个请求新建一条 TCP 连接
- B. 请求带 requestId，客户端用 requestId→Promise 的 map，收到响应按 id 取出对应 Promise 完成它
- C. 靠响应顺序匹配
- D. 用全局锁串行化

> 答案：B
> 解析：长连接上多路复用，请求带唯一 requestId + 异步 Promise 表，响应回来按 id 唤醒对应 future（呼应 HTTP/2 stream 思想）。不必每请求一连接。

### 3.【多选】Spring WebFlux / Reactor Netty / Dubbo / gRPC 等选 Netty 作底座的合理原因有（20分）

- A. 成熟的主从 Reactor + epoll，少量线程扛海量连接
- B. 池化 ByteBuf + 引用计数，省 GC 与拷贝
- C. Netty 比所有自研 NIO 都快，是唯一正确选择
- D. 提供 Pipeline + 丰富编解码器 + 跨平台 transport，且久经考验（空轮询绕过、泄漏检测）

> 答案：ABD
> 解析：C 说法绝对化错误——Kafka 客户端就是自研 NIO selector 未用 Netty；Netty 的价值是"成熟稳定好用"而非"唯一/绝对最快"。A/B/D 是真实原因。

### 4. 在 Spring Cloud Gateway（Reactor Netty）的过滤器里写同步阻塞调用（如阻塞式 HTTP 客户端）会（10分）

- A. 提升可读性，无性能影响
- B. 占住 EventLoop 线程，使全链路非阻塞退化回"一请求一线程"模型、并发骤降
- C. 自动切到 boundedElastic
- D. 触发 GC

> 答案：B
> 解析：网关靠前后端各少量 EventLoop 全非阻塞扛数万并发；过滤器内阻塞会占死 EventLoop（s2-1/s3-1 铁律），优势尽失。要调阻塞资源须显式走 `Schedulers.boundedElastic()`/业务 EventExecutorGroup 隔离。

### 5. 大文件/大响应通过 Netty HTTP 服务返回时，避免一次性把内容读进内存撑爆 OOM 的做法是（10分）

- A. 调大 -Xmx
- B. 用 ChunkedWriteHandler 流式分块写，或直接写 FileRegion（transferTo 零拷贝）
- C. 关掉 keep-alive
- D. 减小 SO_BACKLOG

> 答案：B
> 解析：ChunkedWriteHandler 让大内容分块写出、不整体缓冲；纯文件更应走 FileRegion/DefaultFileRegion（sendfile 零拷贝，s1-3）。与 JVM 堆大小无关。

### 6. 简答：设计一个支撑百万长连接终端的电力主站接入层（私有二进制协议 + 命令下发），综合本节与 s2/s3 给出 pipeline、线程与生产调优要点。（30分）

> 参考答案：
> - 要点：transport 用 native `EpollEventLoopGroup` + `EpollServerSocketChannel`；boss(accept) / worker(≈核数) 主从 Reactor（s1-2）；配合 `SO_REUSEPORT` 多进程分摊 accept（s3-2）。
> - 要点：pipeline = `IdleStateHandler(readerIdle≈3×上报周期)` 心跳清假死 → `LengthFieldBasedFrameDecoder`（按协议推 offset/lenLen/adjust/strip + maxFrameLength 防畸形）→ `CrcValidator` → 编解码(Protobuf/自定义) → 业务 dispatcher 挂 `DefaultEventExecutorGroup`（s2-1/s3-1，IO 线程不跑重活）。
> - 要点：命令下发用 `ChannelGroup`（按区域分组，s3-1）+ `isWritable`/WriteBufferWaterMark 背压，慢终端丢弃/降级/断开（s3-2）；海量超时用 HashedWheelTimer。
> - 要点：资源——ulimit -n/fs.file-max 提 fd、池化 ByteBuf + MaxDirectMemorySize 控内存、tcp_rmem/wmem 与 nf_conntrack 调优（networks/s4-1）；优雅发布先摘流量再 shutdownGracefully（s3-1）。
> - 要点：监控 pendingTasks/direct memory/CLOSE_WAIT/isWritable 命中/端到端 P99。
> - 加分：畸形/CRC 失败在 exceptionCaught 记日志+close（字节流不可信，s2-1）；私有协议禁用 Java 原生序列化（s2-3 安全）。
