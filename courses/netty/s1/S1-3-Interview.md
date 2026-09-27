# Java NIO 三大件：Channel / Buffer / Selector · 面试题

> NIO 基础题看似"背 API"，实则考你有没有真踩过坑、懂不懂 Netty 存在的理由。答好要能：讲清 flip、说透直接内存 OOM、列出 Selector 三坑、并解释零拷贝为什么 Kafka/Netty 在乎。

## 考点 1：ByteBuffer 的 position/limit/capacity 与 flip

**起手**：`flip()` 到底改了什么？为什么读写切换必须它？

**期望**：
- 三量 `0 ≤ position ≤ limit ≤ capacity`。写模式 position 随 put 前进；要转为读时 `flip()`：`limit=position; position=0`，让读从 0 到"刚写到哪"。不 flip 直接读会读到未初始化区/位置错位。
- `clear()`（准备重新写，丢旧数据）vs `compact()`（保留未读、后面追加，处理半包）。

**追问链**：
1. Netty 为什么不用这套？→ `ByteBuf` 拆 `readerIndex/writerIndex` 双指针，读只动 reader、写只动 writer，无需 flip，天然少一大类 bug。

## 考点 2：直接内存与 OOM

**起手**：`allocateDirect` 和堆内 buffer 区别？为什么会有堆外 OOM？

**期望**：
- 直接内存在堆外，内核可直读写、省"堆↔堆外"一次拷贝（堆 buffer 做 IO 时 JDK 也要临时拷到堆外，因为堆会被 GC 移动）。
- 不受 `-Xmx` 管，默认上限≈最大堆；靠 `Cleaner`（虚引用）在 GC 时释放 native 内存 → **堆压力不足/GC 不勤 → 回收滞后 → `OutOfMemoryError: Direct buffer memory`**，且 heap dump 看不到。
- 治理：`-XX:MaxDirectMemorySize` 显式设限、池化复用、Netty 引用计数 `release()` 主动释放（而非交给 GC）。

**追问链**：
1. 为什么 Netty 偏爱池化直接内存？→ 省反复向 OS 申请/释放 native 内存的开销与 GC 不确定性（jemalloc 式分代，s2-2）。

## 考点 3：Selector 使用陷阱（经验题）

**起手**：手写 JDK NIO 服务端，哪些地方最容易出线上事故？

**期望（三坑）**：
1. `selectedKeys` 遍历后不 `remove()` → 事件累积、重复处理。
2. 常驻注册 `OP_WRITE` → 发送缓冲通常一直可写 → select 立即返回 → **CPU 100% 空转**；应"要写且没写完才注册、写完取消"。
3. **JDK 空轮询 bug**（Linux）：`select()` 偶发无事件返回 → 空转；Netty `NioEventLoop` 计空轮询次数超阈值就**重建 Selector** 绕过。

**追问链**：
1. 一个 Channel 能被多个 Selector/线程处理吗？→ 不能，一个 Channel 同一时刻只注册一个 Selector、一个线程 → 是"一个 Channel 绑一个 EventLoop"的 API 层原因（s1-2）。

## 考点 4：零拷贝（高频深挖）

**起手**：Kafka/Netty 常说的零拷贝是什么？mmap 和 sendfile 区别？

**期望**：
- 目标：消除"内核缓冲 ↔ 用户缓冲"的冗余 CPU 拷贝与传统 read+write 的 4 拷贝/2 切换。
- **`transferTo`/sendfile**：数据全程在内核，文件→socket，0 次 CPU 拷贝（配合网卡 scatter-gather）→ 适合"顺序整段转发"，Kafka 消费端拉消息的核心。
- **`mmap`/`FileChannel.map`**：文件映射进用户地址空间，省"内核→用户"一次拷贝，可随机访问 → 适合反复读同一段；风险 SIGBUS（页被换出/文件被截断）。

**追问链**：
1. Netty 里哪用零拷贝？→ `DefaultFileRegion`（封 transferTo）做文件服务；`CompositeByteBuf`/`slice` 做"逻辑合并/切片但物理不拷贝"。
2. 广义零拷贝还包括？→ 用户态避免多余拷贝（如把解析出的字节直接传给下游 handler 不再复制），Netty Pipeline 的 ByteBuf 传递即属此思路。

## 考点 5：收尾 —— Netty 到底替 JDK NIO 做了什么

**期望**（把整节收口成一句价值主张）：
- flip 之痛 → 双指针 ByteBuf；直接内存 GC 之痛 → 池化 + 引用计数；Selector 三坑 → EventLoop 内部正确迭代 + isWritable 管写 + 空轮询重建；无编解码框架 → Pipeline + 帧解码器；跨平台 → NIO/epoll/kqueue transport。
- 一句话：**Netty = 把易错、易泄漏、有 bug 的 JDK NIO，封成"好用、高性能、稳定"的高层框架。** 这题答出来，s1 三节就串起来了。
