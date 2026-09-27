# TCP 三次握手 / 四次挥手与状态机

> 这是网络面试的第一高频题，也是**连接池、优雅发布、TIME_WAIT 堆积、端口耗尽**这一整串生产问题的解释基础。本节不只背"三次四次"，而是把状态机、两个队列、以及"为什么这样设计"讲到底。（重要度 5/5，核心精讲）

## 一、握手在协商什么：序号、窗口与选项

三次握手交换的不是"连接请求"，而是**双方的初始序号（ISN）+ 接收窗口 + 一组选项**：

```
client                                    server
  │ SYN seq=x  win=29200  opts[mss 1460, wscale 7, sackOK]
  │───────────────────────────────────────────▶│   (SYN_SENT / LISTEN)
  │ SYN,ACK seq=y  ack=x+1  win=65535 opts[...]  │
  │◀───────────────────────────────────────────│   (SYN_RCVD)
  │ ACK ack=y+1  [可携带数据: TFO / 首个请求]     │
  │───────────────────────────────────────────▶│   (ESTABLISHED，进 accept 队列)
```

- **序号是 32 位、按字节计数、会回绕**（1 Gbps 上约 4 秒回绕一圈）。ISN 不是随机数而是**按时钟递增 + 哈希**，防止旧连接的重复包被新连接误收（历史原因），实现上还要防被中间人猜测。
- 每个 SYN **消耗一个序号**（所以 ACK 是 x+1），FIN 同样消耗一个序号 —— 这是"挥手为什么是四次 + 序号为什么要 +1"的技术答案。
- 选项在握手时定终身，之后不可改：**`mss`**（s1-1）、**`wscale`** 窗口缩放因子（16 位窗口字段最大 65535，乘 2^wscale 才能表达大窗口，长肥管道必须）、**`sackOK`** 选择性确认（s2-3 重传效率的关键）、时间戳 `tsoffset`（RTT 测量与 PAWS 防回绕）、`tfo` 快速打开。

## 二、为什么是三次，不是两次

标准答案是"防止历史重复连接"，但要讲得完整：

1. **必须两次交互才能双向确认**：A 发 SYN、B 回 SYN/ACK，此时 B 知道"A 能发、B 能收"，A 知道"B 能收、A 能发"。要让**双方都确认四通**（我能发/我能收/对方能发/对方能收），第三个包（A 确认 B 的序号）不可省。
2. **两次会怎样**：一个在网络里滞留很久的旧 SYN 到达服务端，服务端立刻建立连接并等待数据 → 资源被无意义占用，且这个"半连接"永远等不到 ACK；更糟的是客户端已放弃，服务端单方面认为连接存在，把后续同一四元组的包当垃圾。**三次握手的第三次就是让服务端确认"这个连接真的还有人用"。**
3. **为什么不是四次**：SYN 和 ACK 可以合并（服务端在被 SYN 触发时同时完成"确认对方 + 报上自己序号"），四次不会带来任何额外安全性。
4. **并发安全**：SYN/ACK 会重传（`tcp_synack_retries`，默认 6 次），第三个 ACK 丢失时靠重传恢复，而不是把握手加长。

> 顺带回答常见追问："SYN 包能带数据吗？" → 标准 TCP 不行，但 **TFO（TCP Fast Open）** 在服务端缓存 cookie 后，第三次 ACK 就能携带首次请求数据（省 1 RTT）；QUIC 则把这一思路做到极致（1-RTT 常规、0-RTT 恢复会话）。

## 三、两个队列：backlog、syncookies 与"连接不上"的真实原因

```
                SYN                SYN/ACK              ACK
  ┌──────────半连接队列(SYN queue)──────────┐   ┌──────全连接队列(accept queue)─────┐
  │ 收到 SYN 即占位，等待第三次 ACK          │ → │ 握手完成，等待应用 accept()        │
  │ 上限: tcp_max_syn_backlog               │   │ 上限: min(backlog, somaxconn)     │
  └─────────────────────────────────────────┘   └──────────────────────────────────┘
```

**这是"服务端明明活着、客户端却连不上/连接超时"的最常见原因**：

- 应用 `accept` 不过来（业务线程阻塞、GC 停顿、单线程 accept）→ **全连接队列满** → 内核默认丢弃 SYN（不回 RST！）→ 客户端 SYN 超时重传，表现为 `Connection timed out`。**只有开启 `tcp_abort_on_overflow=1` 才会回 RST**（表现为 `Connection refused`），默认 0 是静默丢弃。
- SYN 洪泛或新建速率暴涨 → **半连接队列满** → 新 SYN 被丢；开 `tcp_syncookies=1` 后，队列满时内核不占位，而是把连接信息编码进 SYN/ACK 的序号里（cookie），收到合法 ACK 才建连，用 CPU 换内存。
- **观测手段**（面试写出来就是经验）：
  ```bash
  ss -lnt                                  # Send-Q=全连接队列上限，Recv-Q=当前积压
  netstat -s | egrep -i 'listen|overflow'  # "times the listen queue of a socket overflowed" 就是这个事故
  # 或在 accept 处打印：SO_LISTOVERFLOW / nstat -az | grep -i ListenOverflows
  ```
- **正确配置**：`net.core.somaxconn`（默认曾长期是 128！）、`tcp_max_syn_backlog`、以及应用层 backlog 三者要一起调；Tomcat `acceptCount`、Netty `ChannelOption.SO_BACKLOG`、Nginx `listen ... backlog=511` 都是往内核传的 `backlog`。

## 四、状态机：客户端 11 态、服务端多 2 态

```
客户端                                          服务端
CLOSED                                          CLOSED
  │ active open: 发 SYN                       ▲  passive open: socket/bind/listen
SYN_SENT                                       LISTEN
  │ 收到 SYN/ACK，回 ACK ────────────────────▶ SYN_RCVD
ESTABLISHED  ◀────────────── 收到 ACK ────────  ESTABLISHED
  │ 应用 close(): 发 FIN                        │ 收到 FIN，回 ACK（数据可能还没读完）
FIN_WAIT_1                                      CLOSE_WAIT   ← 应用没 close 就停在这里！
  │ 收到 ACK                                   │  收到 FIN，回 ACK
FIN_WAIT_2  ───── 收到 FIN ─────▶ TIME_WAIT ◀── LAST_ACK
  （对端先关时：客户端直接进入 FIN_WAIT_1 的对称路径）      │ 收到 ACK
                                                    CLOSED
```

**必须会解释的三个状态**：

1. **`CLOSE_WAIT`**：被动关闭方收到 FIN 后回 ACK 停留的状态。**它由应用调用 `close()` 才离开**。生产上大量 `CLOSE_WAIT` = **代码忘记关连接**（HTTP 客户端没 close response、DB/Redis 连接没归还、异常分支漏关），是最高频的连接泄漏症状，会一路吃到 fd 耗尽（`Too many open files`）。
   ```bash
   ss -ant state close-wait | head          # 看是谁的
   ss -antp state close-wait                # 带进程，配合 lsof -p <pid> | wc -l 看 fd 用量
   ```
2. **`TIME_WAIT`**（主动关闭方停留 2MSL，Linux 固定 60 s）存在的**两个理由**：
   - **让最后一个 ACK 可重传**：若 ACK 丢失，对端会重发 FIN；没有 TIME_WAIT 就没法重答，对端会停在 LAST_ACK 直到超时。
   - **让旧连接的报文在网络中自然消亡**（"沉睡时间"），避免同样四元组的新连接收到上一个连接的迟到包 —— 这才是"TIME_WAIT 是保护性设计"的本质。
   - 后果：主动关闭方在 60 s 内不能复用同一 `(源IP,源端口,目的IP,目的端口)`。**高并发短连接的服务器作为主动关闭方时，到同一后端端口的 TIME_WAIT 会大量堆积**，占端口、占内存（每条约几百字节到 1.6 KB）、拖慢新建。
3. **`FIN_WAIT_2` / `LAST_ACK` 泄漏**：对端不发 FIN 时 `FIN_WAIT_2` 会长期挂着（`tcp_fin_timeout` 控制，Linux 默认 60 s），半关闭滥用或攻击可致其堆积。

### TIME_WAIT 堆积治理（工程四选一，按场景）

| 手段 | 做法 | 适用与风险 |
|---|---|---|
| **减少主动关闭**（最优） | 长连接 / 连接池复用；由**客户端**主动关而不是服务端 | 根治；需要连接池与空闲回收（s2-1 作业 2） |
| **端口复用** | 服务端 `SO_REUSEADDR`（Linux 下 bind 允许绑到处于 TIME_WAIT 的本地地址） | 解决"重启服务 bind 失败"，不减少数量；对入向连接安全 |
| **出站端口耗尽** | `ip_local_port_range` 调大；`tcp_tw_reuse=1`（**仅对出站有效**，依赖时间戳） | 客户端角色适用；`tcp_tw_recycle` 因 NAT 下误丢包在 Linux 4.12 被移除，**别再用** |
| **架构层** | 加反向代理/连接归一化（外部短连接终止在 LB/网关，内部长连接） | 把 TIME_WAIT 收敛到可控层；LB 侧要配 `keepalive` 上游连接池 |

> 面试高频陷阱：**`tcp_tw_recycle` 必须说"已废弃"**（NAT 后多主机共享时间戳导致新连接被丢），能说出这个演进就说明你追过版本变化。

## 五、四次挥手为什么不能合并成三次

因为 TCP 是**全双工、两个方向独立关闭**：A 发 FIN 只表示"我不再发数据了"，B 可能还有数据要回（HTTP 场景就是"请求发完但响应还没完"）。所以 B 收到 FIN 先回 ACK（进入 CLOSE_WAIT，把未读完的读完），等自己应用 close 时再发 FIN —— **ACK 和自己的 FIN 不能合并**（因为这两个时刻之间可能还有数据传输），于是必然四次。

对照 UDP：没有连接状态，也就没有挥手；`close()` 直接丢包（若 `SO_LINGER=0` 发 RST）。

## 六、RST 的五种触发场景（看到 RST 要知道谁发的）

1. 连接**没有监听端口**（对端回 RST → 客户端 `Connection refused`）。
2. 对端已关闭（收到 FIN/RST 后）你还发数据 → 回 RST（`Broken pipe` / `Connection reset by peer`）。
3. 收到**不属于任何连接**的包（序列号在窗口外也可能触发，实现相关）。
4. 半连接队列收到过期 ACK（SYN 重传丢失场景）→ `tcp_abort_on_overflow`/SYN 队列回收，回 RST。
5. 本机 `accept` 队列溢出（`tcp_abort_on_overflow=1`）、或 `SO_LINGER=0` 主动 RST；防火墙/LB 也可以注入 RST（很多"连接被中间设备踢掉"就是这个）。

**判读纪律**：RST 是"明确拒绝"，超时是"被静默丢弃"（呼应 s1-3）。抓包时先分类，方向就确定了。

## 七、优雅发布/断连接：为什么"每次发布都有几百个失败"

发布时典型现象：`Connection reset`、`EOF`、`Broken pipe`。根因几乎都在挥手与队列：

1. 进程收到 SIGTERM → 关闭监听 fd，内核不再应答新 SYN（已排队的 SYN 也会被 RST 或丢弃）——但**已建立的连接不会因此断开**，LB 也感知不到，仍在往这台机器发流量。**正解**：先从 LB 摘除（健康检查失败/主动下线接口）→ 等若干秒 → 再关进程。
2. 进程关闭时**未读完已建立连接的响应** → 客户端看到 EOF/RST。**正解**：优雅关闭 = 停止接收新请求 → 等待 in-flight 请求处理完（设置上限如 30 s）→ 关闭连接池。Java 里对应 `ServerSocket.close()` + 业务线程池 `shutdown + awaitTermination`，Netty 用 `shutdownGracefully(quiet, timeout, unit)`（netty/s3-1）。
3. 长连接场景（RPC/MQ/网关）必须**主动通知对端**：先发 GOAWAY（HTTP/2）或应用层"即将下线"帧，让客户端把流量切走，再关 TCP。
4. 客户端侧要做的：失败重试只对**幂等**请求开；对 EOF/RST 判连接不可信并重建；`keepalive` + 空闲回收避免踩到对端 idle timeout。

## 八、Java 侧的可见性速查

```java
// 服务端：backlog 与选项（Netty 对应 ChannelOption）
new ServerSocket(8080, 1024, addr);        // 第二个参数就是 backlog → 进内核与 somaxconn 取 min
socket.setKeepAlive(true);                 // 内核层保活，参数在 /proc/sys/net/ipv4/tcp_keepalive_*
socket.setTcpNoDelay(true);                // RPC 必开（s2-3 Nagle）
socket.setSoTimeout(3000);                 // 读超时：0=永不超时（危险）
socket.setSoLinger(true, 0);               // 关闭时发 RST：强制断开、丢弃未发数据（慎用）
socket.shutdownOutput();                   // 半关闭：请求发完等响应（HTTP 客户端常见正确姿势）
```

- JDK 没有暴露 `TCP_DEFER_ACCEPT`/`TCP_QUICKACK`/`SO_REUSEPORT`，需要 Netty 的 `NativeOption` 或 `epoll` transport（详见 s4-1 与 netty/s1-3）。
- **Java 的"连接超时"与"读超时"必须分别设**：`new Socket()` 后 `connect(addr, 3000)` 是建连超时，`setSoTimeout` 是读超时。只设后者 → 建连阶段被内核 SYN 重传拖到 1+2+4… ≈ 数十秒（`tcp_syn_retries` 决定），表现为"超时时间怎么比配置长这么多"。

## 九、三大行业场景钩子

- **电商**：大促前压测发现 `TIME_WAIT` 峰值 20 万、客户端端口耗尽，用"连接池 + 上游 keepalive + 扩大 port range"治理；发布窗口用"先摘 LB 流量 → 优雅关闭 → 再停进程"消除瞬时 5xx。
- **金融**：与外部机构对接常用**短连接**（对方只接受一次会话一连接），此时 **主动关闭方的 TIME_WAIT 会堆积在自己机器上**，且端口是稀缺资源（源 IP 少），必须提前和对方约定"谁先关"；核心系统对端 idle timeout 与心跳周期要书面固化，否则会出现"凌晨第一批交易全失败"（s2-1 作业 2）。
- **电力**：海量终端通过 4G/NAT 回主站，终端侧 NAT 老化 + 主站重启，会让大量连接"双方都以为还在"。所以主站发布要支持"通知终端重连"（应用层 GOAWAY 思想），并要求终端有指数退避重连（避免 30 万台同时重连打爆握手与认证 → 半连接队列打满，正是本节第三个知识点的现实版）。

## 十、要点回顾

1. 握手交换的是 **ISN + 窗口 + 选项**（`mss/wscale/sackOK/timestamp/TFO`）；SYN 与 FIN 各消耗一个序号。
2. 必须三次：两次无法让服务端确认"连接真有人用"，也无法双向确认四通；四次没必要（SYN/ACK 可合并）。
3. **两个队列**：半连接 `tcp_max_syn_backlog`（满 → `syncookies`）、全连接 `min(backlog, somaxconn)`（满 → 默认静默丢 SYN = 超时，开 `tcp_abort_on_overflow` 才回 RST）；`ss -lnt` 的 Recv-Q/Send-Q 是判据。
4. 状态机三重点：`CLOSE_WAIT` 堆积 = 应用没 close（fd 泄漏）；`TIME_WAIT` = 主动关闭方 2MSL，作用是"最后 ACK 可重传"与"旧报文消亡"；`FIN_WAIT_2` 由 `tcp_fin_timeout` 控制。
5. TIME_WAIT 治理优先级：**长连接复用 > 架构收敛（LB 归一化）> 参数（`somaxconn`/port range/`tw_reuse` 出站）**；`tw_recycle` 已废弃。
6. 挥手四次因为**全双工两个方向独立关闭**，ACK 与自己的 FIN 之间存在数据故不能合并。
7. **RST = 明确拒绝，超时 = 静默丢弃**；看到 RST 先判方向再看五种触发场景。
8. 优雅发布顺序：摘流量 → 停接新请求 → 等 in-flight → 关连接；长连接要发应用层下线通知；客户端必须配建连超时 + 读超时两套。
