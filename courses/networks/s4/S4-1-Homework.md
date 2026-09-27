# Socket 选项、Linux 内核参数与网络调优 · 课后作业

> 两题各 50 分：一题用 Netty 原生选项补齐 JDK 做不到的调优，一题做一次"连接数压测 + 定位资源上限"。

## 作业 1：用 Netty epoll 补齐 JDK 缺失的 Socket 选项（50 分）

**要求**：
1. 用 Netty（`EpollEventLoopGroup` + `EpollServerSocketChannel`）写一个 echo 服务端，通过 `ChannelOption` 设置：`SO_BACKLOG`、`SO_REUSEADDR`、`TCP_NODELAY`、`SO_KEEPALIVE`，以及原生 `EpollChannelOption.TCP_DEFER_ACCEPT`、`SO_REUSEPORT`。
2. 起多个进程绑同一 `IP:port`（开 `SO_REUSEPORT`），压测后观察：连接是否被内核按四元组哈希分摊到各进程（对比不开时单 accept 瓶颈）。
3. 用 `ss -lnt` 看 `Send-Q`（队列上限）是否随 `SO_BACKLOG`/`somaxconn` 变化。
4. 记录"用 JDK NIO `SocketChannel` 尝试设 TCP_DEFER_ACCEPT 做不到"的对比结论。

**验收标准**：
- 能列出 JDK `SocketOption` 覆盖不到的选项，并说明 Netty 原生 transport 为何能做到。
- 观察 SO_REUSEPORT 多进程下的负载均衡效果。
- 强调 `min(SO_BACKLOG, somaxconn)` 决定全连接队列。

**参考答案要点**：
- `EpollChannelOption` 暴露内核级 `TCP_*`/`SO_REUSEPORT`；JDK NIO 无这些。
- SO_REUSEPORT 每进程独立 accept 队列，消除锁争用、支持平滑 reload。

## 作业 2：压测定位三类资源上限（50 分）

**背景**：一台 Linux，跑一个高并发短连接客户端压某服务。

**要求**：分别逼近并观测以下三类上限被打满时的**报错与命令输出**，再逐项调优复测：
1. **fd 上限**：`ulimit -n` 调小到 1024，压测到大量 CLOSE_WAIT/活跃连接报 `Too many open files`；调大复测。
2. **本地端口**：高频出站到同一 `IP:port`，观察 `ss -s` 的 TIME 与端口用尽 `Cannot assign requested address`；扩 `ip_local_port_range` / 上长连接复测。
3. **conntrack**（若有 NAT/iptables）：压测到 `dmesg` 出现 `nf_conntrack: table full`；调大 `nf_conntrack_max` 复测。

**验收标准**：
- 每类上限都能给出"打满前的报错/计数"与"调优后恢复"的对比数据。
- 正确区分：fd→Too many open files、端口→Cannot assign、conntrack→静默丢包+dmesg。
- 总结"参数持久化 + 灰度 + 优先架构（长连接/池）"的调优纪律。

**参考答案要点**：
- `ss -s`、`/proc/sys/net/...`、`ulimit -n`、`dmesg`、`netstat -s | grep -iE 'overflow|listen'` 是核心观测工具。
- 根治顺序：长连接/池 > 内核参数 > 硬件。
