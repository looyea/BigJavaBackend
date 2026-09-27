# 抓包与网络排障方法论 · 课后作业

> 两题各 50 分：一题制造并识别一次真实重传，一题写一份"接口变慢"的标准排障报告。

## 作业 1：用 tc netem 制造丢包并在抓包中识别（50 分）

**要求**：
1. 两端主机，服务端跑一个持续回数据的 TCP 服务，客户端 `curl`/`nc` 拉数据。
2. 在客户端网卡注入：`tc qdisc add dev eth0 root netem loss 5%`。
3. 同时 `tcpdump -i eth0 host <server> -w loss.pcap` 抓包。
4. Wireshark 打开，验证能过滤到 `tcp.analysis.retransmission`、`tcp.analysis.fast_retransmission`、`dup ack`，并观察 cwnd 变化（配合另一台 `ss -tin`）。
5. 清除规则 `tc qdisc del dev eth0 root`，对比无丢包时抓包无重传。

**验收标准**：
- 能截图重传/乱序/dupACK 的包络并指出对应 seq。
- 说明"5% 丢包"下 TCP 吞吐为何远不止掉 5%（cwnd 反复收缩 + 重传）。
- 对比有/无 SACK 时恢复速度（可选：`sysctl tcp_sacks`）。

**参考答案要点**：
- 丢包 → dupACK/超时 → 重传；每次丢包 cwnd 减半或回 1，吞吐非线性下降。
- SACK 让只重传缺段、恢复更快（s2-3/s2-4）。

## 作业 2：一次"接口 P99 突增"的排障报告（50 分）

**背景**：给一段模拟现场：`curl -w` 显示 connect=3ms、appconnect=8ms、starttransfer=2.5s、total=2.6s；`ss -tin` 该连接 retrans:0/0；GC 日志在相应有 2s 停顿；`netstat -s` ListenOverflows 不涨。

**要求**：据这些数据写一份 ≤300 字排障结论：
1. 慢在哪一段？（用 curl 分段差值论证）
2. 是不是网络的锅？（用 retrans=0 论证）
3. 真正根因是什么？下一步查什么/怎么改？

**验收标准**：
- 正确算出"starttransfer − appconnect ≈ 2.5s 全在后端处理"。
- 用 retrans=0 排除丢包，用 ListenOverflows 不涨排除队列。
- 根因落到 GC/慢处理，给出对策（调堆/GC 器、异步化、加超时熔断、扩消费者）与验证方式。

**参考答案要点**：
- 定性：connect/appconnect 正常 → 网络建连没问题；TTFB 巨大 → 服务端处理慢。
- 佐证：retrans=0、无队列溢出 → 非网络。
- 根因：Full GC 2s → STW 期间不处理请求 → 修 GC（选低停顿器/调堆/减分配）+ 上游设读超时避免级联（呼应 s2-3 慢消费→零窗口）。
