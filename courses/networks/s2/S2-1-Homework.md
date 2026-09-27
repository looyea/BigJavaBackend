# 课后作业 · UDP 与 Socket API 语义

> 2 题，一题为动手实现一个"最小可用可靠 UDP"（体会为什么要自己补可靠性），一题为连接池死连接案例分析，附验收标准与参考答案。

## 作业 1：给 UDP 加上序号、去重与超时重传（50分）

**要求**：用 Java `DatagramSocket` 实现一个"文件片段可靠投递"小程序，协议自己定义，要求：

1. 报文头固定：`magic(2B) + version(1B) + msgType(1B) + seq(4B) + totalLen(4B) + body`；body 最大 **1024 字节**（提示：不要贴着 MTU 设计）。
2. 发送方：为每个数据报编号，发送后启动超时重传（超时值可先固定 200 ms，最多重传 5 次），收到对端的 **ACK(seq)** 才推进窗口。
3. 接收方：按 seq 去重（允许乱序到达时暂存），检测空洞则不 ACK（让超时重传兜底），完整收到后回最终 ACK。
4. 说明：你这个极简协议离"能用"还差哪三件事？

**验收标准**：
- 报文边界处理正确：`DatagramPacket` 长度用 `getLength()` 而非缓冲区长度（否则会把上一次的残留字节当数据）。
- 重传有**上限与退避**，并有唯一 `msgId` 保证"整个消息"级别幂等（重传可能造成重复）。
- 用 `port=0`（随机端口）+ 单 socket 收发同一会话，理解"五元组"在 UDP 上的对应关系。
- 明确说出：你手工实现了**序号 + 确认 + 超时重传 + 去重**，也就是在应用层重写了一遍 TCP —— 这就是"能直接用 TCP 时不要自研可靠 UDP"的量化理由。
- 第 4 问的三件事（答出任意三条即可）：**流控**（对端来不及处理会被自己刷爆，TCP 有窗口）、**拥塞控制**（不加就会挤垮同链路 TCP，QUIC 为此专门实现 CUBIC/BBR）、**路径 MTU 管理**（不做 PMTU 探测就会 IP 分片，一片丢即整包丢）、以及顺序交付/RTT 估计与 RTO 计算/加密与鉴权/半连接与连接标识（UDP 无连接，如何防伪造与做会话复用）。

**参考答案要点（骨架）**：
```java
record Frame(byte type, int seq, byte[] body) { }

void sendReliable(DatagramSocket s, SocketAddress peer, List<byte[]> chunks) throws Exception {
    Map<Integer, Long> sentAt = new HashMap<>();          // seq -> 最近发送时刻
    Set<Integer> acked = new HashSet<>();
    long deadline = System.currentTimeMillis() + 10_000;
    while (acked.size() < chunks.size()) {
        if (System.currentTimeMillis() > deadline) throw new IOException("give up: unreliable link");
        for (int i = 0; i < chunks.size(); i++) {          // 简化：每轮把所有未确认的发一遍（生产应限窗口）
            if (acked.contains(i)) continue;
            if (sentAt.getOrDefault(i, 0L) + 200 > System.currentTimeMillis()) continue;
            s.send(new DatagramPacket(encode((byte) 1, i, chunks[i]), peer));
            sentAt.put(i, System.currentTimeMillis());
        }
        byte[] buf = new byte[1200];
        DatagramPacket p = new DatagramPacket(buf, buf.length);
        s.setSoTimeout(50);
        try { s.receive(p); acked.add(decode(p).seq()); }   // ACK 帧：body 里带 acked seq
        catch (SocketTimeoutException ignore) { }           // 超时即进入下一轮，触发重传
    }
}
```
- 关键体会：`setSoTimeout` 让"收 ACK"与"发重传"能在单线程里轮询；生产环境应改为非阻塞 + 时间轮（Netty `HashedWheelTimer`，见 netty/s3-1）。
- 反思：如果你加了窗口、加了拥塞控制、加了 SACK，你已经写出一个慢版本的 TCP，且没有内核优化（GRO/TSO、offload）。**选 UDP 的理由必须是"我要不同于 TCP 的可靠性策略"**（实时、按流独立重传、一对多），而不是"图省事"。

## 作业 2：连接池里的"死连接"导致业务间歇性失败（50分）

**要求**：某服务用 TCP 长连接池访问下游（自建连接池，最大空闲 5 分钟，无心跳）。现象：每天凌晨 3:00~3:10 之间，第一批请求大量报 `Broken pipe` 或写完读不到响应超时，之后自动恢复。请：

1. 给出根因（至少两个可能，并指出最可能的一个）。
2. 说明从客户端角度，如何区分"连接已失效"和"下游处理慢"。
3. 设计修复方案：空闲检测、可用性与复用性判定的具体规则（含参数取值理由）。
4. 说明为什么"读超时之后不能把这条连接放回池里"。

**验收标准**：
- 根因 1：**中间设备（NAT/防火墙/LB）在低峰期回收空闲映射/会话**，客户端与服务端都不知道，连接"看起来还在池里"但路径已断；凌晨低峰正好触发（呼应 s1-3 NAT 老化）。根因 2：服务端/LB 有 idle timeout（如 60 s/300 s）主动关闭并发 FIN，客户端未读到 EOF 或读到了但没做失效处理。根因 3：服务端凌晨发布/重启、GC 停顿或 TCP keepalive 探测失败发 RST。
- 最可能是**空闲被中间设备或服务端静默回收**，因为它与"每天固定低峰时段、第一批失败后自愈"完全吻合（第一次失败触发建连，新连接正常）。
- 区分手段：`read()==0`/`SocketException: Connection reset` = 连接已失效（立即重建）；读超时但连接可写、且**同一时刻其他连接正常** = 下游慢；**所有连接同时超时** = 链路或对端整体故障。要能说出"用一次 `available()`/立即探测不可靠，必须靠实际读写结果判定"。
- 修复方案：① **应用层心跳**（周期性 ping/空请求，间隔 < 路径上最小的 idle timeout，典型取 15~30 s；比 TCP keepalive 的 7200 s 有效得多）；② 客户端最大空闲时间设为 `min(服务端 idle, LB idle, NAT timeout) × 0.6`，并加随机抖动避免集中失效；③ 借用连接前做**有限有效性检查**（如 `isClosed()`、JDBC 的 `validationQuery`/`isValid(timeout)`；注意 TCP 层无法零成本探活，检查只能挡掉"已知已关闭"）；④ 失败即**丢弃 + 重建 + 幂等重试一次**（只对可安全重试的请求，如心跳/GET）；⑤ 监控：连接池"新建速率、失效丢弃数、借出等待时间、首次请求失败率"。
- 第 4 问必答：读超时后接收缓冲区里可能残留**上一次响应的多余字节**（协议错位），放回池里会让下一个请求读到别人的响应，造成"数据串号"这种最难查的故障。**协议错位比丢包更危险**，所以超时/异常后必须关闭连接（HTTP 客户端、数据库驱动都遵循此规则）。
- 加分：指出 `connect` 成功不代表应用可用（本节核心），因此"池里没有探活机制"这句话本身就等价于"迟早出事"。
