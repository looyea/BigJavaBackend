# 心跳、空闲检测、背压与百万连接调优

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：IdleStateHandler 与双向心跳超时设计、FlushConsolidationHandler 合批刷写、WriteBufferWaterMark 高/低水位与自动读写开关、Channel.isWritable 背压传导；文件描述符、内存、TCP 参数、SO_REUSEPORT 多进程的容量规划与指标监控。

> 前两阶段解决"能不能跑"，本节解决"**高并发长跑会不会崩**"：连接假死怎么发现（心跳/空闲检测）、下游慢怎么不被拖垮（背压）、单机怎么扛百万连接（资源与内核调优）。这是 Netty 从"玩具"到"生产基础设施"的分水岭，也是网关/IM/MQ 客户端面试的深水区。（核心精讲，重要度 5/5）

## 一、为什么需要应用层心跳

TCP 有 `SO_KEEPALIVE`，但默认探测间隔 **2 小时**（`tcp_keepalive_time=7200`）且很多中间设备（NAT/防火墙/LB）会静默丢弃半开连接而不通知 —— **对端进程崩溃、拔网线、NAT 超时，你的 `read` 不会返回、连接"假死"**。所以长连接系统必须做**应用层心跳**：双方周期性发轻量帧，超时没收到就判定对端已死、主动关闭重连。

## 二、IdleStateHandler：Netty 的空闲检测器

Netty 用 `IdleStateHandler` 把"读写/全空闲"检测内置成一个 handler（放在 pipeline **靠头部**，s2-1 作业讲过原因）：

```java
// 例子目的：把 IdleStateHandler 注册在 pipeline 靠头部，使其最先看到空闲事件
pipeline.addLast(new IdleStateHandler(15, 0, 60, TimeUnit.SECONDS)); // 读空闲15s、写空闲0(关)、全空闲60s 触发
pipeline.addLast(new HeartbeatHandler());   // 必须再跟一个处理 IdleStateEvent 的下游 handler
// 正确使用结果：空闲到时向 pipeline 发 IdleStateEvent，由 HeartbeatHandler 接住处理
// 错误用法：addLast 只加 IdleStateHandler 不加处理 handler → 空闲事件传到 Tail 被忽略，假死连接永不回收
// 错误用法：IdleStateHandler 放链尾 → 入站事件先被前面 handler 消费，空闲检测不灵（应靠头）
```
触发时它向 pipeline 发一个 **`IdleStateEvent`**（`userEventTriggered`），你在下游 handler 里处理：

```java
// 例子目的：在下游 handler 里处理 IdleStateEvent，区分读/写空闲做探活或发心跳
public void userEventTriggered(ChannelHandlerContext ctx, Object evt) {
    if (evt instanceof IdleStateEvent) {                 // 只关心空闲事件
        IdleStateEvent e = (IdleStateEvent) evt;
        if (e.state() == IdleState.READER_IDLE) {         // 读空闲：一段时间没收到对端数据
            if (++missed >= 3) { ctx.close(); }          // 连续 3 次没回→ 判定对端死，主动关
            else ctx.writeAndFlush(PingMessage);         // 否则发 Ping 探活
        } else if (e.state() == IdleState.WRITER_IDLE) {
            ctx.writeAndFlush(Heartbeat);   // 写空闲：没业务数据时定时发心跳
        }
    } else { ctx.fireUserEventTriggered(evt); }          // 非空闲事件必须往下传，不吞
}
// 正确使用结果：readerIdle 需 > 对端心跳间隔×(2~3)，正常空闲不误杀，真死连接超时被关闭
// 错误用法：readerIdle 设得比对端心跳间隔还小 → 正常空闲也被判死、频繁 close 好连接（拖垮可用率）
```

**双向心跳的推荐设计**（业界最稳的一套）：
- **客户端**：`writerIdle=30s` 时主动发 Ping；发后 `missed++`。
- **服务端**：`readerIdle=90s`（=3×心跳 + 余量）没读到任何数据 → 判定客户端死 → `close`。收到任何数据/`Pong` 就把 `missed` 归零。
- **关键**：`readerIdle` 要 **> 对端心跳间隔**（留 2~3 倍 + 网络抖动余量），否则正常空闲被误杀；且它依赖 EventLoop 定时任务，**高负载下检测会偏晚**（s3-1 第七节），阈值还要再加 buffer。
- **服务端也要防"半开"**：只发不读的场景用 `writerIdle`；真正兜底是 `readerIdle` + 应用层 ACK 计数。

> `IdleStateHandler` 本身**不关连接、不发心跳**，它只发事件，策略全在你 —— 别忘了后面一定要跟处理 handler，否则空闲事件到 Tail 被忽略（s2-1）。

## 三、背压（Backpressure）：下游慢 / 对端慢时怎么不崩

**问题**：写速度 > 网络消化速度（对端慢、网络拥塞、自己生产太快），发送缓冲（Channel outbound buffer）无限堆 → **OOM**。TCP 层有流控（rwnd，networks/s2-3），但那是"对端接收窗口"；**Netty 的背压管的是"本端要写出去但还没刷完"的积压**。

### 1. WriteBufferWaterMark：高低水位

```java
// 例子目的：设置出站缓冲高/低水位，让 channel 在积压时通过 isWritable 报"写不动"
bootstrap.childOption(ChannelOption.WRITE_BUFFER_WATER_MARK,
                      new WriteBufferWaterMark(32*1024, 64*1024)); // low=32K, high=64K
// 正确使用结果：缓冲>64K → isWritable()变 false；回落<32K → 变 true（迟滞区间防抖动）
// 错误用法：以为 write() 会因高水位自动阻塞/拒绝 → 它照样接收并堆进缓冲，不主动降速照样 OOM
```
- 出站缓冲 **> highWaterMark** → `channel.isWritable()` 变 **false**（"写不动了"信号）。
- 回落到 **< lowWaterMark** → 重新 true（迟滞区间防抖动）。
- **注意**：`write()` 本身**不会阻塞、也不会拒绝**——它照样接收并堆进缓冲。水位只是**给你一个 `isWritable` 标志**，**主动降速/丢弃的责任在你**：

```java
// 例子目的：根据 isWritable 做背压处置（降速/丢弃），而不是盲写
if (ctx.channel().isWritable()) {          // 水位未高→ 正常写
    ctx.write(resp);
} else {
    // 背压处置：丢弃非关键消息 / 降级 / 计数告警 / 关慢消费者 / 让上游 produce 变慢
    droppedCounter.increment();            // 记录丢弃量以便告警
    ReferenceCountUtil.release(resp); // 别忘了 release（s2-2），否则 ByteBuf 泄漏
}
ctx.flush(); // 攒够再统一 flush
// 正确使用结果：慢消费者的发送缓冲不再无限增长，内存可控
// 错误用法：else 分支忘了 release(resp) → 丢弃的对象仍持有池化 ByteBuf → 内存泄漏（LEAK 日志）
```

### 2. 背压的传导（端到端）
真正的健康系统把"慢"从消费端**往上游传导**：`isWritable=false` → 生产者降速/限流 → 最上游（如 MQ 消费、请求入口）减速，而不是中间某处堆爆。这与 Reactive Streams 的 `request(n)`、Kafka 的 `fetch.max` 是同一思想（Reactor Netty/WebFlux 里 `isWritable` 映射到 Reactive 的自动请求开关，s3-3）。

### 3. FlushConsolidationHandler：合批 flush 省 syscall
每条 `writeAndFlush` 都触发一次 `flush()`→`writev` syscall，高频小写时 syscall 开销可观。`FlushConsolidationHandler`（放**靠近 Head 的出站**位置）把多次 flush **合并成每 N 次或定时一次**：
```java
// 例子目的：用 FlushConsolidationHandler 将多次 flush 合批，省 syscall
pipeline.addLast(new FlushConsolidationHandler(64, true)); // 每 64 次 flush 才真刷一次，true=自动读时重新调度
// 正确使用结果：高频小写的 writev syscall 次数大幅下降→ 吞吐提升
// 错误用法：把它放得离 Head 太远/顺位错→ 不能覆盖多数出站写、合批效果差；对延迟极敏感场景设太大又增尾延迟
```
配合"业务里用 `ctx.write` 攒、合适时机 `flush` 一次"，显著降低 syscall、提升吞吐；代价是极端情况略增延迟，可用其定时兜底。

## 四、百万连接（C1M）单机调优清单

"百万连接"考的是**每个连接的空闲成本**，逐项逼近（呼应 networks/s4-1）：

| 维度 | 关键项 | 说明 |
|---|---|---|
| **文件描述符** | `ulimit -n`、`fs.file-max`、systemd `LimitNOFILE` | 每连接 1 fd，百万连接先破 fd 上限（`Too many open files`）。调到 100w+ |
| **内存/连接** | 收发缓冲、ByteBuf、会话对象 | 别给每连接固定大 buffer（按需 + 池化 s2-2）；估 `单连接成本 × 100w`，direct 内存看 `MaxDirectMemorySize` |
| **epoll** | 用 native `EpollEventLoopGroup`/`EpollServerSocketChannel` | 比 JDK NIO 省内存、支持更多选项（`TCP_CORK` 等），ET 需自证不漏读；Netty LT 稳 |
| **内核 TCP** | `tcp_rmem/tcp_wmem`（autotuning 上限）、`ip_local_port_range`、`nf_conntrack_max` | 百万连接 conntrack 表极易满（静默丢包，networks/s4-1）；用 IPVS/notrack 或调大 |
| **accept 扩展** | `ChannelOption.SO_BACKLOG`、`somaxconn`、**`SO_REUSEPORT` 多进程** | SO_REUSEPORT 让多进程各持独立 accept 队列，破单 boss accept 瓶颈、平滑 reload |
| **EventLoop 数** | worker ≈ CPU 核数 | 连接数与线程数解耦（s1-2）；百万连接也只需几十 EventLoop，别乱调大 |
| **定时器** | 海量 `IdleStateHandler` → `HashedWheelTimer` | 每连接一个 schedule 任务太重，时间轮 O(1) 管百万超时 |

## 五、指标与监控（不可观测 = 不敢上线）

- **连接层**：活跃连接数、accept 速率、`ss -s`/`TCP: ports`、TIME_WAIT/CLOSE_WAIT 堆积（networks/s2-2）。
- **EventLoop**：`pendingTasks`（taskQueue 积压 → 说明有慢 handler/任务堆积）、IO 利用率、空轮询次数。
- **缓冲/内存**：`PooledByteBufAllocator.metric()`（active/heap/direct used）、`usedDirectMemory()`、发送缓冲水位命中次数（`isWritable=false` 计数）。
- **吞吐/延迟**：读写 QPS、编解码耗时、端到端 P50/P99、丢弃/降级计数（背压处置的落点）。
- 告警红线：`pendingTasks` 持续增长、direct memory 单调上涨、CLOSE_WAIT 堆积、conntrack 接近满。

## 六、三大行业场景钩子

- **电商**：营销 IM/长连接网关百万在线，`IdleStateHandler(90s readerIdle)` 清假死 + `isWritable` 丢弃非关键推送保命；`EpollEventLoopGroup` + `SO_REUSEPORT` 多进程扛 accept；容器里 `nf_conntrack` 与 fd 上限常是首发瓶颈。
- **金融**：行情广播"1 写 N"，慢订阅者用高水位 → 直接断开让其重连/走组播，绝不让一个慢消费者把广播缓冲堆爆拖垮全场；心跳用 `HashedWheelTimer` 管百万超时。
- **电力**：主站对海量终端，终端固件心跳间隔长且网络差 → readerIdle 设大（如 3×上报周期）避免误杀，半开靠应用层 ACK 计数；嵌入式内存小 → 每连接缓冲按需 + unpooled 控常驻。

## 七、要点回顾

1. **应用层心跳不可省**：SO_KEEPALIVE 2 小时太钝、NAT/中间盒静默丢包致假死。
2. **IdleStateHandler** 只发 `IdleStateEvent`、策略你定；readerIdle 要 > 对端心跳间隔×(2~3) 且留 EventLoop 定时偏晚的余量；靠后 handler 必须处理否则被 Tail 忽略。
3. **背压**：`WriteBufferWaterMark` 高/低水位控制 `isWritable`（迟滞防抖），write 不阻塞不拒绝 → **降速/丢弃责任在你**；端到端把"慢"往上游传导；`FlushConsolidationHandler` 合批 flush 省 syscall。
4. **百万连接**：破 fd/内存/conntrack/accept 四关 —— 提 `ulimit`、池化按需缓冲、native epoll + SO_REUSEPORT 多进程、EventLoop≈核数、时间轮管海量定时。
5. **可观测**：pendingTasks、direct memory 趋势、CLOSE_WAIT/conntrack、isWritable 命中、P99 —— 没监控别上线。
