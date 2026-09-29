# Netty 实战：HTTP 服务、RPC 与生态集成

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：用 Netty 实现 HTTP/1.1 服务与自定义协议的完整代码走查；Spring WebFlux/Reactor Netty、Dubbo/gRPC、Elasticsearch、Kafka 客户端、RocketMQ 为何选 Netty；网关（Spring Cloud Gateway）与业务线程模型的关系。

> 学到这里，抽象、内存、编解码、线程、背压都齐了。本节把 Netty 放回**真实工程**：一条完整的 HTTP 服务与一条自定义协议 RPC 的端到端代码走查，以及"为什么 Spring WebFlux / Dubbo / gRPC / Elasticsearch / Kafka / RocketMQ / 云原生网关都选 Netty 当底座"。看懂这些，你才真正理解 Netty 在后端技术栈里的位置（重要度 4/5，重点标准）

## 一、走查 1：一个最小但完整的 HTTP/1.1 服务

Netty 内置 HTTP 编解码（s2-3 第五节），实现文件服务/网关不用手撕报文：

```java
// 例子目的：搭一个最小完整的 HTTP/1.1 服务，展示内置编解码 pipeline 的正确装配
EventLoopGroup boss = new NioEventLoopGroup(1);
EventLoopGroup worker = new NioEventLoopGroup();      // 默认 2×核
try {
    ServerBootstrap b = new ServerBootstrap()
        .group(boss, worker)
        .channel(NioServerSocketChannel.class)
        .option(ChannelOption.SO_BACKLOG, 1024)
        .childOption(ChannelOption.SO_KEEPALIVE, true)
        .childHandler(new ChannelInitializer<SocketChannel>() {
            protected void initChannel(SocketChannel ch) {
                ch.pipeline()
                  .addLast(new HttpServerCodec())              // 请求解码+响应编码
                  .addLast(new HttpObjectAggregator(64*1024))  // 聚合成分块→FullHttpRequest
                  .addLast(new ChunkedWriteHandler())          // 大文件/流式写不撑爆内存
                  .addLast(new HttpBizHandler());              // 业务：跑在 EventLoop 或业务组
            }
        });
    Channel sc = b.bind(8080).sync();
    sc.closeFuture().sync();
} finally {
    boss.shutdownGracefully(); worker.shutdownGracefully();   // 优雅关闭 s3-1
}
// 正确使用结果：能收发 HTTP/1.1 请求，大响应流式写不撑爆内存
// 错误用法：HttpObjectAggregator 不设上限（传巨大值）→ 恶意超大报⽂把内存堆爆（必须给合理 MAX）
```

```java
// 例子目的：处理 keep-alive 语义——回完该关的连接再关，不踩半关
class HttpBizHandler extends SimpleChannelInboundHandler<FullHttpRequest> {
    protected void channelRead0(ChannelHandlerContext ctx, FullHttpRequest req) {
        boolean keepAlive = HttpUtil.isKeepAlive(req);                 // HTTP/1.1 默认长连接 s3-1(networks)
        FullHttpResponse resp = buildResponse(req);                    // 业务处理
        resp.headers().set(HttpHeaderNames.CONNECTION,
                keepAlive ? HttpHeaderValues.KEEP_ALIVE : HttpHeaderValues.CLOSE);
        resp.headers().setInt(HttpHeaderNames.CONTENT_LENGTH, resp.content().readableBytes());
        ChannelFuture f = ctx.writeAndFlush(resp);
        if (!keepAlive) f.addListener(ChannelFutureListener.CLOSE);    // 回完再关，不踩半关（networks/s2-2）
    }
    // keep-alive 下的空闲连接回收靠 IdleStateHandler（s3-2），HTTP 层超时靠读空闲
    // 错误用法：不分 keep-alive 与否都写完就 close → 长连接退化成每请求重建 TCP，吞吐骤降
    // 错误用法：忘了设 CONTENT_LENGTH → 客户端不知道响应边界而一直等/挂死
}
```
**要点**：`HttpObjectAggregator` 上限必设（防大包）、`ChunkedWriteHandler` 让大响应流式写不 OOM、**keep-alive 复用连接**（HTTP/1.1）→ 但要处理**应用层队头阻塞**（一条 pipeline 上的请求串行，networks/s3-1）、以及空闲连接回收。

## 二、走查 2：一条自定义协议 RPC（Dubbo 的迷你版）

RPC = 长连接 + 自定义二进制协议 + 请求/响应关联（`requestId`）+ 异步 future。串起全包知识：

```java
// 例子目的：用 requestId + Promise 表把乱序到达的响应关联回各自的异步调用
// —— 协议帧（s2-3）——
// [magic 2B][totalLen 4B][flag/type 1B][requestId 8B][bodyLen 4B][序列化 body]
// 定界：new LengthFieldBasedFrameDecoder(MAX, offsetOf(totalLen), 4, lenAdjust, 0)

// —— 服务端 pipeline ——
ch.pipeline()
  .addLast(new IdleStateHandler(15*1000,0,0))         // 心跳保活（s3-2）
  .addLast(new LengthFieldBasedFrameDecoder(MAX, 2, 4, 4, 0)) // 定界（s2-3）
  .addLast(new RpcDecoder())                          // 字节→RpcMessage（Protobuf/JSON，s2-3）
  .addLast(bizGroup, new RpcDispatcherHandler());     // 反射调本地服务，跑在业务线程池（s2-1/s3-1）

// —— 客户端：请求-响应异步关联 ——
class RpcClient {
    final Map<Long, Promise<RpcResult>> pending = new ConcurrentHashMap<>();
    public Future<RpcResult> invoke(RpcRequest req) {
        Promise<RpcResult> p = channel.eventLoop().newPromise();
        pending.put(req.id(), p);                     // requestId → Promise
        channel.writeAndFlush(req).addListener(f -> { if(!f.isSuccess()) p.tryFailure(f.cause()); });
        return p;                                     // 调用方 addListener，绝不阻塞 EventLoop（s3-1）
    }
}
// 收到响应 handler：按 requestId 取出 Promise，setSuccess(result) → 唤醒等待方
// 正确使用结果：一条多路复用连接上并发多个 RPC，响应乱序也能靠 id 准确回填各自 Promise
// 错误用法：invoke 中 writeAndFlush 失败却不清理 pending 表→ 该 requestId 的 Promise 永挂→ 内存泄漏 + 调用方永不返回（需超时 tryFailure）
// 错误用法：把 RpcDispatcherHandler 里的服务调用直接跑在 EventLoop → 一次慢调用卡住该事件环所有 RPC 连接（应挂 bizGroup）
```
关键设计：
- **`requestId` + `Promise` 表**把"多路复用的乱序响应"关联回各自的调用（呼应 networks/s3-2 HTTP/2 的 stream 思想）。
- 服务调用放 **`bizGroup`（DefaultEventExecutorGroup）**，IO 线程只做收发编解码（s2-1 铁律）。
- 超时用 `HashedWheelTimer`/`schedule` 给每个 pending 挂定时，到点 `tryFailure(TimeoutException)`（s3-1 精度、s3-2 海量定时）。

## 三、生态盘点：为什么它们都选 Netty

| 框架/中间件 | 用 Netty 做什么 | 为什么 |
|---|---|---|
| **Spring WebFlux / Reactor Netty** | 响应式非阻塞 HTTP 服务器/客户端底座 | 少量 EventLoop 线程扛高并发、与 Reactor 背压模型天然契合（`isWritable`↔`request(n)`） |
| **Dubbo** | 默认网络层（Netty 传输 + 自定义协议） | 长连接、多路复用、异步 future、自定义二进制协议 —— 正是上面走查 2 |
| **gRPC-Java** | Netty transport（HTTP/2 之上） | 需要 HTTP/2 多路复用/头压缩，Netty 提供最成熟的 Java H2 实现 |
| **Elasticsearch / Kafka（部分）/ Spark** | 节点间 RPC transport | 高吞吐、低延迟、跨节点长连接 |
| **Kafka 客户端/服务端** | 老版本 NIO selector；客户端 0.10+ 用自研 NIO（非 Netty），思想一致 | 说明"掌握 Netty 模型"可迁移读任何 NIO 框架源码 |
| **RocketMQ** | NameServer/Broker/remoting 基于 Netty | 自定义协议 + 长连接 + 异步，同走查 2 |
| **Spring Cloud Gateway** | 底座 Reactor Netty | 网关要非阻塞代理海量连接 |
| **Redisson / Cassandra / HBase client** | 异步 IO 通信层 | 同上 |

> **共同理由**：① 成熟的**主从 Reactor + epoll**（s1-2）；② **ByteBuf 池化 + 引用计数**（s2-2）省 GC；③ **Pipeline + 丰富编解码器**（s2-1/s2-3）；④ **跨平台 transport**（NIO/epoll/kqueue）；⑤ 久经考验的**稳定性**（空轮询 bug 绕过、内存泄漏检测）。自己基于 JDK NIO 造这套，成本极高、坑极多（s1-3）。

## 四、网关与业务线程模型的关系（架构级串联）

Spring Cloud Gateway / 自研网关的典型链路：

```
客户端 ─(Reactor Netty 前端 EventLoop)─▶ 路由/鉴权/限流 ─(Reactor Netty 后端 client EventLoop)─▶ 上游服务
                                              │
                                        业务/过滤链（应尽量非阻塞）
```
- **前后端各一套 EventLoop**：网关把"入站连接"与"回源连接"分离，各自少量 EventLoop 扛海量连接 —— 全非阻塞时，**几百 MB 内存 + 几十个线程即可代理数万并发**（对比 Zuul1 的"一请求一线程阻塞"）。
- **红线**：网关过滤器里**绝不能同步阻塞**（同步 HTTP 客户端、锁、慢计算）→ 一旦阻塞就退化成"线程池模型"，Non-blocking 优势全失、EventLoop 被占（s2-1/s3-1）。要调阻塞资源就用 `Schedulers.boundedElastic()`（Reactor）/业务 `EventExecutorGroup`（Netty）隔离。
- **背压贯通**：下游慢 → Reactor Netty `isWritable=false`（s3-2）→ 停止向后端 `request`，把压力一路传导到入口，避免网关成为 OOM 点。

## 五、三大行业场景钩子

- **电商**：Spring Cloud Gateway 扛南北向流量（Reactor Netty 全非阻塞 + 限流/鉴权），后端调用超时/熔断用 Resilience4j；若过滤器里有人写 `restTemplate.getForObject`（阻塞）→ 大促直接线程耗尽，正解是 `WebClient`（也是 Reactor Netty）。
- **金融**：内部 RPC 走 Dubbo(Netty) —— 正是走查 2 的 requestId+Promise 模型；跨机房大文件对账用 Netty `FileRegion`/transferTo 零拷贝（s1-3）；网关强制 mTLS（networks/s3-3）在 SslHandler 层落地。
- **电力**：主站↔终端私有协议 = 定长/长度字段帧 + CRC（s2-3）+ 心跳（s3-2）；百万终端长连接用 epoll + SO_REUSEPORT 多进程（s3-2）；批量下发用 ChannelGroup（s3-1）+ 背压。

## 六、要点回顾

1. **HTTP 服务**：`HttpServerCodec + HttpObjectAggregator(上限) + ChunkedWriteHandler`；处理 keep-alive 复用、应用层 HOL、空闲回收、回完再 close。
2. **自定义 RPC**（Dubbo/RocketMQ 同款）：`IdleStateHandler → LengthFieldBasedFrameDecoder → 编解码 → 业务组 dispatcher`；**requestId + Promise 表**做异步多路复用关联；超时用时间轮。
3. **生态选择 Netty 的理由**：成熟 Reactor+epoll、池化 ByteBuf、Pipeline 编解码、跨平台 transport、久经考验的稳定性 —— 自己造 NIO 成本极高。
4. **网关**：前后端两套 EventLoop、全链路非阻塞才高效；**过滤器内禁止阻塞**（否则退化线程池模型）；背压从下游一路传到入口。
5. 本节是 netty 包的收官，也是"IO 模型→Reactor→NIO→Netty 抽象→并发/背压→实战"整条主线的落地终点。
