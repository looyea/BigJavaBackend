# 小测验 · IP、子网划分与路由

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分，≥ 60 分过关。

### 1. 要给 500 台主机划一个网段，最合适的 CIDR 是？（15分）

- A. /22
- B. /23
- C. /24
- D. /21

> 答案：B
> 解析：需要 `2^m − 2 ≥ 500` → m = 9 → 前缀 `32 − 9 = /23`（512 地址、510 可用）。/24 只有 254 可用不够；/22 有 1022 可用属浪费（若明确要留 2 年扩展位则可有意识选大，但题目问"最合适"）。

### 2. 主机路由表匹配的核心规则是？（15分）

- A. 表项从上到下顺序匹配，命中即停
- B. 最长前缀匹配（最具体的前缀优先），同前缀长度再比优先级/metric
- C. 默认路由永远优先
- D. 直连路由永远优先

> 答案：B
> 解析：内核从 `/32` 向 `/0` 找最具体条目，所以 `169.254.169.254/32` 会优先于 `default`；只有前缀长度相同才比较 metric/priority。理解这一点才能解释"加了明细路由就绕过了网关"这类现象。

### 3. 【多选】关于 NAT 与 ICMP，正确的有哪些？（20分）

- A. SNAT 改写源 IP/端口、DNAT 改写目的 IP/端口；Docker `-p 8080:80` 与 K8s ClusterIP 都属于 DNAT
- B. conntrack 表打满（`nf_conntrack: table full, dropping packet`）会让新连接被静默丢弃，是高并发出网服务的典型隐形故障
- C. UDP 包发到没有监听的端口，对端会回 ICMP Type3 Code3，发送方 Java 表现为 `Port unreachable`（`SocketException`）
- D. ICMP Type3 Code4（需分片但 DF 置位）如果被中间防火墙丢弃，会造成 PMTUD 失效并形成 MTU 黑洞

> 答案：ABCD
> 解析：四项都是本节明确讲过的因果链。B 的处置见 s4-1；C 解释了"UDP 为什么也能报 connection refused"；D 是 s1-2 作业里 MTU 黑洞的完整闭环。

### 4. 判断：跨网段通信时，数据链路层的帧里目的 MAC 是最终目的主机的 MAC。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：跨网段时帧的目的 MAC 是**当前网关（下一跳路由器接口）**的 MAC，而 IP 头里的目的 IP 才是最终目标；每过一跳 MAC 都换，IP 不变（NAT 除外）。这正是 s1-1 "MAC 管这一跳、IP 管端到端" 的具体体现。

### 5. 填空题：`127.0.0.0/8` 的意义是 ______ ；DHCP 获取失败时系统自动取得的地址段是 ______ ；Docker 默认网桥网段是 ______ ，它最容易与 ______ 段发生冲突。（10分）

> 答案：全部回到本机（环回整段） / 169.254.0.0/16 / 172.17.0.0/16 / 172.16.0.0/12 / RFC1918 私网

### 6. 现场：机器 A 访问服务 B，报错依次可能是 `No route to host`、`Connection refused`、`Connection timed out`。请分别说明三种报错的成因层次，并给出各自的定位命令序列。（30分）

> 参考答案：
> - **`No route to host` / `Network is unreachable`**：本地或沿途**没有到目的 IP 的路由**（客户端路由表缺条目、返回路径断裂、中间路由器无路由）。定位：`ip route get <B>`（看用哪块网卡/是否走网关）、`ip route show`、`ip neigh show`（是否 `FAILED`）、`iptables -L OUTPUT -v`、云安全组出方向；再 `traceroute -T -p <port> <B>` 看断在哪一跳
> - **`Connection refused`**：包**到达了目的主机**，但没有进程监听该端口（或收到 RST / ICMP 端口不可达）。定位：B 上 `ss -lntp | grep <port>`、确认监听地址是否为 `0.0.0.0`/`::`（只监听 `127.0.0.1` 则外部一定拒绝）、检查是否 IPv4/IPv6 栈不匹配；容器场景确认端口映射与 Service Endpoint 是否存在
> - **`Connection timed out`**：SYN 发出去没有任何回应（既无 SYN/ACK 也无 RST）→ 包被**静默 DROP**：中间防火墙/安全组/ACL 丢弃、对端 backlog/半连接队列打满、路径黑洞、非对称路由被状态防火墙拦。定位：两端同时抓包看 SYN 是否到达、`ss -lnt` 看 `Recv-Q/Send-Q` 是否满、`netstat -s | grep -i synReTrans`、`nf_conntrack_count` 与 `dmesg` 是否有 table full
> - 结论：三种报错分别对应"路由层无路径""传输层无人接""被中间设备丢弃或队列满"，是 s4-2 四段定位法的入口
> - 加分：指出 `ping` 通不代表端口可达（ICMP 与 TCP 独立），`ping` 不通也不代表服务不可用（ICMP 可能被禁），必须用 `nc -vz` / `curl` / `traceroute -T -p` 按端口测
