# 抓包与网络排障方法论 · 小测验

### 1. 想最快定性"一次 HTTP 请求慢在哪一段"，首选（15分）

- A. 直接 tcpdump 抓一小时包
- B. `curl -w` 打印 time_namelookup/connect/starttransfer/total 分段计时
- C. 重启服务看是否变好
- D. 调大 somaxconn

> 答案：B
> 解析：`curl -w` 用几个时间戳把 DNS/建连/TLS/TTFB/总耗时拆开，一张表即可定性慢在哪段，是"先测后调"的第一步。抓包是拿铁证用的，不是定性首选。

### 2. Wireshark 中判"发生丢包重传"最直接的过滤器是（15分）

- A. `tcp.flags.syn==1`
- B. `tcp.analysis.retransmission`
- C. `http.response`
- D. `ip.dst==x`

> 答案：B
> 解析：`tcp.analysis.retransmission`（同一 seq 再次出现）是丢包重传的铁证；`fast_retransmission` 是 dupACK 触发的快速重传。判读呼应 s2-3。

### 3.【多选】`ss -tin` 输出里，哪些字段能反映链路健康（20分）

- A. retrans（重传计数）
- B. rtt
- C. cwnd
- D. bytes_acked

> 答案：ABC
> 解析：retrans>0 说明丢包、rtt 抖说明链路不稳、cwnd 突然=1 说明刚超时回慢启动。bytes_acked 只是累计发送量，不直接反映健康度。

### 4. 判断："看到对端回 RST" 和 "连接一直超时" 说明的是同一类问题（判断题）（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：完全不同。RST=对方**明确拒绝**（端口没监听、`abort_on_overflow`、对端已关你还发）；超时=报文被**静默丢弃**（队列满丢 SYN、防火墙 DROP、conntrack 满）。先分 RST/超时就能定方向（s2-2）。

### 5. 大量 `CLOSE_WAIT` 堆积，最可能说明（10分）

- A. 对端没关连接
- B. 本端应用收到 FIN 后没有调用 close()，连接泄漏
- C. 网络丢包严重
- D. DNS 解析失败

> 答案：B
> 解析：CLOSE_WAIT 是被动关闭方收到 FIN、回 ACK 后等本端 `close()` 才离开的状态；堆积=代码漏关（没关 response/没归还连接），会吃光 fd（s2-2/s4-1）。

### 6. 简答：接口 P99 偶发飙到几秒，运维怀疑"网络有问题"。请给出你作为后端的排障路径，并说明如何用证据判断到底是不是网络的锅。（30分）

> 参考答案：
> - 要点：先 `curl -w` 分段计时定性——若 `connect`/`appconnect` 正常而 `starttransfer(TTFB)` 大，说明**慢在后端处理**，不是网络。
> - 要点：`ss -tin` 看该连接 `retrans`、`rtt`——若 retrans 不涨、rtt 稳定，进一步排除丢包/链路；反之有重传才怀疑网络。
> - 要点：`nstat`/`netstat -s` 看 `ListenOverflows`、`TcpRetransSegs`；`dmesg` 看 conntrack 满；判断是否队列溢出/资源型偶发丢包（s4-1）。
> - 要点：若确是"偶发无规律"，用 tcpdump 落盘复现窗口过滤 retrans/zero_window/rst 拿铁证。
> - 结论要点：多数"网络问题"实为服务端 GC/慢查询/线程池/连接池耗尽——用后端监控（GC 日志、慢 SQL、线程池活跃数）与 TTFB 对齐时间轴自证清白；修复后看同类计数是否归零。
