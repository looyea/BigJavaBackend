# Java NIO 三大件：Channel / Buffer / Selector · 课后作业

> 两题各 50 分：一题亲手踩透 ByteBuffer 指针与直接内存坑，一题用零拷贝做一次"传文件"性能对比。

## 作业 1：ByteBuffer 指针推演 + 直接内存 OOM 复现（50 分）

**要求**：
1. 纸面/代码推演：`allocate(8)` 的 buffer，依次 `put((byte)i) i=0..5` 后写出 `position/limit/capacity`；再 `flip()` 后写出三值；`get()` 两次后写出三值；`compact()` 后写出三值并说明哪些字节被保留。
2. 写一个用 JDK NIO 循环读 socket 的小客户端，故意**漏掉 flip**，观察写出乱码/空；再错误地用 `clear()` 替代 `compact()`，用一次"分两个 TCP 段到达的半包"复现**数据被丢**。
3. 用线程池在循环里不断 `ByteBuffer.allocateDirect(10*1024*1024)` 且**不主动触发 Full GC**，设 `-XX:MaxDirectMemorySize=100m`，复现 `OutOfMemoryError: Direct buffer memory`；再用 `System.gc()` 或 `((DirectBuffer)buf).cleaner().clean()` 说明为何能"暂时缓解"。

**验收标准**：
- 指针推演每步数值正确，能说清 flip/compact 对 position/limit 的精确改变。
- 复现两种 bug 并用一句话概括"忘 flip 写出垃圾、clear 丢半包"。
- 直接内存 OOM 复现成功并解释"不受 -Xmx 管、靠 GC 滞后释放"的机制。

**参考答案要点**：
- flip：`limit=旧position; position=0`；compact：把 `[position,limit)` 未读搬到开头、position 接在其后、`limit=capacity`。
- 直接内存回收依赖 `Cleaner`（虚引用挂到 ReferenceHandler），堆压力不足时不及时 → 需显式限流/`MaxDirectMemorySize`/显式 clean。

## 作业 2：零拷贝传文件 —— mmap vs transferTo vs 普通循环（50 分）

**要求**：
1. 实现三种"把一个大文件通过 socket 发给客户端"的方式：① 普通 `FileInputStream`+`OutputStream` 逐块读写；② `FileChannel.map()`（mmap）后写 channel；③ `FileChannel.transferTo()`（sendfile）。
2. 用 1 GB 文件压测三者：**耗时、CPU 占用（`top`/`pidstat`）、上下文切换次数**。
3. 抓一次 ③ 的系统调用（`strace -c` 或 `perf`），确认它调用了 `sendfile`、且用户态几乎不搬运字节。
4. 说明哪种适合"反复随机读同一段"、哪种适合"顺序整段转发"。

**验收标准**：
- 给出三者数据对比，指出 `transferTo` CPU 最低（拷贝次数从 4→2、上下文切换减少）。
- 正确区分 mmap（随机访问/反复读、有 SIGBUS 风险）与 sendfile（顺序转发、数据不出内核）。
- 关联：Netty 用 `DefaultFileRegion`（封装 transferTo）做文件服务零拷贝；Kafka 靠它 + 顺序写 + 页缓存。

**参考答案要点**：
- 普通：内核→用户→socket 内核，2 次 CPU 拷贝。mmap：省"内核→用户"一次。sendfile：全程内核，0 次 CPU 拷贝（有网卡 scatter 时）。
- mmap 适合消息日志段随机读；sendfile 适合"读文件直接发网络"的转发。
