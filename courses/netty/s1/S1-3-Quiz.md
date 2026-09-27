# Java NIO 三大件：Channel / Buffer / Selector · 小测验

### 1. 把数据从 buffer 写出到 channel 之前，正确的操作是（15分）

- A. `clear()`
- B. `flip()`
- C. `mark()`
- D. `rewind()` 之后再 `clear()`

> 答案：B
> 解析：写入 buffer 后 position 停在已写末尾，`flip()` 把 `limit=position; position=0`，切到读模式让 channel.write 从 0 读到 limit。`clear()` 是准备"再次写入"时用的，会丢弃可读区间。

### 2. 关于直接内存（DirectByteBuffer），错误的是（15分）

- A. 它分配在堆外（native 内存），IO 时可省一次堆↔堆外拷贝
- B. 它的大小受 `-Xmx` 直接约束，堆没满就不会 OOM
- C. 其 native 内存靠 `Cleaner`（虚引用）在对象被 GC 时释放，可能滞后
- D. 用 `-XX:MaxDirectMemorySize` 可显式设上限

> 答案：B
> 解析：直接内存不受 `-Xmx` 管，默认上限约等于最大堆但独立计量。堆压力小、GC 不勤时 native 内存迟迟不回收 → `OutOfMemoryError: Direct buffer memory`，且堆 dump 里看不到。

### 3.【多选】下列哪些是使用 JDK `Selector` 时的正确做法/已知坑（20分）

- A. 处理完 selectedKeys 里的 key 后要 `iterator.remove()`，否则会重复处理
- B. 应长期注册 `OP_WRITE`，以便随时能写
- C. 注册到 Selector 的 Channel 必须配置为非阻塞
- D. Linux 上 JDK Selector 有偶发"没事件也返回"的空轮询 bug，Netty 靠检测+重建 Selector 绕过

> 答案：ACD
> 解析：B 错。socket 发送缓冲通常一直可写，常驻 OP_WRITE 会让 select 立即返回、CPU 空转；只在有数据没写完时才注册、写完取消。A/C/D 均正确。

### 4. Kafka 高吞吐用到的"零拷贝"主要靠哪个 API（10分）

- A. `ByteBuffer.allocateDirect`
- B. `FileChannel.transferTo`（sendfile）
- C. `SocketChannel` 的 scatter/gather
- D. `MappedByteBuffer.get`

> 答案：B
> 解析：`transferTo`/sendfile 让文件数据全程待在内核直接送 socket，消除内核↔用户冗余拷贝。mmap 是另一种零拷贝（映射），但 Kafka 拉消息的主路径是 sendfile。

### 5. scatter/gather 的典型用途是（10分）

- A. 多线程并行读写同一 channel
- B. 把协议头、体放在不同 buffer，用一次 write 聚集发出（底层 writev），免手动合并拷贝
- C. 加密网络数据
- D. 压缩字节流

> 答案：B
> 解析：gather 写把多个 buffer 拼成一次输出、scatter 读把输入拆进多个 buffer，适合头/体分离，避免拷贝合并。Netty `CompositeByteBuf` 是其强化版。

### 6. 简答：为什么说"Netty 是逐个填 JDK NIO 的坑"？请列举至少三处 JDK NIO 的痛点，并说明 Netty 分别怎么解决。（30分）

> 参考答案：
> - 要点：`ByteBuffer` 单 position + flip/clear/compact 易错（半包/忘 flip 写出垃圾）→ Netty `ByteBuf` 用 readerIndex/writerIndex 双指针，无需 flip。
> - 要点：直接内存靠 GC 间接释放、易泄漏且监控盲区 → Netty 用引用计数（`retain/release`）+ `LEAK` 检测 + 池化 Allocator 显式管生命周期。
> - 要点：Selector 的 selectedKeys 需手动清、OP_WRITE 常驻 CPU 空转、JDK 空轮询 bug → Netty EventLoop 内部正确迭代、用 `isWritable`/`FlushConsolidationHandler` 管写、空轮询计数超阈值重建 Selector。
> - 要点：JDK 无内置编解码框架、无 `ChannelPipeline` 责任链 → Netty 提供 Pipeline + 各类编解码器（s2-1/s2-3）。
> - 加分：点出 Netty 还能用 native `epoll` transport 绕开 JDK NIO 的部分实现、并提供 `FileRegion` 封装零拷贝。
