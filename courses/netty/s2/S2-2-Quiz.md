# ByteBuf、内存模型与引用计数 · 小测验

### 1. ByteBuf 相比 JDK ByteBuffer 消灭 flip 的关键设计是（15分）

- A. 更大的 capacity
- B. 用独立的 readerIndex / writerIndex 两个指针，读只动 reader、写只动 writer
- C. 自动 GC
- D. 只能用堆外内存

> 答案：B
> 解析：读操作推进 readerIndex、写操作推进 writerIndex，互不干扰，可读区 = [readerIndex, writerIndex)，因此不需要 flip 在读写模式间切换。

### 2. `PooledByteBufAllocator` 的分配器结构借鉴了哪种分配器、核心思想是（15分）

- A. glibc malloc，单锁全局堆
- B. jemalloc：arena 分摊 + chunk/page/subpage 分级 + 每线程缓存，减少锁争用与碎片
- C. Windows 段式内存
- D. JVM 的 G1

> 答案：B
> 解析：Netty 池化借 jemalloc：默认 2×核数个 arena 减争用，chunk(16M)/page(8K)/subpage 按尺寸分级复用，threadLocalCache 让常见尺寸分配近乎无锁。

### 3.【多选】关于 ByteBuf 引用计数与 release，正确的有（20分）

- A. refCnt 降到 0 时内存归还给池 / 释放 native 内存
- B. 正常"读→解码→写出去"路径中，未被消费的入站消息会由 TailContext 兜底 release
- C. 只要用了池化内存，就完全不需要关心 release，Netty 保证任何情况都自动回收
- D. 中途 retain() 截留了 msg，用完需自己 release（常配 try/finally）

> 答案：ABD
> 解析：C 错。自动 release 只覆盖正常传播/写出路径；你若截留、自建 buf、或没往下传也没写出，就必须手动 release，否则泄漏。A/B/D 正确。

### 4. 生产环境要定位"某 ByteBuf 泄漏发生在哪次 alloc"，最有效的手段是（10分）

- A. 打印 GC 日志
- B. 把 `-Dio.netty.leakDetection.level` 调到 PARANOID，复现后看 LEAK 日志的创建栈
- C. 增大 -Xmx
- D. 关闭池化

> 答案：B
> 解析：PARANOID 对每次分配记录采样，被 GC 时发现未 release 会打出"创建 + 访问"两条栈，直接定位漏 release 的代码；开销大，故只在测试/预发开。默认 SIMPLE 只采样不给完整栈。

### 5. CompositeByteBuf 合并 header+body 的优势是（10分）

- A. 自动加密
- B. 逻辑上拼成一个 buf、物理上不搬运字节（用户态 scatter/gather），省拷贝与分配
- C. 自动 release 所有组件
- D. 把堆内存变堆外

> 答案：B
> 解析：Composite 维护组件列表形成视图，reader/writer 跨组件移动但不拷贝数据，避免"新建大 buf + 深拷贝"。它仍参与引用计数，需正常 release。

### 6. 简答：某网关长跑数小时后 RSS 持续上涨直至 OOM，heap dump 里却看不到对应大对象。请结合本节分析可能原因与定位/修复路径。（30分）

> 参考答案：
> - 要点：heap dump 看不到 → 内存多半在**堆外（direct/native）或池化内存**，不受 -Xmx、不进 heap dump（呼应 s1-3 直接内存 OOM）。
> - 要点：最可能 **ByteBuf 泄漏**：某 handler retain() 或自建 buf 后在异常分支漏 release → 池化内存不归还 / native 不 free → RSS 缓涨。
> - 定位：预发把 leakDetection.level 设 PARANOID 复现，抓 `LEAK:` 日志的创建栈定位漏 release 处；同时看 `PlatformDependent.usedDirectMemory()`、`PooledByteBufAllocator.metric()`、`MaxDirectMemorySize` 配置。
> - 修复：谁截留谁 `release` + `try/finally`；把"未消费入站消息"要么交给下游 fireChannelRead 要么显式 release；跨线程投递严守"交接即转所有权"。
> - 加分：区分"真泄漏 vs 池化正常持有"（池会保留已归还的内存块供复用，稳定后不再涨）；给出监控（RSS、usedDirectMemory 趋势）与灰度验证。
