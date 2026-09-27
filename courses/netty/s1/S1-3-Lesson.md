# Java NIO 三大件：Channel / Buffer / Selector · 讲义

> 前两节讲清了"模型层"（多路复用 + Reactor）。本节往下沉一层，看 **Java 到底用什么 API 把这些模型落地**：`Channel`（双向通道）、`Buffer`（数据容器）、`Selector`（多路复用的入口）。这三件是理解 Netty 一切抽象（ByteBuf、EventLoop、Channel）的前身 —— Netty 没有另起炉灶，而是**把 JDK NIO 的坑逐一填了**。学完你要能解释：为什么 `flip()` 是新手噩梦、直接内存为什么会 OOM、以及 Kafka 怎么用 `transferTo` 做到零拷贝。（重要度 4/5，重点标准）

## 一、三大件的世界观：面向流 → 面向缓冲

- **BIO（java.io）是"面向流（Stream）"**：`InputStream` 单向、字节一路读过去，不能来回改，读了就没了。
- **NIO（java.nio）是"面向缓冲（Buffer）"**：数据先填进 `Buffer`，你在 Buffer 里**随机读写**（get/put、移动 position），方向由 `Channel` 承载。

一次网络读的形状：`channel.read(buffer)` —— 内核把数据**拷进** buffer；一次写：`channel.write(buffer)` —— 把 buffer 内容拷出去。**注意这仍是"一次拷贝"**（内核↔用户），它没有变零拷贝；零拷贝是后面 FileChannel 的话题。

## 二、ByteBuffer：三个指针 + flip 法则（新手坟场）

`ByteBuffer` 的核心是三个位置量（还有 mark 少用）：

```
0 ≤ position ≤ limit ≤ capacity
```
- **capacity**：数组总大小，固定。
- **limit**：读模式下 = "可读到此"；写模式下 = "可写到此"。
- **position**：下一次读/写的起点。

**读→写→读 的切换全靠 flip/clear/compact 摆正 limit 和 position**：

| 操作 | 效果 | 何时用 |
|---|---|---|
| `put()`（写） | position 前进 | 往 buffer 塞数据 |
| **`flip()`** | `limit=position; position=0` | 写完**准备读出来**（如 read 进 buffer 后交给 channel.write） |
| `clear()` | `position=0; limit=capacity` | 读完后**清空重写**（丢弃旧数据） |
| `compact()` | 把未读区间挪到开头，后面接着写 | 半包/还没读完，要**保留残留再追加** |
| `mark()/reset()` | 记位置/回到 mark | 需回退重读一小段 |
| `slice()/duplicate()` | 共享内容的独立指针视图 | 零拷贝切片传给下游 |

**最容易错的场景**：循环读 socket

```java
buf.clear();                       // 每次读前清空，否则上轮残留挤占空间
while (in.read(buf) != -1) {       // 读满/读到 -1
    buf.flip();                    // ← 关键：切到读模式，limit 指向刚写入的末尾
    out.write(buf);                // 消费
    buf.compact();                 // ← 不是 clear！保留没读完的半包，准备追加
}
buf.flip();                        // 收尾再 flip 一次处理最后残留
```
忘了 `flip` → 写出的是 position 之后的垃圾/空；用 `clear` 代替 `compact` → 半包被丢。**Netty 的 `ByteBuf` 干脆拆成 readerIndex / writerIndex 两个独立指针（s2-2），从设计上消灭了 flip。** 这是它相对 JDK NIO 的第一大改良。

## 三、堆缓冲 vs 直接内存：为什么会有 `OutOfDirectMemoryError`

- **HeapByteBuffer**：数据在 JVM 堆里。IO 读写时，JDK 要把堆内容**先拷到一块临时的堆外直接内存**再传给内核（因为堆可能被 GC 移动，内核不能引用会被移动的地址）→ **多一次拷贝**。
- **DirectByteBuffer**（`allocateDirect`）：直接在**堆外（native 内存）**分配，内核可直接读写它，省一次拷贝，网络/文件 IO 性能更好。Netty 默认大量用直接内存 + 池化（s2-2）。

**坑**：直接内存**不受 `-Xmx` 管**，默认上限约等于最大堆。它靠 `Cleaner`（虚引用）在对象被 GC 时释放 native 内存。若你狂建 DirectByteBuffer 但堆压力不够、GC 不勤 → native 内存迟迟不回收 → **`OutOfMemoryError: Direct buffer memory`**，且 heap dump 里看不到（因为它在堆外）。排查：`-XX:MaxDirectMemorySize` 显式设限、`NMT`、Netty 的 `PlatformDependent.usedDirectMemory()`。

> 一句话：**直接内存快在"少一次堆↔堆外拷贝"，贵在"生命周期靠 GC 间接管理、容易泄漏且监控盲区"。** 所以 Netty 用引用计数（`release()`）显式管它，而不交给 GC（s2-2）。

## 四、scatter / gather：一个 buffer 队列 ↔ 一个 channel

- **分散读 scatter**：`channel.read(ByteBuffer[] bs)` —— 把到来的字节**依次填满**数组里多个 buffer。
- **聚集写 gather**：`channel.write(ByteBuffer[] bs)` —— 把多个 buffer **拼接**成一次写出。

用途：**协议头/体分离**不用手动拷贝合并 —— header 一个 buffer、body 一个 buffer，`write(new[]{header, body})` 一次发出（内部靠 `writev` 系统调用）。这也是 `FileChannel.transferTo` 零拷贝的底层亲戚。Netty 的 `CompositeByteBuf`（s2-2）把"逻辑上拼多个 buf、物理上不拷贝"做到了极致。

## 五、Selector：多路复用的 Java 入口 + 三个经典陷阱

```java
Selector sel = Selector.open();
ssc.configureBlocking(false);                 // ① 注册到 Selector 的 channel 必须非阻塞
ssc.register(sel, SelectionKey.OP_ACCEPT);    // ② 关心 accept 事件

while (true) {
    sel.select();                             // ③ 阻塞直到有事件（可带超时）
    Iterator<SelectionKey> it = sel.selectedKeys().iterator();
    while (it.hasNext()) {
        SelectionKey k = it.next();
        it.remove();                          // ④ 必须手动移除！否则下轮重复处理
        if (k.isAcceptable()) { ... }
        else if (k.isReadable())  { ... }
    }
}
```

**三大陷阱（面试与线上都常考）**：
1. **selectedKeys 不清理会累积**：处理完必须 `iterator.remove()`，否则旧 key 反复被处理（Netty 内部已正确处理，这正是它替你填的坑）。
2. **`OP_WRITE` 不能常驻注册**：socket 发送缓冲通常一直"可写"，一直注册 OP_WRITE → `select` 立即返回 → **CPU 100% 空转**。只在有数据要写且上次没写完时才注册，写完立刻取消（Netty 用 `Channel.isWritable()` + `FlushConsolidationHandler` 管理，s3-2）。
3. **空轮询 bug（JDK epoll 经典）**：Linux 上 `Selector.select()` 偶发**没事件也返回**（`wakeup` 自触发/`EPOLLERR` 相关），老代码若写成 `select()>0 才处理` 会漏、写成 `while(true)` 会空转 CPU。JDK 长期有此 bug，Netty 专门写了 `NioEventLoop` 的**空轮询检测 + 重建 Selector** 逻辑（`SELECTOR_REBUILD`）绕过它 —— 这是 Netty 存在价值的又一注脚。

> 注册陷阱补充：一个 Channel 同一时刻只能被**一个** Selector 注册、且只能被**一个线程**处理 —— 这正是 s1-2"一个 Channel 绑一个 EventLoop"在 JDK API 层的物理原因。

## 六、零拷贝：mmap 与 transferTo（Kafka 为什么快）

"零拷贝"指**消除"内核缓冲区 ↔ 用户缓冲区"之间的冗余拷贝**（DMA 把磁盘↔内核缓冲、内核↔CPU 是硬件的，主要砍 CPU 参与的那几次）。传统"读文件发网络"要 4 次拷贝 + 2 次上下文切换：

```
磁盘 --DMA--> 内核页缓存 --CPU拷贝--> 用户buf --CPU拷贝--> socket缓冲 --DMA--> 网卡
```

- **`FileChannel.map()`（mmap）**：把文件直接映射进用户地址空间，省掉"内核→用户"那次拷贝；适合**随机访问/反复读同一段**（如索引、消息日志段）。风险：映射的页被换出/文件被外部截断会 `SIGBUS`。
- **`FileChannel.transferTo()/transferFrom()`（sendfile）**：数据**全程待在内核**，从文件直接送到 socket，用户态几乎不参与 → 4 次拷贝降到 **2 次 DMA、0 次 CPU 拷贝**。**Kafka 的高吞吐核心就是它**：消费端拉消息用 `transferTo` 把 `.log` 段文件零拷贝发到 socket，配合**顺序写 + 页缓存 + 批量**扛住海量吞吐。
- **Netty 对应 API**：`FileRegion`（封装 `transferTo`）用于传文件；`DefaultFileRegion` 让 HTTP 文件服务/回放不走用户态拷贝。

## 七、三大行业场景钩子

- **电商**：商品图片/静态资源服务若用 Netty，走 `FileRegion`/`transferTo` 零拷贝发文件，CPU 不卡在拷贝上；大促网关用池化直接内存（Netty 默认）降 GC 抖动，但要盯 `MaxDirectMemorySize` 防堆外 OOM。
- **金融**：行情/流水的**顺序落盘**用 `FileChannel` + mmap/`force()`；对账批量传大文件用 sendfile 零拷贝。直接内存泄漏在长跑的行情网关里是隐形炸弹 → 用 Netty 引用计数 + `LEAK` 日志监控（s2-2）。
- **电力**：终端上报的小报文聚合用 scatter/gather 把"报文头 + 多个数据点 buf"一次写出，省合并拷贝；嵌入式 JVM 上直接内存配额要显式设，避免默认值把 native 堆撑爆。

## 八、要点回顾

1. NIO 从"面向流"转"面向缓冲"；`Channel` 双向、`Buffer` 随机读写、`Selector` 多路复用入口。一次 read/write 仍有一次内核↔用户拷贝。
2. **ByteBuffer 三指针 + flip 法则**是 JDK NIO 最大 usability 坑；Netty `ByteBuf` 用读写双指针消灭 flip（s2-2）。
3. **直接内存**省一次堆↔堆外拷贝但**不受 -Xmx 管、靠 GC 释放、监控盲区 → 易 OOM**；Netty 用引用计数显式管。
4. **scatter/gather**：头/体分离不手动合并，底层 `writev`。
5. **Selector 三陷阱**：selectedKeys 要手动清、OP_WRITE 别常驻（CPU 空转）、JDK 空轮询 bug（Netty 重建 Selector 绕过）。
6. **零拷贝**：`mmap`（映射，随机读）与 `transferTo/sendfile`（全程内核，Kafka 命根子）；Netty 用 `FileRegion`。
