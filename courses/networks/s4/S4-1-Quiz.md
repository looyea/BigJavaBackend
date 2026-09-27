# Socket 选项、Linux 内核参数与网络调优 · 小测验

### 1. RPC/数据库这类低延迟交互式连接，几乎必须设置的选项是（15分）

- A. SO_LINGER=0
- B. TCP_NODELAY=true
- C. SO_RCVBUF 手动设成固定值
- D. 关闭 tcp_timestamps

> 答案：B
> 解析：TCP_NODELAY 关 Nagle，消除"Nagle × 延迟 ACK"的稳定 ~40ms 延迟（s2-3）。C 是反模式（手动设会禁用内核 autotuning）。

### 2. 全连接队列(accept queue)的真实上限由谁决定（15分）

- A. 只由应用设置的 backlog
- B. 只由 `net.core.somaxconn`
- C. `min(backlog, somaxconn)`
- D. `tcp_max_syn_backlog`

> 答案：C
> 解析：全连接队列 = min(应用 backlog, somaxconn)，两者都要够；D 是半连接队列。只调应用不调 somaxconn（老内核默认 128）会白调。

### 3.【多选】下列哪些是"资源型上限打满"的正确症状与项（20分）

- A. 连接数逼近 `ulimit -n` → `Too many open files`
- B. 出站源端口耗尽 → `Cannot assign requested address`
- C. `nf_conntrack` 表满 → 新连接被静默丢弃（偶发超时、无 RST）
- D. `somaxconn` 太小 → CPU 100%

> 答案：ABC
> 解析：D 错，somaxconn 太小表现为全连接队列溢出→丢 SYN→连接超时，不是 CPU 打满。A/B/C 分别对应 fd、本地端口、conntrack 三类资源上限。

### 4. 填空题：想让跨地域高丢包链路吞吐更稳，通常把默认的 CUBIC 拥塞算法换成 ____（并配 `fq` 队列做 pacing）。（10分）

> 答案：BBR / bbr
> 解析：CUBIC 是 Linux 默认（丢包即腰斩 cwnd，高丢包吞吐差）；BBR 以带宽+RTT 建模、抗丢包更稳，需配 `default_qdisc=fq` 做 pacing。

### 5. 关于手动设置 `SO_RCVBUF`，正确的说法是（10分）

- A. 总是能提升吞吐，应无脑调大
- B. 显式设置会让该 socket 退出内核缓冲自动调优
- C. 是关 Nagle 的等价手段
- D. 与 BDP 无关

> 答案：B
> 解析：内核默认按 `tcp_rmem/tcp_wmem` autotuning；一旦应用显式 setsockopt 缓冲，会禁用自适应（可能反而变差）。大 BDP 场景应靠 wscale + autotuning 上限，而不是硬设小值。

### 6. 简答：一台 K8s 里的 Java 服务偶发"连下游超时几十毫秒后自愈、无 RST、重启服务无效、监控 CPU/内存都正常"。请用本节知识给出至少两个高概率方向与验证命令。（30分）

> 参考答案：
> - 方向一：**conntrack 表满**（SNAT 出网/iptables 模式）。偶发静默丢包、无 RST、重启无用的典型特征。验证：`dmesg | grep conntrack`（table full dropping packet）、`sysctl net.netfilter.nf_conntrack_count net.netfilter.nf_conntrack_max`。治理：调大 max、缩短 `nf_conntrack_tcp_timeout_established`、或走 IPVS/eBPF/notrack。
> - 方向二：**本地端口/fd 耗尽** 或 **全连接队列溢出**（作为客户端时端口、作为服务端时 accept 不过来）。验证：`ss -s`、`cat /proc/sys/net/ipv4/ip_local_port_range`、`ulimit -n`、`netstat -s | grep -i overflow`、`ss -lnt`（Recv-Q 逼近 Send-Q）。
> - 要点：强调"无 RST + 偶发 + 自愈"= 静默丢包类（conntrack/队列/DROP），而非对端主动拒绝（那会有 RST）。
> - 要点：调优纪律——先测后调、参数持久化；并指出应用层改长连接/连接池往往比堆内核参数更根治。
