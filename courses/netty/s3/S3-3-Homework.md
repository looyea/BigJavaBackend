# Netty 实战：HTTP 服务、RPC 与生态集成 · 课后作业

> 两题各 50 分：一题端到端实现一个 Netty 静态文件 HTTP 服务并压测调优，一题实现一个 requestId+Promise 的迷你 RPC。

## 作业 1：Netty 静态文件 HTTP 服务 + 压测（50 分）

**要求**：
1. 用 `HttpServerCodec + HttpObjectAggregator + ChunkedWriteHandler` 实现一个文件服务器：GET 返回 `/data` 下文件，正确设 `Content-Type`、`Content-Length`（或 chunked）、`Connection: keep-alive`。
2. **大文件用 `DefaultFileRegion`（transferTo 零拷贝）** 返回，小文件用普通 ByteBuf；对比两种下 CPU 与吞吐。
3. 处理：404、非法路径穿越（`../`）防护、HEAD、Range 可不做但要说明；keep-alive 空闲连接用 `IdleStateHandler` 超时关闭。
4. 用 `wrk`/`ab` 压测，报 QPS、P99、CPU；调 worker EventLoop 数观察变化，验证"EventLoop≈核数后不再线性提升"。

**验收标准**：
- 文件能被浏览器/curl 正确下载，Content-Type/长度对、keep-alive 复用（一条连接多请求）。
- 给出 FileRegion vs 普通写的 CPU 对比，解释 sendfile 省拷贝（s1-3）。
- 有路径穿越防护与聚合上限；说清 HTTP/1.1 keep-alive 的应用层队头阻塞（networks/s3-1）。

**参考答案要点**：
- `pipeline` 顺序不可乱；404/异常在 `exceptionCaught` 兜底并 close（字节流不可信）。
- 大响应别整体 read 进内存；keep-alive 回完再按需 close（`ChannelFutureListener.CLOSE`）。

## 作业 2：requestId + Promise 的迷你 RPC（50 分）

**要求**：
1. 定义协议帧 `[magic 2B][totalLen 4B][requestId 8B][bodyLen 4B][body(Protobuf/JSON)]`，推导并实现 `LengthFieldBasedFrameDecoder` + 编解码（s2-3）。
2. 服务端：收到请求在 `DefaultEventExecutorGroup` 里"处理"（sleep 模拟耗时）后按 requestId 回响应（s2-1/s3-1）。
3. 客户端：`ConcurrentHashMap<Long, Promise<Result>> pending`，`invoke` 返回 Future、`addListener` 取结果；**并发发 100 个请求验证乱序响应能正确关联回各自 future**。
4. 加超时：每个 pending 挂 `HashedWheelTimer`/`schedule`，到点 `tryFailure(Timeout)` 并移除；服务端加 `IdleStateHandler` 心跳。

**验收标准**：
- 100 并发请求响应 id 一一对应、无错配（打印 requestId 校验）。
- 慢请求超时被正确 `tryFailure` 且从 pending 清理，不泄漏。
- 能对比"阻塞式（每调用等future.get）vs 异步（addListener）"对客户端线程占用的差异。

**参考答案要点**：
- 关联机制 = requestId→Promise，响应 handler `pending.remove(id).trySuccess(...)`（呼应 Dubbo，s3-3）。
- 客户端 `future.get()` 若在 EventLoop 线程会自锁（s3-1）→ 异步用 addListener；同步版必须在业务线程调用。
- 断连/异常要把该连接所有 pending 置失败，避免悬挂泄漏（呼应优雅关闭）。
