# 抓包与网络排障方法论 · 面试题

> 场景题："线上出问题了你怎么查"最能看出真实水平。答好要有**顺序**（先定性后取证）和**判据**（哪个数说明什么）。

## 考点 1：一次"网站慢/打不开"你从哪查起

**起手**：给我一个 URL 打不开，排查步骤？

**期望（四段定位）**：
- 先分层：DNS（`dig`）→ TCP 建连（`nc`/`telnet`、`ss -lnt` 队列）→ TLS（`openssl s_client`）→ HTTP/后端（`curl -w` 分段）。
- `curl -w` 拆分 time_namelookup/connect/appconnect/starttransfer/total，**一眼定性慢在哪段**。

**追问链**：
1. connect 时间很大说明什么？→ RTT 高 / SYN 重传 / 半或全连接队列满（s2-2）。
2. TTFB 大但 connect 正常？→ 后端处理慢（GC/DB/下游），别怪网络。

## 考点 2：RST vs 超时（方向判定）

**起手**：客户端 `Connection refused` 和 `Connection timed out` 有何本质不同？

**期望**：
- refused = 对端回 **RST**（端口没监听、`abort_on_overflow`、对端已关）；timed out = 报文被**静默丢弃**（队列满丢 SYN、防火墙 DROP、conntrack 满）。
- 抓包先看有没有 RST、SYN 是否有回，方向立判。

## 考点 3：读 ss / 抓包的关键信号

**起手**：`ss -tin` 你重点看哪几个字段？

**期望**：`retrans`（丢包）、`rtt`（链路抖）、`cwnd`（=1 说明刚超时）、对端 `win`/`rcv_space`（=0 说明消费慢/零窗口）。

**追问链**：
1. 怎么判断是网络丢包还是后端慢？→ 有重传/RTT 抖=网络；retrans=0 且 TTFB 大=后端。
2. Wireshark 里丢包的指纹？→ dup ACK + `tcp.analysis.retransmission`；零窗口 = `tcp.analysis.zero_window` + ZWP。
3. 云上抓不到包怎么办？→ 流量镜像，或退回 `ss`/`nstat`/`netstat -s`/`dmesg` 计数法。

## 考点 4：状态类堆积

**起手**：TIME_WAIT / CLOSE_WAIT 大量堆积分别怎么查、怎么办？

**期望**：
- `ss -ant state close-wait`：CLOSE_WAIT 多 = 本端没 close（代码泄漏），找没关的资源（s2-2）。
- TIME_WAIT 多 = 主动关方正常态，短连接风暴下堆积：长连接/池 > 架构收敛 > 参数（port range/`tw_reuse`），`tw_recycle` 已废弃。

## 考点 5：偶发无规律问题的取证思路

**起手**："有时快有时慢、抓不到现行"怎么查？

**期望**：
- 用**累计计数**抓现行：`nstat -az`（ListenOverflows/RetransSegs）、`dmesg`（conntrack full）、`netstat -s`——即使已自愈也留痕。
- 长窗口 tcpdump 环形缓冲落盘，出问题后回看。
- 全链路 trace 标出是哪一跳（s4-3）。
- 心法收尾：**先测后调、RST=拒/超时=丢、多数"网络问题"是服务端慢**。
