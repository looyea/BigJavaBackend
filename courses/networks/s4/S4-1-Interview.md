# Socket 选项、Linux 内核参数与网络调优 · 面试题

> 调优题用来筛"真上过线"的人：能不能报出准确的报错信息、对应的参数、以及"先测后调、架构优先"的纪律。

## 考点 1：几个必知的 socket option

**起手**：RPC 客户端你会设哪些选项？

**期望**：
- `TCP_NODELAY=true`（关 Nagle，消 40ms）、`SO_KEEPALIVE`（但太钝，用应用层心跳）、连接/读超时分别设（s2-2）、缓冲交给 autotuning（别硬设 SO_RCVBUF）。

**追问链**：
1. SO_REUSEADDR vs SO_REUSEPORT？→ 前者允许 bind 处于 TIME_WAIT 的本地地址（解决重启 bind 失败）；后者多 socket 绑同 `IP:port`、内核按四元组哈希分流到多进程各自队列（消 accept 瓶颈、平滑 reload）。
2. SO_LINGER 设成 (on,0) 会怎样？→ close 立即发 RST、丢弃未发数据，跳过正常挥手（慎用）。

## 考点 2：队列与 somaxconn

**起手**：应用设了 backlog=1024，为什么 `ss -lnt` 的 Send-Q 还是 128？

**期望**：
- 全连接队列 = `min(backlog, somaxconn)`，`somaxconn` 老内核默认 128 → 被封顶。两者一起调。
- 溢出现象与观测：`netstat -s | grep -i overflow`、`ListenOverflows`；默认丢 SYN（超时），`tcp_abort_on_overflow=1` 才回 RST。

## 考点 3：资源型打满三件套（送命题）

**起手**：给你三种报错，各是什么原因？

**期望**：
- `Too many open files` → **fd 上限**（`ulimit -n`），常伴 CLOSE_WAIT 泄漏。
- `Cannot assign requested address` → **本地端口耗尽**（出站/TIME_WAIT），扩 `ip_local_port_range` + `tw_reuse` + 长连接。
- 偶发连接超时、无 RST、`dmesg: nf_conntrack table full` → **conntrack 打满**（NAT/K8s iptables），调大/走 IPVS/notrack。

**追问链**：
1. K8s 里 Pod 偶发连不上、重启没用？→ 优先怀疑 conntrack 满 / SNAT 端口耗尽（`nf_conntrack`、`ip_local_port_range`）。
2. 这些为什么"监控 CPU/内存正常"？→ 是内核表/队列/端口资源，不是 CPU/内存。

## 考点 4：缓冲、BDP 与拥塞

**起手**：跨地域传大文件跑不满，怎么调？

**期望**：
- 大 BDP → 需大窗口（wscale 协商 + `tcp_rmem/wmem` autotuning 上限抬高）；别硬设小 SO_RCVBUF。
- 拥塞：跨地域/丢包链路 **BBR + fq**，内网 cubic。

**追问链**：
1. 手动 SO_RCVBUF 的副作用？→ 退出内核 autotuning，可能更差。
2. 何时 cubic 反而更好？→ 内网低丢包、需与邻居公平时。

## 考点 5：调优方法论（架构视野收尾）

**期望**：
- **先测后调**（`ss -tin`/重传率/队列计数）、**一次改一组**、**灰度压测**、**参数持久化**（写进配置管理）。
- **架构 > 参数**：长连接 + 连接池 + 无状态 + 异步（Netty）通常比堆 sysctl 收益大，参数是兜底。
- 安全红线：绝不为"调通"而放宽校验/关 TLS/关域名验证。
