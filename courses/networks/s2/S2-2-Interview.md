# TCP 三次握手 / 四次挥手与状态机 · 面试题

> 这是网络面试的第一高频题，也是最容易被"背答案"暴露的题。区分度在于：能不能把**为什么这样设计**、**两个队列**、**CLOSE_WAIT/TIME_WAIT 怎么排查**讲成一条因果链。（承接 S2-2-Lesson，交叉引用 s2-1/s2-3/s4-1/netty-s3-1）

## 考点 1：为什么是三次握手，两次不行吗

**起手**：别只答"防止历史连接"，要先说清握手到底在交换什么。

**期望**：
- 三次交换的是**双方的 ISN + 接收窗口 + 选项（mss/wscale/sackOK/时间戳/TFO）**，本质是"双向确认四通"（我能发/我能收/对方能发/对方能收）。
- 两次：服务端被一个滞留的旧 SYN 触发就建连，永远等不到 ACK，单方面认为连接存在 → 资源被垃圾占用；第三次 ACK 就是让服务端确认"这连接真有人用"。
- 四次没必要：服务端的 SYN 与对 ACK 可以合并进一个 SYN/ACK。

**追问链**：
1. SYN 和 FIN 都消耗序号吗？→ 都消耗，所以 ACK=x+1、挥手是"四次 + 序号 +1"。
2. SYN 包能带数据吗？→ 标准 TCP 不行，TFO 在第三次 ACK 带首次请求；QUIC 做到 1-RTT/0-RTT。
3. 第三个 ACK 丢了怎么办？→ 服务端重传 SYN/ACK（`tcp_synack_retries`），不是把握手加长。

## 考点 2：半连接队列与全连接队列（最能区分"背过 vs 上过线"）

**起手**：服务端进程活着、端口在监听，客户端却连不上，可能是什么原因？

**期望**：
- **全连接队列（accept 队列）满**：应用 accept 不过来（GC 停顿、单线程 accept、业务阻塞）→ 内核默认**静默丢 SYN** → 客户端 `Connection timed out`；只有 `tcp_abort_on_overflow=1` 才回 RST（`Connection refused`）。
- **半连接队列（SYN 队列）满**：新建速率暴涨/SYN 洪泛 → 开 `tcp_syncookies` 用 CPU 换内存。
- 上限公式：全连接 = `min(backlog, somaxconn)`（`somaxconn` 老内核默认 128！）。

**追问链**：
1. 怎么定位？→ `ss -lnt`（Send-Q=上限、Recv-Q=当前积压）、`netstat -s | grep -i overflow`、`nstat -az | grep ListenOverflows`。
2. Tomcat/Netty/Nginx 的 backlog 配在哪？→ `acceptCount` / `ChannelOption.SO_BACKLOG` / `listen backlog=`，都是往内核传，与 `somaxconn` 取 min。
3. 30 万终端同时重连打爆哪一层？→ 半连接队列 + 认证线程，指数退避重连是客户端侧的必须。

## 考点 3：TIME_WAIT —— 两个作用 + 治理（高频中的高频）

**起手**：TIME_WAIT 是干嘛的？为什么是 2MSL？

**期望**：
- 停在**主动关闭方**，Linux 固定 60 s（2MSL，MSL=30 s）。
- 作用一：**让最后一个 ACK 可重传**（丢了则对端重发 FIN，还能重答）；作用二：**让旧连接报文在网络中消亡**，避免同四元组新连接收到迟到包 —— 这才是"保护性设计"的本质。
- 后果：高并发短连接的服务端作为主动关闭方，到同一后端的 TIME_WAIT 大量堆积，占端口、占内存、拖慢新建。

**追问链**：
1. 怎么治理？优先级？→ ① 长连接/连接池减少主动关闭（根治）② 架构层 LB 归一化把短连接终止在网关 ③ 参数：`ip_local_port_range` 调大、`tcp_tw_reuse=1`（仅出站、依赖时间戳）、`SO_REUSEADDR`（解决重启 bind 失败）。
2. `tcp_tw_recycle` 能用吗？→ **不能，NAT 下误丢新连接，Linux 4.12 已移除**；能说出这个演进说明追过版本。
3. 服务端和客户端谁该先关？→ 尽量让**客户端主动关**，否则服务端 TIME_WAIT 堆积；与外部机构短连接要书面约定"谁先关"。

## 考点 4：CLOSE_WAIT 堆积排查（送命题，答不出=没上过线）

**起手**：线上 `ss -ant state close-wait` 几万条，说明什么？

**期望**：
- CLOSE_WAIT 是**被动关闭方收到 FIN 后、应用还没调 `close()`** 停留的状态 → 大量堆积 = **代码漏关连接**（HTTP 客户端没 close response、DB/Redis 没归还、异常分支漏关），一路吃到 fd 耗尽 `Too many open files`。
- 定位链：`ss -antp state close-wait` 看是哪个进程 → `lsof -p <pid> | wc -l` 看 fd 用量 → 回到代码找没关的资源。

**追问链**：
1. 和 TIME_WAIT 的区别？→ TIME_WAIT 是主动关方才有的正常状态，CLOSE_WAIT 堆积几乎都是 bug。
2. 一句话记忆？→ **"谁先关决定谁积累 TIME_WAIT，谁没 close 决定谁积累 CLOSE_WAIT"**。

## 考点 5：挥手为什么四次 + RST 判读

**起手**：四次挥手能合并成三次吗？

**期望**：
- 不能。TCP 全双工、两个方向独立关闭；A 发 FIN 只代表"我不发了"，B 可能还有数据要回，所以 B 的回 ACK 和自己的 FIN 之间可能还有数据传输，**不能合并** → 必然四次。

**追问链**：
1. 看到 RST 怎么判方向？→ RST=明确拒绝，超时=静默丢弃；RST 五场景：无监听端口、对端已关你还发、包不属任何连接、过期 ACK/队列溢出、`SO_LINGER=0` 或中间设备注入。
2. `Connection refused` vs `Connection timed out`？→ 前者对端回 RST（端口没监听/`abort_on_overflow`），后者被静默丢（队列满/防火墙 DROP）。

## 考点 6：优雅发布 / 断连接（架构追问）

**起手**：为什么每次发布都有几百个 `Connection reset`？

**期望**：
- SIGTERM 关监听 fd 后内核不再应答新 SYN，但**已建立连接不断、LB 也感知不到**仍在打流量 → 正解：先从 LB 摘除 → 等若干秒 → 再关进程。
- 优雅关闭顺序：停接新请求 → 等 in-flight 处理完（设上限如 30 s）→ 关连接池；Java `shutdown + awaitTermination`，Netty `shutdownGracefully(quiet,timeout,unit)`。
- 长连接（RPC/MQ/网关）要先发应用层下线通知（HTTP/2 GOAWAY）让对端切流。

**追问链**：
1. 客户端要配什么？→ 建连超时 + 读超时**分别设**（只设 `setSoTimeout` 会被 SYN 重传拖到几十秒）；重试只对幂等请求开。
2. 半关闭怎么用？→ `shutdownOutput()`：请求发完等响应，HTTP 客户端正确姿势。

## 考点 7：状态机默写（面试官常要求画）

**期望**：能画出客户端/服务端 11+2 态，并至少讲清三个：
- `LISTEN → SYN_RCVD → ESTABLISHED`（服务端）；`SYN_SENT → ESTABLISHED`（客户端）。
- `CLOSE_WAIT`（被动方应用没 close）、`TIME_WAIT`（主动方 2MSL）、`LAST_ACK`、`FIN_WAIT_1/2`。
- 红线：能说清"谁主动关 → 谁进 TIME_WAIT""谁没 close → 谁堆 CLOSE_WAIT"。
