# 心跳、空闲检测、背压与百万连接调优 · 面试题

> "生产级 Netty"的照妖镜题。心跳/背压几乎每个做网关、IM、RPC 的人都会被问；百万连接用来区分"用过 Netty"和"扛过大流量"。

## 考点 1：为什么要应用层心跳

**起手**：TCP 有 keepalive，为什么还要自己用心跳？

**期望**：
- `SO_KEEPALIVE` 默认 7200s 太钝；NAT/防火墙/LB 会静默丢半开连接不通知；对端崩溃/拔网线时本端 `read` 不返回 → **假死**。
- 应用层周期性 Ping/Pong + readerIdle 超时判死才能秒级发现并重建。

**追问链**：
1. 对端 `kill -STOP`（不发 FIN），TCP 层能感知吗？→ 不能，只有应用层心跳超时发现（呼应作业）。

## 考点 2：IdleStateHandler 用法与取值

**起手**：Netty 怎么实现心跳？readerIdle 设多少？

**期望**：
- 放 pipeline 头部，`IdleStateHandler(readerIdle, writerIdle, allIdle)` 发 `IdleStateEvent`，**不自动关/发**；在 `userEventTriggered` 里发 Ping 或 close。后面必须跟处理 handler 否则事件到 Tail 被忽略。
- readerIdle **> 对端心跳间隔 ×2~3** + 网络抖动 + EventLoop 定时高负载偏晚的余量；设太小 → 一次 GC 就误断海量连接引发重连风暴。
- 海量连接用 `HashedWheelTimer` 管超时，别每连接 `schedule`。

## 考点 3：背压（区分 TCP 流控 vs Netty 背压）

**起手**：下游消费不过来，Netty 怎么防止发送端 OOM？

**期望**：
- TCP rwnd 是"对端接收窗口"层；**Netty 背压管本端 outbound buffer 积压**。
- `WriteBufferWaterMark(low, high)`：超 high → `isWritable=false`，回落 low → true（迟滞防抖）。
- **关键**：`write()` 不阻塞不拒绝，照样堆缓冲 → **降速/丢弃/关慢消费者的责任在应用**（据 `isWritable` 处理，丢弃要 release ByteBuf），并端到端向上传导（映射到 Reactive `request(n)`、入口限流）。
- `FlushConsolidationHandler` 合批 flush 降 syscall。

**追问链**：
1. 广播里一个慢订阅者会怎样？→ 它的 outbound 缓冲堆高、占内存、连累同 EventLoop；用 isWritable 丢弃或直接断开慢订阅者保全局。

## 考点 4：百万连接调优（经验题）

**起手**：单机扛 100 万长连接，先碰哪些墙？

**期望（四关）**：
- **fd**：`ulimit -n`/`fs.file-max`/systemd `LimitNOFILE`（Too many open files）。
- **内存**：每连接缓冲/会话，池化按需 + `MaxDirectMemorySize`（估单连接成本×100w）。
- **epoll/内核**：native epoll transport；`tcp_rmem/wmem`、`ip_local_port_range`、**`nf_conntrack` 表满**（静默丢包，IPVS/notrack）。
- **accept**：`SO_REUSEPORT` 多进程各持 accept 队列破单 boss 瓶颈；EventLoop 数≈核数（与连接数解耦）。
- 监控：pendingTasks、direct memory 趋势、CLOSE_WAIT、conntrack、isWritable 命中、P99。

**追问链**：
1. 连接百万需要百万线程吗？→ 不需要，Reactor 让线程数=EventLoop 数≈核数（s1-2），连接数靠 fd/内存。

## 考点 5：收尾（体系感）

**期望**：把"心跳/背压/调优"挂回主干 —— 假死=TCP 语义局限（networks/s2-2/2-3）、背压=端到端流控思想、百万连接=Reactor 线程模型红利 + Linux 资源调优（networks/s4-1）。能说出"没有监控就不敢上线百万连接"是成熟的标志。
