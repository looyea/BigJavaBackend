# ByteBuf、内存模型与引用计数 · 课后作业

> 两题各 50 分：一题亲手制造并定位一次 ByteBuf 泄漏，一题对比池化/非池化、堆/堆外的性能与内存画像。

## 作业 1：制造一次泄漏并用 LEAK 日志定位（50 分）

**要求**：
1. 写一个 handler，在 `channelRead` 里 `ByteBuf copy = ((ByteBuf)msg).copy();` 处理但因"某 if 分支提前 return"漏了 release。启动加 `-Dio.netty.leakDetection.level=PARANOID`。
2. 反复发几百条消息、触发 GC，观察日志出现 `LEAK: ByteBuf.release() was not called before it's garbage-collected`，并**读出其中的创建栈**定位到漏 release 的行。
3. 用 `try { ... } finally { copy.release(); }` 修复，复测 LEAK 不再出现。
4. 把 level 降回 SIMPLE、再到 DISABLED，说明三种级别下你能拿到什么信息、开销差异。

**验收标准**：
- 能贴出（或复述）LEAK 日志关键段并指出"创建栈指向哪次 alloc"。
- 修复后 LEAK 消失；能说清"LEAK 是被 GC 才报的滞后信号、依赖采样"。
- 说清 SIMPLE vs PARANOID 的信息量/开销权衡，以及为何生产不常驻 PARANOID。

**参考答案要点**：
- PARANOID 打"created at" + "last access"两条栈，直接指到 `alloc()` 处。
- 纪律：谁截留/自建谁 release；未消费入站消息要么 `fireChannelRead` 交给下游、要么显式 `ReferenceCountUtil.release`。

## 作业 2：四种 ByteBuf 的性能与内存画像对比（50 分）

**要求**：
1. 做一个 echo/聚合压测，分别在四种组合下测：**吞吐、GC 次数与暂停、RSS、direct memory 用量（`usedDirectMemory()`）**：① 非池化+堆；② 非池化+直接；③ 池化+堆；④ 池化+直接（Netty 默认）。
2. 记录 `PooledByteBufAllocator.metric()` 的 active/subscribed/缓存命中，观察池化的"分配即复用"效果。
3. 结论化：哪种适合"内存受限的嵌入式"、哪种是"高吞吐网关默认"，为什么。
4. 用 `CompositeByteBuf` 改写"header+body 合并"，对比 `copy` 合并方案的 CPU/内存差异。

**验收标准**：
- 给出四组对比数据并解释：池化降低分配/GC 抖动；direct 省一次 IO 拷贝但进堆外需盯 MaxDirectMemorySize。
- 正确解释 metric 的 activeBytes vs allocatedBytes（池会持有已归还块）。
- Composite 方案明显省却"大 buf 深拷贝"，能说清它是用户态 scatter/gather。

**参考答案要点**：
- 高吞吐默认 = 池化 + direct；内存受限 = 调小 arena/chunk 或 unpooled + heap 换低常驻。
- 池化内存"稳定后不再涨"是正常的（缓存复用），要与真泄漏区分：看趋势是否单调上升 + LEAK 日志。
