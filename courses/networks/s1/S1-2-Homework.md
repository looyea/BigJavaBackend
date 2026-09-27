# 课后作业 · 以太网、交换机与 VLAN

> 2 题，一题为动手观察 ARP/MAC/邻居表行为，一题为多租户网络隔离方案设计，附验收标准与参考答案。

## 作业 1：亲眼看看 ARP 与邻居表的状态机（50分）

**要求**：在两台 Linux（或一台 + 路由器/网关）组成的局域网内完成下列观察，并提交一份记录：

1. 清空邻居表：`ip neigh flush all`，然后立即 `tcpdump -i <网卡> -nn arp` 的同时 `ping -c 3 <同网段另一台>`。
2. 记录：ARP 请求与应答的**源/目的 MAC**、操作码（`who-has` / `is-at` / `request` / `reply`），以及 ping 的第一个 ICMP 包是在 ARP 应答**之前还是之后**发出。
3. 观察 `ip neigh show` 中该表项的状态变化（`REACHABLE → STALE → FRESH/DELAY → PROBE`），并说出 `arping -I <网卡> -U <本机IP>` 发出的属于哪种 ARP。
4. 制造一次"IP 被抢用"：在 B 机器上临时配置与网关相同的 IP（实验环境！），观察 A 的 `ip neigh show` 与抓包中的 ARP 变化，说明这个攻击/误配为什么能让全网断流。

**验收标准**：
- 能明确答出：ARP 请求的目的 MAC 是 `ff:ff:ff:ff:ff:ff`（广播），应答是单播；ARP 未解析完成前 ICMP 无法发出（所以第一个 ping 常超时或时延偏高）。
- 能区分 `REACHABLE`（确认过可达）/`STALE`（缓存过期但未验证，发包时会重新探测）/`FAILED`（解析失败）/`INCOMPLETE`（发了 ARP 没收到回复）。
- 能说出免费 ARP 的特征：发送方 IP == 目标 IP，用于宣告"这个 IP 是我的 MAC"。
- 结论要落到排障纪律：`ping` 不通但 `arping` 通 → 二层没问题、三层/路由/防火墙问题；两者都不通 → 物理链路、VLAN 未放行或 MAC 表问题。

**参考答案要点**：
- 抓包典型输出：
  ```
  ARP, Request who-has 10.0.1.5 tell 10.0.1.8, length 28     ← 广播
  ARP, Reply  10.0.1.5 is-at 00:11:22:33:44:55, length 46    ← 单播
  ```
- `arp -n` / `ip neigh` 的缓存时长由 `net.ipv4.neigh.<iface>.base_reachable_time_ms`（默认 30000 ms，实际在 ±50% 随机）控制；这也是"IP 变更后最长约半分钟才自愈"的来源，故 VIP 漂移必须靠主动免费 ARP，而不是等缓存过期。
- LVS-DR / keepalived 场景必须配：
  ```bash
  net.ipv4.conf.all.arp_ignore = 1        # 只有请求的目标 IP 配在本接口才应答
  net.ipv4.conf.all.arp_announce = 2      # 应答时尽量用与源网段匹配的本地 IP，避免用 VIP 应答
  ```
  否则**所有 RS 都抢着应答 VIP 的 ARP**，流量全打到某一台，负载均衡彻底失效。
- IP 冲突现象：抓包看到两个不同 MAC 用同一 IP 反复发 ARP reply（gratuitous/arp-conflict），邻居表在两个 MAC 间来回抖动 → 通信表现为"时好时坏"，比彻底不通更难查。

## 作业 2：为云平台设计多租户网络隔离方案（50分）

**要求**：某云/中台需要支持 ≥ 20,000 个租户，每个租户内部还要划分子网、支持虚机跨机房热迁移、要求租户之间二层完全隔离。请给出方案并回答四个问题：

1. 只用 VLAN 能否满足？为什么？
2. 用 VXLAN 后，VLAN 还有用吗？两者怎么配合？
3. 虚机热迁移过程中，如何保证同网段其他机器不继续把包发给旧位置？
4. 这个方案会引入什么新的性能与故障面？给出对应的监控指标（至少 3 个）。

**验收标准**：
- 第 1 问要给出量化理由：VLAN ID 12 位 → 最多 4094，不够 20,000 租户；且大二层广播域无法扩展到跨机房规模（ARP/广播泛洪 + STP 收敛）。
- 第 2 问要说明**VLAN 用于 Underlay/物理侧或租户内部细分，VNI（24 bit）用于租户隔离**，VTEP 负责封装/解封装。
- 第 3 问答出：**目的端 VTEP 发送免费 ARP / RARP 更新**（或控制面下发流表），同时交换机 MAC 表被重新学习。
- 第 4 问要提到 MTU 开销、封装/解封装的 CPU 开销（可用网卡 offload 或 VTEP 硬件化）、Overlay 控制面的收敛与故障域扩大。

**参考答案要点**：
- 方案：Underlay 用 L3 ECMP 全互联（放弃大二层 + STP），Overlay 用 VXLAN，VNI = 租户 ID，每个 VTEP（宿主机 vswitch 或硬件网关）维护 MAC/IP ↔ VTEP 的映射表，通过控制面（BGP EVPN 或集中控制器）学习而不是靠泛洪。
- 规模与隔离：VNI 24 bit → 1600 万，绰绰有余；租户内再切子网（L3）+ 安全组（L3/L4 有状态过滤，落在 conntrack，见 s4-1）。
- 热迁移：迁移完成后目的端 VTEP 广播免费 ARP + EVPN 路由更新（Type-2 路由带序列号做新者优先），旧位置表项失效；期间用"停机秒级 + 报文重定向"保证不丢包。
- 监控指标清单（答出三个即可）：
  - 各端口 `rx_crc_errors / rx_errors / if_discards`（物理与网卡层丢包，`ethtool -S`）
  - vswitch/网桥的**未知单播泛洪包速率**与 MAC 表使用率（反映控制面是否正常下发）
  - Overlay 接口的 **MTU 一致性与分片/丢弃计数**、VTEP 间 `UDP 4789` 的丢包与 RTT
  - conntrack 表使用率（`nf_conntrack_count / max`）与丢包计数
- 反思题：为什么不干脆全用 L3（每个租户一个 VRF、Pod 直接 routing）？→ Calico 路线正是如此：省掉封装开销与 MTU 问题，但失去"同二层"能力（跨机房 L2 迁移、需要二层的服务如部分传统中间件组播发现）。**能说出这个取舍，就是合格的架构回答。**
