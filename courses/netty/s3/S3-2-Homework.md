# 心跳、空闲检测、背压与百万连接调优 · 课后作业

> 两题各 50 分：一题实现双向心跳并观测假死清理与误杀边界，一题把单机推向高连接并逐项定位资源天花板。

## 作业 1：双向心跳 + 空闲清理，并找出误杀阈值（50 分）

**要求**：
1. 客户端 `IdleStateHandler(0, writerIdle=3s, 0)` 无数据时发 Ping；服务端 `IdleStateHandler(readerIdle=10s, 0, 0)` + 下游 handler：收到任何消息把 `missed` 归零，readerIdle 触发即 `ctx.close()`。
2. 正常连接运行，抓包确认 3s 有 Ping、服务端不误杀。
3. **模拟假死**：把客户端进程 `kill -STOP`（挂起但 TCP 不断），验证服务端约 10s 后判死 close；测"检测到的实际时间 vs 10s"的偏差，解释来源（EventLoop 定时偏晚 + 心跳周期）。
4. **找误杀边界**：把服务端 readerIdle 从 10s 逐步降到小于客户端心跳间隔，观察正常空闲被误断；给出"readerIdle 应 = 心跳间隔×几"的经验并复测稳定。

**验收标准**：
- 正常连接零误杀、假死连接被按时清理。
- 用数据说明 readerIdle < 心跳间隔会误杀，给出 ≥2~3× + 抖动静余量的取值。
- 说明服务端关闭时如何从 ChannelGroup/会话表移除该连接。

**参考答案要点**：
- IdleStateHandler 只发事件、策略在 userEventTriggered；readerIdle 依赖 EventLoop 定时，高负载偏晚 → 阈值留 buffer。
- 客户端 `kill -STOP` 不发 FIN，TCP 层无感，只有应用层心跳超时能发现 → 印证"为什么需要应用层心跳"。

## 作业 2：把 Echo/推送服务推向高连接并定位瓶颈（50 分）

**要求**：
1. 用 `EpollEventLoopGroup`（Linux）起服务，压测端逐步把并发长连接从 1 万推到 20 万+，记录每档 RSS、fd、CPU。
2. **先撞 fd 墙**：`ulimit -n` 默认（1024/65535）时观察 `Too many open files`；调 `ulimit -n 1000000` + `fs.file-max` 复测。
3. **测内存/连接**：开/关 `PooledByteBufAllocator`、调 `MaxDirectMemorySize`，记录"每连接平均内存"，估算百万连接总内存。
4. **制造慢消费者验证背压**：让部分客户端不读（`SO_RCVBUF` 塞满、对端不 recv），观察发送端 `channel.isWritable()` 变 false；实现"不可写即丢弃非关键推送 + 计数 + 达阈值断开慢消费者"，对比"无脑 writeAndFlush"下的 OOM。
5. 若在内网有 NAT/iptables，压 conntrack 至 `dmesg: table full`，调 `nf_conntrack_max` 或走 notrack 复测。

**验收标准**：
- 给出 fd→Too many open files、内存→RSS/MaxDirectMemory、conntrack→静默丢包 三类墙的**触发前信号**与调优后恢复。
- 背压实现能防 OOM 并附"慢消费者计数 + 主动断开"策略。
- 关联 networks/s4-1 内核参数与 s2-2 CLOSE_WAIT/端口观测。

**参考答案要点**：
- 百万连接核心是"每连接空闲成本"：fd + 内核 TCP 缓冲 + 用户态会话/缓冲；EventLoop 数≈核数与连接数无关。
- SO_REUSEPORT 多进程分摊 accept；海量定时用 HashedWheelTimer；监控 pendingTasks/direct memory/CLOSE_WAIT。
