# ByteBuf、内存模型与引用计数 · 面试题

> ByteBuf 是"会用 Netty"和"懂 Netty 内存模型"的分水岭。高频三连：为什么不用 ByteBuffer、池化怎么实现的、引用计数怎么管/怎么排泄漏。能把 jemalloc 分代 + LEAK 排查讲顺，就是资深档。

## 考点 1：为什么 Netty 自己造 ByteBuf

**起手**：JDK 有 ByteBuffer，Netty 为什么还要 ByteBuf？

**期望**：
- **读写双指针**（readerIndex/writerIndex）消灭 flip 心智负担；`readableBytes()` 一把梭。
- **池化 + 引用计数**：把生命周期从 GC 手里夺回，避免高频小对象反复申请/释放与 GC 抖动（s1-3 直接内存 OOM 之痛）。
- 丰富 API：`slice`（零拷贝视图）/`CompositeByteBuf`（逻辑拼接不搬字节）/动态扩容 `writerIndex`。

**追问链**：
1. slice 和 copy 区别？→ slice 共享底层存储的视图（零拷贝），copy 深拷贝新 buf。

## 考点 2：池化分配器原理（jemalloc）

**起手**：`PooledByteBufAllocator` 快在哪？

**期望**：
- 借 **jemalloc**：默认 **2×核数个 PoolArena**（线程取模绑 arena，减锁争用）；arena 内 **chunk(16MB)→page(8KB)→subpage** 分级复用；**per-thread ThreadLocalCache** 让常见尺寸分配几乎无锁、不回 OS。
- 尺寸分 small/normal/huge 走不同路径，减少碎片。

**追问链**：
1. 池化对直接内存有何额外好处？→ 归还是 Netty 计数控制，不靠 GC 时机 → 缓解"direct 内存靠 Cleaner 滞后释放"的 OOM。
2. 何时反而关池化？→ 内存极度受限/低频大 buf 场景，池会常驻已分配块；`-Dio.netty.allocator.type=unpooled`。

## 考点 3：引用计数与 release 归属（最易错）

**起手**：什么时候需要手动 release ByteBuf？

**期望**：
- refCnt 归零才归还；`retain()`+1、`release()`-1。
- **正常 pipeline 大多不用你管**：入站未消费消息被 **TailContext 兜底 release**；`writeAndFlush` 出站 buf 写出后自动 release。
- **需要手动**：你 `copy/slice(duplicate 计数)`/`alloc` 自建或 `retain` 截留了 msg，又没交给下游也没写出 → 自己 release（`try/finally`）。跨线程投递 = 转所有权，下游负责 release。

**追问链**：
1. `retain` 后又传给了下游会怎样？→ 你 +1、下游最终 release 只 -1 → 计数不归零 → 泄漏。要么别 retain，要么自己配平 release。
2. refCnt 线程安全吗？→ 用 `AtomicIntegerFieldUpdater` 原子，但"用已释放的 buf"是逻辑错误，原子救不了。

## 考点 4：泄漏排查（经验题）

**起手**：线上 RSS 缓涨、heap dump 没大对象，怎么办？

**期望**：
- 判断：多半**堆外/池化内存泄漏**（不进 heap dump）。
- 手段：预发 `-Dio.netty.leakDetection.level=PARANOID` 复现，抓 `LEAK: ...release() was not called...` 的**创建栈**定位漏 release；看 `usedDirectMemory()`、`PooledByteBufAllocator.metric()`、`MaxDirectMemorySize`。
- 认知：LEAK 是**被 GC 才报、依赖采样**的滞后信号，正确性靠"谁截留谁 release"纪律，不靠它兜底。
- 区分真泄漏 vs 池化正常持有（稳定后不再涨）。

## 考点 5：CompositeByteBuf（加分）

**期望**：
- 多个 buf 组成**逻辑视图**、跨组件移动指针而**不拷贝数据**，是用户态 scatter/gather；广播/拼接协议帧时省掉 N 次深拷贝。
- 注意仍参与引用计数、需正常 release；要实体化用 `copy()`。
- 收尾把 s1-3（直接内存/scatter/gather）↔ s2-2（ByteBuf 池化/计数/Composite）串起来即高分。
