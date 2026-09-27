# Netty 实战：HTTP 服务、RPC 与生态集成 · 面试题

> 收官题考"技术视野"：能不能把 Netty 放回整个后端生态解释"谁在用、为什么用、怎么用好"。也是把整包（IO 模型→Reactor→NIO→Netty 抽象→并发/背压→实战）串成一条线自证理解的机会。

## 考点 1：生态选型（为什么到处是 Netty）

**起手**：Dubbo、gRPC、WebFlux、ES、RocketMQ、网关都用 Netty，为什么？

**期望**：
- 成熟**主从 Reactor + epoll**（少量线程扛海量连接，s1-2）、**池化 ByteBuf + 引用计数**（省 GC/拷贝，s2-2）、**Pipeline + 丰富编解码器**（s2-1/s2-3）、**跨平台 transport**、**久经考验的稳定性**（空轮询绕过、LEAK 检测）。
- 自己基于 JDK NIO 造这套成本极高、坑极多（s1-3 的 flip/Selector bug/直接内存）。

**追问链**：
1. Kafka 用 Netty 吗？→ 客户端/ broker 用**自研 NIO selector**（非 Netty），但模型同源 —— 证明"掌握 Netty=掌握这类框架通用范式"，别说"所有中间件都用 Netty"。

## 考点 2：Netty 写 HTTP 服务

**起手**：用 Netty 实现 HTTP 文件服务要注意什么？

**期望**：
- `HttpServerCodec`（编解码）+ **`HttpObjectAggregator`(设上限)**（分块→FullHttpRequest）+ **`ChunkedWriteHandler`**（大响应流式写不 OOM）；大文件用 **`DefaultFileRegion`（transferTo 零拷贝）**。
- keep-alive 复用连接但处理应用层队头阻塞（networks/s3-1）、空闲回收（IdleStateHandler，s3-2）、回完再 `close`（`ChannelFutureListener.CLOSE`，别半关 s2-2）、路径穿越防护、`exceptionCaught` 兜底。

## 考点 3：自定义 RPC 的关联机制（Dubbo 原理）

**起手**：一个长连接上并发很多请求、响应乱序回来，怎么对应？

**期望**：
- 每请求带唯一 **requestId**；客户端维护 `requestId → Promise/Future` 表；`invoke` 写请求返回 Future，响应 handler 按 id `pending.remove(id).trySuccess(result)` 唤醒。
- 服务调用放 **业务线程池**（IO 线程不阻塞，s2-1）；超时用 **HashedWheelTimer/schedule**（s3-1/s3-2）；断连要把该连接所有 pending 置失败防泄漏。
- 异步用 `addListener` 不 `get()`（EventLoop 里 get 自锁，s3-1）。同 HTTP/2 stream 多路复用思想（networks/s3-2）。

## 考点 4：网关与非阻塞（架构题）

**起手**：Spring Cloud Gateway 为什么用 Reactor Netty？过滤器里能写阻塞代码吗？

**期望**：
- 前后端各一套 EventLoop 全非阻塞 → 几十线程 + 几百 MB 代理数万并发（对比 Zuul1 一请求一线程）。
- **过滤器内禁止阻塞**：阻塞会占死 EventLoop、把非阻塞退化回线程池模型（s2-1/s3-1）；要调阻塞资源走 `Schedulers.boundedElastic()`/业务 `EventExecutorGroup`。
- 背压贯通：下游慢 → `isWritable=false`（s3-2）→ 停止向后端 request → 一路传导到入口，网关不成 OOM 点。
- 常见事故：过滤器里 `restTemplate`（阻塞）→ 大促线程耗尽；正解 `WebClient`（Reactor Netty）。

## 考点 5：整包串线收官（送分也是送命）

**期望**（能背出这条主线即满分）：
1. **IO 模型**（s1-1）：多路复用(epoll)是事实标准。
2. **Reactor**（s1-2）：主从多 Reactor 让线程数与连接数解耦。
3. **NIO 的坑**（s1-3）：flip/直接内存/Selector bug/零拷贝 → Netty 逐个填。
4. **Netty 抽象**（s2-1~3）：EventLoop/Channel/Pipeline/Handler + ByteBuf 池化引用计数 + 编解码定界。
5. **并发与生产**（s3-1~3）：线程模型/Future/优雅关闭 + 心跳/背压/百万连接 + HTTP/RPC/生态实战。
- 一句话收尾：**Netty = 把易错脆弱的 JDK NIO，封成成熟稳定的 Reactor+epoll 高性能网络框架**，是现代 Java 后端网络层的事实底座。把 networks 分区的 TCP/HTTP/调优知识和它对上，就是完整的"从网线到进程"认知。
