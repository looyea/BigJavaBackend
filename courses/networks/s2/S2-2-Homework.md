# 课后作业 · TCP 三次握手 / 四次挥手与状态机

> 2 题，一题为动手复现并定位 `CLOSE_WAIT` 泄漏（真正的排障演练），一题为握手工时与队列容量的量化分析，附验收标准与参考答案。

## 作业 1：复现并修复一个 `CLOSE_WAIT` 泄漏（50分）

**要求**：写一段 Java 程序制造连接泄漏，然后完成定位与修复：

1. 服务端：一个只 `accept()` 但**从不 `close()` 已读尽的 socket** 的线程（模拟"HTTP 客户端读完响应忘记 close"）。
2. 客户端：循环新建连接、发一个请求、读完响应后**直接丢弃引用**（不 close），共 500 次；随后进程退出。
3. 观察并回答：① 服务端 `ss -ant state close-wait | wc -l` 的增长曲线；② 服务端 `ls /proc/<pid>/fd | wc -l` 与 `ulimit -n` 的关系；③ 什么时候开始报 `Too many open files`；④ 这些 `CLOSE_WAIT` 会在什么时候自动消失？
4. 用 try-with-resources 修复，并给出一个"防止再次发生"的工程措施（代码规范 / 静态检查 / 监控）。

**验收标准**：
- 能解释为什么客户端退出后服务端不会自动到 `TIME_WAIT`：客户端进程退出时其 socket 被内核关闭并发 FIN，服务端**收到 FIN 后回 ACK 并停在 `CLOSE_WAIT`**，只有应用 `close()` 才发自己的 FIN。因此"服务端有没有 `CLOSE_WAIT` 堆积"完全取决于**自己的代码**，与对端行为无关。
- 能明确回答第 ④ 问：**不会自动消失**（Linux 没有 `CLOSE_WAIT` 超时参数，只能等应用 close 或进程退出）——这是它比 `TIME_WAIT` 危险得多的原因。
- 定位链条完整：`ss -antp state close-wait`（找 pid）→ `lsof -p <pid> | grep TCP | wc -l` 或读 `/proc/<pid>/fd`（看 fd 用量）→ `ulimit -n`（判上限）→ 代码审查 `close()` 路径 → 用 `-XX:+TraceFileClosed`/Java agent/`jcmd <pid> Thread.print` 或 `sslsplit` 之类手段定位句柄。
- 修复方案：try-with-resources；HTTP 客户端必须 `response.close()`/`EntityUtils.consume`；连接池必须"借出即计数、归还有界、异常也归还"。
- 工程措施（任两条）：① 监控 `CLOSE_WAIT` 数量告警（阈值如 > 1000 或 5 分钟单调上升）；② CI 静态检查禁止 `new Socket()`/裸 `HttpClient` 不 close（Error Prone / ArchUnit 规则）；③ 统一封装客户端与连接池，业务侧禁止自建 socket；④ 上线前压测覆盖 fd 泄漏（长时间跑观察 fd 曲线）。

**参考答案要点**：
```java
// 泄漏版服务端：只 accept、只 read 到 EOF，从不 close
while (true) {
    Socket s = server.accept();
    executor.submit(() -> { drain(s.getInputStream()); /* 忘记 s.close() → CLOSE_WAIT 常驻 */ });
}
// 修复：try-with-resources 保证任何路径都 close
executor.submit(() -> { try (Socket c = s) { drain(c.getInputStream()); } });
```
```bash
ss -ant state close-wait | wc -l                 # 随请求数线性增长且不下降
cat /proc/<pid>/limits | grep 'open files'        # 真实上限（容器内还要看 cgroup 与 systemd LimitNOFILE）
ss -ant state time-wait | wc -l                   # 对照：这是主动关闭方才有的
```
- 引申结论：**"谁先关"决定谁积累 `TIME_WAIT`，"谁没 close"决定谁积累 `CLOSE_WAIT`**。把这两句话讲清楚，本节就掌握了。

## 作业 2：握手工时与队列容量测算（50分）

**要求**：某服务 RTT = 5 ms，`tcp_syn_retries = 6`（Linux 客户端默认），`tcp_synack_retries = 5`，服务端 `somaxconn = 128`、Tomcat `acceptCount = 100`、`maxConnections = 8000`。请回答：

1. 客户端一次 `connect()` 在最坏情况下会阻塞多久（对端 SYN 全丢）？"配置了 3 秒连接超时却没生效"可能是什么原因？
2. 服务端全连接队列实际长度是多少？新建连接速率突增时会发生什么？
3. 若压测目标是"每秒新建 3 万连接"，你会检查哪些参数与容量项（至少 5 项）？
4. 设计一次"重启风暴"演练：30 万终端在 10 秒内全部重连，如何证明系统能扛住？

**验收标准**：
- 第 1 问：SYN 重传间隔近似指数（1, 2, 4, 8, 16, 32 s，受 RTO 最小值与实现影响），`tcp_syn_retries=6` 总耗时约 **127 s**（约 2 分钟量级）。"3 秒超时没生效"的原因：超时设在了 `setSoTimeout`（读超时）而没设在 `connect(addr, timeout)`；或线程阻塞在 DNS 解析（`InetAddress` 是阻塞调用）；或连接池在"取连接"阶段排队而非真正在建连。
- 第 2 问：实际 = `min(acceptCount=100, somaxconn=128) = 100`；**`maxConnections` 8000 是已建立连接数上限，与队列无关**（这是最常见的混淆）。溢出时默认静默丢 SYN → 客户端超时重传 → 表现为 P99 长尾而非错误率飙升，**极难从应用日志发现**。
- 第 3 问（答出 5 条即可）：`somaxconn`、`tcp_max_syn_backlog`、`ip_local_port_range`（客户端端口）、`nf_conntrack_max`（有状态设备/本机开 conntrack 时）、fd 上限（`ulimit -n`/systemd `LimitNOFILE`）、每连接内存（收发缓冲 + TCP 修复缓冲 ≈ 数 KB～数十 KB）、`accept` 单线程锁竞争（是否用 `SO_REUSEPORT` 或多监听）、应用 accept 后是否立刻交给线程池（否则 accept 就是瓶颈）、新建连接的 TLS 握手 CPU（非对称运算常比业务本身更贵）。
- 第 4 问要给出**可验证的演练设计**：终端侧指数退避 + 随机抖动（jitter，如 0~30 s）把 30 万重连摊平；服务端准备"新建速率/半连接溢出计数 `ListenDrops`/TLS 握手失败率"三个核心指标；逐步加压（1 万 → 5 万 → 30 万）并观察是否出现 `SYN-ACK` 重传与队列溢出；预案包含降级（先放认证再放业务、只放心跳）。

**参考答案要点**：
- 计算：`1+2+4+8+16+32(+64) ≈ 63~127 s`（内核用 RTO 指数退避，起始约 1 s），所以"连接超时"若不自定义会被拖到分钟级 → **业务超时必须自己设且要覆盖建连阶段**。
- 关键提醒：`tcp_abort_on_overflow` 保持 0（默认）意味着"溢出只会表现为超时"。若要**快速失败可观测**，可临时开 1 让客户端立刻收到 RST（但要评估对上游的冲击），或用 `nstat -az | egrep 'ListenOverflows|ListenDrops'` 建立常态监控。
- 架构结论：**新建连接是有昂贵成本的操作**（内核状态 + 队列 + TLS + 认证），所以"长连接 + 连接池 + 复用"既是性能优化也是稳定性手段；对海量终端场景，接入层要与业务层分离，接入层只做握手与认证、把请求转发给后端，避免后端被建连风暴压垮。
