# ByteBuf、内存模型与引用计数 · 讲义

> 上一节 s1-3 我们看到 JDK `ByteBuffer` 的三大痛点：单 position + flip、直接内存靠 GC 管易泄漏、无池化反复向 OS 申请。Netty 用自己的 **`ByteBuf`** 一次性解决，代价是引入了**手动引用计数**这套"心智负担"。本节讲透 ByteBuf 的读写双指针、池化 + jemalloc 分代的内存分配器、以及最劝退也最关键的**泄漏定位**。（重要度 4/5，重点标准）

## 一、ByteBuf vs ByteBuffer：读写双指针消灭 flip

JDK ByteBuffer 一个 `position` 兼具读写含义，靠 flip 切换，易错。Netty ByteBuf **拆成两个独立指针**：

```
 +------------------+------------------+------------------+
 |   已读区(丢弃)    |    可读区         |    可写区         |
 +------------------+------------------+------------------+
 0        <=   readerIndex   <=   writerIndex   <=   capacity
```
- **读操作**（`readByte`/`readBytes`）只推进 **readerIndex**；**写操作**（`writeByte`）只推进 **writerIndex**。互不干扰 → **无需 flip**。
- 可读字节数 = `writerIndex - readerIndex`（`readableBytes()`）。
- `clear()` 把两个指针都归零（复用整块）；`markReader()/resetReader()` 可回退；`slice()/copy()`：`slice` 是**共享底层存储的视图**（零拷贝），`copy` 才是深拷贝。

**四种典型 buf**：

| 维度 | 选项 | 说明 |
|---|---|---|
| 存储位置 | **堆（heap）** / **堆外（direct/native）** | direct 省 IO 一次拷贝（s1-3），Netty 默认偏 direct |
| 分配方式 | **非池化（unpooled）** / **池化（pooled）** | 池化复用内存块，省申请/释放与 GC 抖动 |

`UnpooledByteBufAllocator`（测试/临时）、`PooledByteBufAllocator`（生产默认）。`ServerBootstrap.option(ChannelOption.ALLOCATOR, PooledByteBufAllocator.DEFAULT)`。

## 二、池化分配器：jemalloc 的分代 + chunk/page

`PooledByteBufAllocator` 借鉴 **jemalloc**，核心是**分级 + 每线程缓存**，目标：高频小 buf 的分配/释放**不碰全局锁、不打 OS、不惊动 GC**。

```
PoolArena（默认 2×CPU 核数，线程取模绑一个 arena，减少争用）
  ├─ Chunk（默认 16 MB）：向 OS 申请的大块，用伙伴算法(buddy)管理页
  │    └─ Page（8 KB）：中间/大尺寸分配的单位
  ├─ SmallSubpage：把 page 切成 64B/128B/… 给小 buf 复用
  ├─ Normal  尺寸：走 page/chunk（如 ≤ 28MB）
  ├─ Huge   尺寸：直接单独分配 chunk
  └─ ThreadLocalCache（per-thread）：tiny/normal 缓存，线程内直接拿，无锁
```
- **arena 分摊锁竞争**、**threadLocalCache 让常见尺寸分配几乎无锁**、**chunk+page+subpage 分级复用**减少碎片。
- 尺寸档位（small/normal/huge）决定走哪条复用路径；理解它才明白"为什么 Netty 大量小 buf 也不慢"。
- **池化的另一收益**：池化 direct 内存的回收走 Netty 自己的计数，**不依赖 GC 时机**，缓解 s1-3 说的"直接内存 OOM 靠 GC 滞后释放"问题。

## 三、引用计数：把生命周期从 GC 手里夺回来（本节的魂）

池化内存必须**显式归还**，否则复用无从谈起。Netty 给 ByteBuf 加**引用计数**（`ReferenceCounted`）：

- 新建 buf `refCnt = 1`；`retain()` +1；`release()` -1；**降到 0 → 归还给池 / 释放 native 内存**。
- 规则（谁最后持有谁负责 release）：**你 `alloc()`/收到的 buf，用完必须 `release()`**；把 buf 交给下游（`fireChannelRead`）就把**释放责任转移**给下游。

**为什么"IO 线程免锁"这里帮不上？** buf 可能被**跨线程**传递（如从 EventLoop 交到业务线程处理），`refCnt` 用 `AtomicIntegerFieldUpdater` 保证原子；但更根本的纪律是：**别把已 release 的 buf 再传给别的线程用**。

**Pipeline 的自动 release 帮了大忙**（呼应 s2-1）：
- 入站消息传到 **TailContext** 若无人消费 → 自动 `ReferenceCountUtil.release(msg)`。
- **编码器/写出**：`writeAndFlush` 成功后 Netty 会 release 出站 buf（ByteBuf 写出即被回收）。
- 所以**大多数"读进来→解码→写出去"的正常路径你不用手动 release**；需要手动的是：你**中途截留**了 msg（`retain()` 后又得自己 `release()`）、或用了 `Unpooled`/`alloc` 自建的 buf、或在 `channelRead` 里没往下传也没写完。

## 四、泄漏检测与定位：LEAK 日志

漏 release = **内存泄漏**（池化内存不归还、direct 内存不 free），长跑必炸。Netty 有分级泄漏检测（`-Dio.netty.leakDetection.level`）：

| 级别 | 开销 | 行为 |
|---|---|---|
| `DISABLED` | 无 | 关闭 |
| `SIMPLE`（默认） | 低 | 采样记录访问点，报告"可能泄漏"但不给创建栈 |
| `PARANOID` | 高 | **每次**都记录采样，报告泄漏 buf 的**创建 + 访问两条栈** |
| `ADVANCED` | 中 | 对命中采样的记录完整栈 |

- 现象：日志出现 `LEAK: ByteBuf.release() was not called before it's garbage-collected. ... Recent access records:` → 说明某 buf 被 GC 时 refCnt 仍 >0（泄漏）。
- **排查打法**：测试/预发环境把 level 调 `PARANOID` 复现 → 拿到创建栈定位"谁 alloc 没 release"；生产保持 `SIMPLE` 或按需采样（PARANOID 太贵）。
- 定位代码套路：`ResourceLeakDetector`；业务里包 `try { ... } finally { buf.release(); }` 或用 `ReferenceCountUtil.release(obj)`。

> 关键认知：**LEAK 报的是"被 GC 才发现没 release"，是滞后信号**，且依赖采样。所以正确性不能只靠它兜底，要养成"谁截留谁 release + finally"的纪律。

## 五、CompositeByteBuf：逻辑拼接、物理零拷贝

场景：把"header buf + body buf"合并成一个再往下传。传统做法新建大 buf 把两者 `copy` 进去 = 一次内存分配 + 拷贝。**`CompositeByteBuf.addComponents(true, header, body)`** 只是把多个 buf **组成一个逻辑视图**（内部维护组件列表），`readerIndex/writerIndex` 跨组件移动，**数据不搬运**：
- 省拷贝、省内存，是 scatter/gather（s1-3）在用户态的对应物。
- 注意：Composite 也参与引用计数，`release` 会释放各组件；需要实体化时 `copy()`/`compress()` 才变成单个 buf。

## 六、三大行业场景钩子

- **电商**：大促网关每秒百万 msg，`PooledByteBufAllocator` + arena 数≈核数是默认性能底盘；曾因某 handler `retain()` 后异常分支漏 `release()`，池化内存不归还，RSS 缓慢爬升数小时 OOM —— 靠预发 `PARANOID` 复现 + finally 修。
- **金融**：行情快照大 buf 高频广播，`CompositeByteBuf` 把"帧头 + 变长 payload"零拷贝拼装给上万订阅连接，省掉上万次 payload 深拷贝；对跨线程投递的 buf 严守"交接即转所有权、下游负责 release"。
- **电力**：终端小报文海量但尺寸小，池化 smallSubpage 复用极致；嵌入式设备内存有限，用 `-Dio.netty.allocator.type=unpooled` 或调小 arena/chunk，牺牲一点吞吐换更低的常驻内存。

## 七、要点回顾

1. **ByteBuf 读写双指针**（readerIndex/writerIndex）消灭 flip；`slice` 零拷贝视图、`copy` 深拷贝。
2. **堆/堆外 × 池化/非池化**四象限；生产默认**池化 + 偏 direct**，省拷贝、稳 GC。
3. **PooledByteBufAllocator 借 jemalloc**：arena（≈2×核、减锁争用）+ chunk(16M)/page(8K)/subpage 分级 + threadLocalCache 无锁快路。
4. **引用计数**：refCnt 归零才归还；正常 pipeline（Tail 兜底 + writeAndFlush）会自动 release，**截留/自建 buf 才需手动 `release` + `finally`**。
5. **泄漏检测** `leakDetection.level`：默认 SIMPLE 采样、预发 PARANOID 拿创建栈定位；LEAK 是滞后信号，不能只靠它。
6. **CompositeByteBuf**：逻辑拼接、物理零拷贝，是用户态 scatter/gather。
