# 拥塞控制、粘包拆包与队头阻塞 · 课后作业

> 两题各 50 分：一题动手验证"粘包"并写一个长度字段定界解码器（直通 netty/s2-3），一题用 `ss -tin` 观测拥塞算法差异。

## 作业 1：复现粘包 / 半包，并用"长度字段"定界修复（50 分）

**要求**：
1. 写一个 Java TCP 服务端 + 客户端：客户端连续 `send` 三条消息 `"login"`, `"order"`, `"pay"`（每条前不加任何边界）。服务端用一个循环 `read(byte[1024])` 打印每次读到的内容。
2. 观察输出：很可能一次读到 `"loginorderpay"`（粘包）或某条被截断（半包）。
3. 定义协议：`[4 字节大端长度][body]`。客户端按此封装发送；服务端实现一个 `decode` 方法：从累积缓冲区先读 4 字节长度，再判断已收字节是否 ≥ 4+length，够就切出一条完整消息、不够就 return 等待（半包）。
4. 用随机分片（模拟网络把一次 write 拆成多个 TCP 段）压测：把发送端数据随机切成 1~7 字节小包发出，验证解码器仍能还原出正确的 3 条消息。

**验收标准**：
- 能展示"无定界→错乱""有长度字段→正确"的对比。
- 解码器逻辑与 Netty `LengthFieldBasedFrameDecoder` 语义一致（对应参数：`lengthFieldLength=4, initialBytesToStrip=4`）。
- 说明为什么 UDP 不需要这套定界。

**参考答案要点**：
- 维护一个 `ByteBuf`/`ByteArrayOutputStream` 累积，循环"可读字节数 ≥ 头+体长度"才切包，否则保留等待。
- UDP 有消息边界（一次 recvfrom = 一个数据报），TCP 无边界，故只有 TCP 需要应用层定界。

## 作业 2：观测并对比 CUBIC 与 BBR 的拥塞窗口行为（50 分）

**背景**：一台 Linux（≥4.9，含 `tcp_bbr`）。用 `scp`/`curl` 从本机向远端拉一个 200 MB 文件，分别在默认 cubic 与切到 bbr 下观测。

**要求**：
1. 记录当前算法：`sysctl net.ipv4.tcp_congestion_control`。
2. 传输中每秒采样一次逐连接状态：`ss -tin dst <对端IP>`，抓取字段 `cwnd`、`ssthresh`、`rtt`、`retrans`、`delivery_rate`。
3. 用 `tc netem loss 2%` 给链路注入 2% 丢包，重跑，对比 cubic 与 bbr 的**吞吐（`curl -w`）与 cwnd 曲线**。
4. 结论：为什么高丢包链路上 BBR 吞吐更稳？CUBIC 的 cwnd 在每次丢包时发生了什么？

**验收标准**：
- 能贴出注入丢包前后两组吞吐数据，并指出 cubic 下 cwnd 反复"锯齿腰斩"、bbr 下 cwnd/发送速率相对平稳。
- 正确区分“丢包触发的 cwnd 收缩”（cubic）与“基于带宽+RTT 建模的主动限速”（bbr）。
- 说出 BBR 的潜在公平性问题（与同链路的 loss-based 流抢带宽）。

**参考答案要点**：
- cubic：每次丢包 cwnd×0.7~0.5，高丢包→频繁腰斩→吞吐低且抖。
- bbr：以 `BDp=带宽×最小RTT` 为目标，丢包不必然判定拥塞（RTT 不涨就继续探），故吞吐高、延迟可控。
- 治理建议：跨地域/弱网用 bbr + fq；内网低丢包用 cubic 即可、且与邻居公平。
