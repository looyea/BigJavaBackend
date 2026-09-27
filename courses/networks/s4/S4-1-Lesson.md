# Socket 选项、Linux 内核参数与网络调优

> 前三节把协议讲透了，本节把它们落到**一行行可改的参数**上：哪个 socket option 管什么、哪个 `/proc/sys/net` 内核参数在何时该调、调错的代价是什么。这是一份能带进生产的清单。（重要度 4/5，重点标准；综合 s2 全部 + s3-3/s3-4）

## 一、Socket 选项速查（setsockopt 层）

| 选项 | 作用 | 何时用 / 坑 |
|---|---|---|
| **TCP_NODELAY** | 关 Nagle，小包立即发 | RPC/DB/交互式必开（s2-3 40ms 魔咒）；批量传输别开 |
| **SO_RCVBUF / SO_SNDBUF** | 收发缓冲上限 | 手动设会**禁用内核自动调优**（`tcp_rmem/tcp_wmem`），除非确知 BDP 否则别乱设 |
| **SO_REUSEADDR** | 允许 bind 处于 TIME_WAIT 的本地地址 | 服务端重启不再 `Address already in use`（s2-2） |
| **SO_REUSEPORT** | 多 socket 绑同一 `IP:port`，内核按四元组哈希分流 | 多进程/多队列各自 accept，消除单 accept 锁争用、平滑 reload（Nginx `reuseport`） |
| **SO_LINGER** | 控制 close 行为 | `linger on, timeout=0` → 立即 RST 丢弃未发数据（慎用）；默认 FIN 优雅关 |
| **SO_KEEPALIVE** + `tcp_keepalive_time/idle/intvl` | 内核层探活 | 默认 2 h 太长，感知死连接慢；应用层心跳更可控（s2-1/netty s3-2） |
| **TCP_DEFER_ACCEPT** | 有数据到达才 accept | 减少"握手完成但空连接"的被 SYN 攻击面、省进程 |
| **TCP_QUICKACK** | 关延迟 ACK | 与关 Nagle 配合消 40ms；但它是"一次性"的，内核会自行清掉，要配合 `TCP_NO_PUSH`/循环设置 |
| **IP_TOS / SO_PRIORITY** | 打 DSCP 优先级 | 跨网 QoS 标记（专线/关键流优先） |
| **IP_MTU_DISCOVER** | Path MTU 发现 | 配错引发 MTU 黑洞（大包过不了、小包能 ping 通，s1-2） |

**Java 的局限**：JDK `SocketOption` 只暴露了 `TCP_NODELAY/SO_SNDBUF/SO_RCVBUF/SO_KEEPALIVE/SO_LINGER` 等一小撮；**`TCP_DEFER_ACCEPT/TCP_QUICKACK/SO_REUSEPORT` 要用 Netty 的 `epoll` transport + `ChannelOption` 原生选项**（netty/s1-3、s2-1）。

## 二、连接与队列相关内核参数

对应 s2-2 两个队列：
```bash
net.core.somaxconn               # 全连接队列上限的全局封顶（老内核默认 128！调大）
net.ipv4.tcp_max_syn_backlog     # 半连接队列上限
net.ipv4.tcp_synack_retries      # SYN/ACK 重传次数
net.ipv4.tcp_abort_on_overflow   # 全连接满时是否回 RST（默认 0=静默丢 SYN）
net.ipv4.tcp_syncookies          # =1 半连接满时用 cookie 抗 SYN 洪泛
```
- 应用 backlog（Tomcat `acceptCount`/Nginx `backlog`/Netty `SO_BACKLOG`）与 `somaxconn` **取小** 才是全连接队列真实上限 —— 只调应用不调内核会白调。

## 三、端口、fd 与 conntrack：三个"资源型"打满

### 1. 本地端口范围与耗尽（客户端/TIME_WAIT）
```bash
net.ipv4.ip_local_port_range     # 出站临时端口范围（默认偏小，高并发新建易耗尽）
net.ipv4.tcp_tw_reuse            # =1 允许把 TIME_WAIT 用于新出站连接（仅出站、依赖时间戳）
```
- 高并发短连接的**客户端**（或作为主动关闭方）会因源端口耗尽报 `Cannot assign requested address`（s2-2）。扩端口 + `tw_reuse` + 最好上长连接。

### 2. 文件描述符（连接 = fd）
```bash
ulimit -n                        # 单进程 fd 软/硬限制（默认常 1024，C10M 必调）
/etc/security/limits.conf        # nofile 永久提升
fs.file-max / fs.nr_open         # 系统级 fd 总量
```
- 连接数逼近上限 → `Too many open files`；CLOSE_WAIT 泄漏（s2-2）会更快吃光 fd。

### 3. conntrack 表满（有状态 NAT/防火墙/K8s）
```bash
net.netfilter.nf_conntrack_max   # 连接跟踪表容量
net.netfilter.nf_conntrack_count # 当前占用
```
- 高并发短连接 + SNAT/NAT 网关/K8s kube-proxy(iptables 模式) 会**打满 conntrack 表** → 新连接被**静默丢弃**（`dmesg: nf_conntrack: table full, dropping packet`）。表现是"偶发连接超时、无 RST"。调大 max 或改 IPVS/eBPF、或走不跟踪。

## 四、收发缓冲与 BDP：长肥管道调优

- 大 BDP 链路（高带宽×高 RTT，如跨地域）要**足够大的窗口**才跑得满（s1-1 BDP、s2-3 wscale）。
- **自动调优优先**：`tcp_rmem="min default max"`、`tcp_wmem="min default max"` 三元组让内核按内存自适应；`net.core.rmem_max/wmem_max` 是自动调优的封顶。
- **别手动 `SO_RCVBUF` 定死**：一旦显式设置，内核对该 socket **退出自动调优**（`TCP_NOTSENT_LOWAT` 除外）。除非明确知道要固定，否则交给 autotuning。
- `net.core.netdev_max_backlog`：软中断收包快于协议栈处理时的网卡 backlog。

## 五、拥塞算法与队列规则（qdisc）

```bash
net.ipv4.tcp_congestion_control  # cubic / bbr（s2-4）
net.core.default_qdisc           # fq（配 BBR 做 pacing）/ pfifo_fast
```
- **BBR + fq**（s2-4）适合跨地域/丢包链路；内网低丢包 cubic 即可且与邻居公平。
- 切 BBR：`modprobe tcp_bbr` → 设 `default_qdisc=fq`、`tcp_congestion_control=bbr`。

## 六、中断与多核：万兆/C10M 的隐藏瓶颈

- **网卡多队列 + RSS/RPS + IRQ 亲和**：把软中断绑到不同核，避免单核 `si` 100%。`cat /proc/interrupts`、`mpstat -P ALL`（看某核 `%si` 打满）。
- **GRO/TSO/LRO**：网卡收发聚合减少协议栈开销；关 `tcp_timestamps` 曾用于省内存处理 TIME_WAIT（现代不建议）。
- **backlog 与 accept 并发**：单线程 accept 是瓶颈 → 用 **SO_REUSEPORT** 多进程/多 accept 线程各自队列。
- `net.ipv4.tcp_mem`：全局 TCP 内存三阈值，压力下降级缓冲。

## 七、C10M / 万兆调优清单（可直接抄）

```bash
# 队列与连接
sysctl -w net.core.somaxconn=65535
sysctl -w net.ipv4.tcp_max_syn_backlog=65535
sysctl -w net.ipv4.tcp_syncookies=1
# 端口与复用
sysctl -w net.ipv4.ip_local_port_range="1024 65535"
sysctl -w net.ipv4.tcp_tw_reuse=1
# 缓冲自动调优封顶
sysctl -w net.core.rmem_max=16777216
sysctl -w net.core.wmem_max=16777216
sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216"
sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"
# 拥塞
sysctl -w net.core.default_qdisc=fq
sysctl -w net.ipv4.tcp_congestion_control=bbr
# conntrack（若用 NAT/iptables）
sysctl -w net.netfilter.nf_conntrack_max=1048576
# fd
ulimit -n 1048576
```
**调优纪律**：① 先**测量**（s4-2 `ss -tin`、重传率、队列溢出计数）再调；② 一次改一组、灰度压测；③ 参数写进镜像/配置管理持久化（别只 `sysctl -w` 重启就丢）；④ 应用层连接池/异步化往往比内核调参收益更大 —— **参数是兜底，架构是根本**。

## 八、三大行业场景钩子

- **电商**：大促网关机器按上面清单预置；重点是 `somaxconn`（别被应用 backlog 掩盖）、conntrack（K8s SNAT 下高发）、本地端口（出站到下游短连接多）。
- **金融**：专线低丢包用 cubic 即可；mTLS 大量长连接 → fd 与内存规划优先；禁用一切"放宽安全"式调优（如关校验）。
- **电力**：主站百万级终端连接 → **SO_REUSEPORT 多 accept、多队列中断绑核、conntrack 走 notrack 或大容量**；弱网链路 BBR 收益明显，但终端侧参数要固件配合。

## 九、要点回顾

1. Socket 层：**TCP_NODELAY（交互必开）**、SO_REUSEADDR（重启 bind）、SO_REUSEPORT（多队列/平滑 reload）、SO_LINGER=0（强制 RST，慎用）、keepalive 太钝→应用层心跳。
2. 队列层：`somaxconn`/`tcp_max_syn_backlog`/`syncookies`/`abort_on_overflow`，**应用 backlog 与 somaxconn 取小**。
3. 资源层：**fd（连接数）、本地端口（TIME_WAIT/出站）、conntrack 表**三类上限，打满分别是 `Too many open files` / `Cannot assign address` / 静默丢包。
4. 缓冲层：**优先 autotuning（tcp_rmem/wmem）**，手动 SO_RCVBUF 会禁用自适应；大 BDP 靠 wscale。
5. 拥塞/中断：**BBR+fq**（弱网）、cubic（内网）；万兆靠**多队列 + IRQ 亲和**避免单核 si 打满。
6. 调优哲学：**先测后调、灰度、持久化；架构（长连接/异步/无状态）> 参数**。
