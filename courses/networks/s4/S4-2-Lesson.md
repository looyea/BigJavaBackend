# 抓包与网络排障方法论

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：tcpdump/tshark/Wireshark 过滤器语法、ss -tin 读拥塞窗口与重传、重传/乱序/RST/零窗口的包络特征识别，以及“慢在哪一段”的四段定位法与线上定位 SOP。

> 前两节是"知识"，本节是"手艺"。目标：给你一台慢/抖/连不上的服务，你能用一套**定位 SOP + 几个趁手工具**在几分钟内回答"慢在哪一段、丢没丢包、谁拒的"。（重要度 4/5，重点标准；串 s2 全部 + s3 + s4-1）

## 一、先定方法论：四段定位法

任何"网络慢/失败"都先切成四段，逐段测，**别一上来就抓包**：

```
客户端 ──① DNS──► 解析IP ──② 建连(TCP+TLS)──► 服务端 ──③ 传输/处理──► ──④ 回传/渲染──►
```
- ① DNS 慢/错 → `dig`（s3-4）。
- ② 建连慢/失败 → 能不能 TCP 通（`telnet`/`nc`）、TLS 是否握手成功（`openssl s_client`）、是不是队列满/RST/超时（s2-2）。
- ③ 首字节慢（TTFB） → 是网络 RTT/重传，还是**服务端处理慢**（多半是后者，别冤枉网络）。
- ④ 内容传一半卡 → 带宽/拥塞/零窗口/HOL（s2-3/s2-4）。

**黄金判据**：`curl -w` 的分段计时（见第三节）—— 它把"DNS/连接/TLS/首字节/总耗时"拆开，**一张表就能定性慢在哪一段**。

## 二、工具金字塔：从轻到重

| 层次 | 工具 | 用途 |
|---|---|---|
| 连接状态 | `ss`（替代 netstat） | 看连接数、队列、每连接 `cwnd/rtt/retrans` |
| 分段计时 | `curl -w` | 快速定性慢在哪段 |
| 连通/路由 | `ping`/`traceroute`/`mtr`/`tcpdump -i any` | 可达性、路径丢包 |
| 逐包分析 | `tcpdump` + Wireshark/tshark | 重传、乱序、RST、零窗口的铁证 |
| 内核计数 | `netstat -s`/`nstat -az`/`dmesg` | 溢出/丢包/conntrack 计数 |
| 全链路 | 分布式追踪 + 抓包 | 微服务里定位是哪一跳（s4-3/netty） |

## 三、curl -w：最快定性（务必背下这几个占位符）

```bash
# 例子目的：用 curl 分段计时一次把 DNS/建连/TLS/TTFB/总耗时全打出来，定位慢在哪一段
curl -s -o /dev/null -w \
"dns:%{time_namelookup} connect:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total} code:%{http_code}\n" \
https://api.example.com/ping          # -o /dev/null 丢弃 body，-w 只输出自定义计时行
# 正确用法结果：输出如 dns:0.01 connect:0.03 tls:0.08 ttfb:0.20 total:0.21 code:200 —— 各值递增，相邻差就是那一段耗时
# 错误用法：忘写 -o /dev/null → body 打印到终端混在计时行里，日志被污染不好解析
# 错误用法：只看 total 不下钻差值 → "慢"但不知慢在哪层；若 code:000 表示根本没拿到响应（连接/解析失败），不是慢是错
```
- `time_namelookup`：DNS 完成。
- `time_connect`：TCP 握手完成（−namelookup ≈ 建连耗时，含 RTT）。
- `time_appconnect`：TLS 握手完成（−connect ≈ TLS 成本，s3-3）。
- `time_starttransfer`：**TTFB**（−appconnect ≈ 服务端处理 + 首包回传，慢在这多半是**后端**）。
- `time_total`：全完成（−starttransfer ≈ 传 body 时间，看带宽/拥塞）。

**判读示例**：`connect` 很大 → 网络 RTT 高或半连接/全连接队列满或 SYN 重传（s2-2）；`ttfb` 大而 `connect` 正常 → 不是网络的锅，查服务/GC/DB。

## 四、ss：连接与拥塞的照妖镜

```bash
# 例子目的：ss 看连接状态分布与逐连接拥塞参数，排 TIME_WAIT/CLOSE_WAIT 堆积与 accept 积压
ss -s                          # 全机连接概览（timewait、established 计数）
ss -ant state time-wait        # TIME_WAIT 堆积？（主动关闭方才会进）
ss -ant state close-wait       # CLOSE_WAIT 泄漏（对端已关、应用没 close，s2-2）
ss -lnt                        # 监听队列：Send-Q=上限 Recv-Q=当前 accept 积压
ss -tin                        # ★ 逐连接：cwnd、rto、rtt、retrans、bytes_acked
# 正确用法结果：Recv-Q 接近 Send-Q → accept 不过来啦（查应用线程池/GC）；CLOSE_WAIT 只增不减 → 代码漏 close 的连接泄漏
# 错误用法：看到大量 TIME_WAIT 就惊慌 → 它是主动关闭方的正常状态（等 2MSL），高并发短连接服务器多为正常，真正要查的是 CLOSE_WAIT 泄漏
```
`ss -tin` 一行典型输出：
```
ESTAB 0 0 10.0.0.5:443 1.2.3.4:52134
   cubic wscale:7,7 rto:211 rtt:10.5/3.2 ato:40 mss:1448
   cwnd:10 bytes_acked:1500 retrans:0/2 rcv_space:14600   ← retrans 有 2 = 发生过重传
```
- **`retrans:0/2`** → 该连接历史上溢出 2 次重传，网络/对端有丢包。
- **`cwnd:1`** 且持续增长慢 → 刚超时回慢启动（s2-4）。
- **`rcv_space` 很小 / 对端 win=0** → 流量控制卡住，查消费端（s2-3）。

## 五、tcpdump + Wireshark：包络特征识别

**抓包三要素**：接口、过滤、别抓太多。
```bash
tcpdump -i eth0 host 1.2.3.4 and port 443 -w /tmp/cap.pcap   # 先落盘再离线分析
# 高频过滤器
tcpdump -i any 'tcp[tcpflags] & (tcp-rst) != 0'      # 只看 RST（谁拒的）
tcpdump -i any 'tcp[((tcp[12:1] & 0xf0) >> 2):4] = 0' # 进阶：零长度/特殊
```

**Wireshark 显示过滤器 + 要认的包络**：

| 现象 | 过滤器 | 判读（对应知识点） |
|---|---|---|
| 重传 | `tcp.analysis.retransmission` | 同一 seq 再发 → 丢包（s2-3） |
| 快速重传 | `tcp.analysis.fast_retransmission` | dupACK 触发 |
| 乱序 | `tcp.analysis.out_of_order` | 多路径/RSS 常见，少量正常 |
| 零窗口 | `tcp.analysis.zero_window` | 接收方 buffer 满 → 消费慢（s2-3） |
| RST | `flags.reset` | 明确拒绝（s2-2 五场景） |
| 三次握手完成时间 | `tcp.analysis.handshake` | 建连耗时 |

- **看"重复 ACK + 随后一个重传"** 是丢包的标准指纹；**看 `win = 0` 后跟 ZWP（1 字节 probe）** 是零窗口死锁边缘（s2-3）。
- 云环境抓不到？用 **端口镜像/流量镜像（VPC Traffic Mirroring）**，或退回 `ss -tin` + `nstat` 计数法。

## 六、内核计数：不打扰业务的旁证

```bash
netstat -s | grep -iE 'retrans|listen|overflow'   # 重传段数、SYN 队列溢出、拒连
nstat -az | grep -iE 'TcpExtListenOverflows|TcpExtListenDrops|TcpRetransSegs'
dmesg -T | grep -iE 'conntrack|overflow|TCP'       # conntrack 满、队列丢包
```
- `TcpExtListenOverflows` 增长 = 全连接队列溢出（s2-2）→ 查 accept 慢/GC。
- `TcpRetransSegs` 增速 = 全局重传率，突增说明网络或对端出问题。

## 七、线上排障 SOP（把上面串成流程）

```
1. curl -w 分段计时 → 定性在哪一段（DNS/建连/TLS/TTFB/传输）
2. 连不上：ping(可达) → nc 端口(听没听) → ss -lnt(队列满?) → telnet+tcpdump(RST? SYN 有去无回?)
3. 慢：ss -tin 看 rtt/retrans/cwnd → 有重传=网络/丢包；无重传且 ttfb 大=后端处理
4. 偶发无规律：nstat/dmesg 看 conntrack 满/队列溢出/端口耗尽（s4-1）
5. 拿铁证：tcpdump 落盘 → Wireshark 过滤 retrans/zero_window/rst
6. 修复后回归：同类计数是否归零（ListenOverflows 不再涨）
```

**心法**：① **先测量后动手**，别凭感觉调参；② **RST=明确拒绝、超时=静默丢弃**（s2-2），先看包类型定方向；③ **多数"网络问题"其实是服务端处理慢**（GC/慢查询/线程池满）——curl 的 ttfb 一测就知道该不该冤枉网络。

## 八、三大行业场景钩子

- **电商**：大促"下单偶发慢"，全链路 trace（s4-3）标出哪一跳；该跳用 `ss -tin` 发现 `retrans` 上升 → 定位到跨可用区链路抖动，切同区调用。
- **金融**：专线"凌晨首批交易超时"，`ss -ant state` 发现大量 CLOSE_WAIT（对端 idle 关了我们没关）+ `tcpdump` 看到对端 RST → 修连接池空闲回收与心跳（s2-1/s2-2）。
- **电力**：主站"部分终端连不上、无报错"，`dmesg` 见 conntrack 满、`nstat` 见 `ListenDrops` → 海量 NAT 终端打满跟踪表，走 notrack/大容量并加终端重连退避。

## 九、要点回顾

1. **四段定位法**：DNS / 建连(TCP+TLS) / TTFB(处理) / 传输 —— 用 `curl -w` 一张表先定性。
2. `ss -tin` 看逐连接 `cwnd/rtt/retrans/win`：重传=丢包、win=0=消费慢、cwnd 小=刚超时。
3. `ss -ant state close-wait/time-wait`、`ss -lnt` 的 Recv-Q/Send-Q 管状态与队列。
4. `tcpdump` 落盘 + Wireshark 过滤 `tcp.analysis.retransmission / zero_window / flags.reset` 拿铁证。
5. `nstat`/`netstat -s`/`dmesg` 做不打扰的旁证（溢出、重传、conntrack）。
6. 心法：**先测后调**、**RST=拒/超时=丢**、**别急着怪网络（ttfb 大是后端）**。
