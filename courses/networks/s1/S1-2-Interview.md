# 面试考点 · 以太网、交换机与 VLAN

> 二三层知识在后端面试里以**"排障题"和"云网络设计题"**的形态出现。答好的标志是：能说出机制、能给出验证命令、能落到具体线上故障。

## 考点 1：交换机 / 路由器 / Hub 与广播域、冲突域

**起手**：交换机和路由器的本质区别？

**期望**：交换机二层，按 **MAC 表**在**同一广播域内**转发；路由器三层，按 **IP 路由表**跨网转发并**隔离广播域**。

**追问链**：
1. 广播域 vs 冲突域？→ Hub：一个冲突域一个广播域；Switch：每端口一个冲突域，默认同一广播域；路由器/VLAN：切广播域。
2. 三层交换机是什么？→ 硬件加速的路由 + 二层交换合一，数据中心内部大量使用。
3. 为什么"必须在故障机本机抓包"？→ 交换机对单播定向转发、不泛洪（除非未知单播），第三方看不到；需要端口镜像 SPAN。

## 考点 2：ARP 与它的线上故障（高频）

**起手**：一个 IP 包怎么找到目的 MAC？缓存多久？

**追问链**：
1. ARP 请求广播、应答单播，双方都学习 —— 为什么应答方也会学到请求方的 MAC？→ 因为请求帧的源 MAC 就在帧头里，顺手学。
2. 服务器换了网卡/IP 变了，为什么对端还打旧 MAC？→ 邻居表缓存（`base_reachable_time_ms` 默认 30 s，加 ±50% 随机），要主动 `arping -U` 免费 ARP 刷新。
3. keepalived VIP 漂移为什么能秒级生效？→ 新主发免费 ARP，刷交换机 MAC 表和邻居 ARP。
4. LVS-DR 为什么必须配 `arp_ignore=1 / arp_announce=2`？→ 否则所有 RS 都应答 VIP 的 ARP，流量集中到一台，模式失效。
5. ARP 能防伪吗？→ 能，这就是 ARP 欺骗/中间人；防御是 DAIs（Dynamic ARP Inspection）/静态绑定。

**加分**：能报出 `ip neigh show` 的 `REACHABLE/STALE/FAILED/INCOMPLETE` 状态含义，并给出"`arping` 通而 `ping` 不通 = 二层正常、三层或防火墙问题"的判据 —— 这是真正的排障经验。

## 考点 3：VLAN / trunk / access

**起手**：access 和 trunk 端口的区别？

**期望**：access 属单一 VLAN、收发剥离/加上 tag，接终端；trunk 允许多 VLAN、保留 tag，用于设备互联或服务器多平面。

**追问链**：
1. VLAN 数量上限？为什么？→ 4094（12 bit，去掉 0 与 4095 保留值）。
2. 一个服务器要同时接管理网与业务网怎么办？→ 双网卡，或单网卡 trunk + `ip link add ... type vlan id N` 子接口。
3. 不同 VLAN 之间能通信吗？→ 需要三层设备（路由器/三层交换机/网关）+ ACL；这就是"跨网段必须过网关"的原因。
4. Native VLAN 是什么坑？→ trunk 上不打 tag 的帧归属 native VLAN，两端配置不一致会导致流量串到错误网段（安全 + 丢包双重事故）。

## 考点 4：云网络：VLAN vs VXLAN vs SDN（架构级常考）

**起手**：公有云怎么做到几万租户网络隔离？

**期望**：
- VLAN 不够：只有 4094 个、二层域无法跨机房扩展（广播泛洪 + STP 收敛慢）。
- **VXLAN**：把二层帧封进 `UDP:4789`，VNI 24 bit（1600 万）；Underlay 全 L3 ECMP，绕开 STP；支持虚机跨机房热迁移。
- 控制面用 **BGP EVPN** 或集中控制器下发 MAC/IP↔VTEP 表项，避免泛洪学习。
- 云上再叠加安全组（有状态 L3/L4 过滤，落在 conntrack）、ACL、Load Balancer（s3-4）。

**追问链**：
1. VXLAN 的代价？→ **50 字节封装开销 → MTU 降到 1450**、封装/解封装耗 CPU（可 offload）、Overlay 控制面成为新故障域、MTU 黑洞。
2. 那不用 Overlay、直接路由（Calico 路线）呢？→ 省开销与 MTU 问题，但失去同二层能力（跨机房 L2 迁移、依赖组播/广播发现的传统中间件）。**能讲出这个取舍就是加分答案。**
3. MTU 黑洞怎么定位？→ `ping -M do -s 1472 <peer>`（DF 探测）、比对 `ip link` 各接口 MTU、看只重传同一 seq 大包；修复见 s1-2 作业。
4. 什么是"未知单播泛洪"？→ 交换机 MAC 表没有目的表项（老化、非对称路由、表满）时泛洪，会打满端口、放大故障。

## 考点 5：链路层排障工具箱（说出命令就是差异化）

| 目的 | 命令 |
|---|---|
| 看链路协商速率/双工/错误计数 | `ethtool eth0`、`ethtool -S eth0`（`rx_crc_errors`、`rx_discards`、`tx_carrier_errors`） |
| 看 IP ↔ MAC | `ip neigh show`、`arping -I eth0 <ip>` |
| 看 MAC 表（交换机侧） | `show mac address-table`（华为 `display mac-address-table`） |
| 看二层拓扑/泛洪 | `bridge link show`、`bridge vlan show`、`tcpdump -e` 看帧头 |
| 看 MTU 与分片 | `ip link`、`ping -M do -s`、`tcpdump -vv 'ip[6:2] > 0 and (ip[6] & 0x40) == 0'` |
| 光模块/物理层 | `ethtool -m`（收发光功率），错包多时第一嫌疑 |

**方法论提示**：答这类题时先说"我会先确认是哪一层的问题"，再给命令与判据 —— 分层定位能力本身就是这节的考核点。

## 考点 6：行业落地

- **电商/云原生**：CNI（VXLAN/Calico/Cilium）导致的大包超时、ARP 表刷新导致的节点替换后连不上，是"看起来像应用 bug 的网络问题"两大主力。
- **金融**：交易网 VLAN + ACL 强隔离；VIP 漂移（免费 ARP）实现秒级切换；撮合链路用 PTP 硬件时间戳与 RDMA 绕开协议栈。
- **电力**：变电站过程层 GOOSE/SV 是**纯二层组播**（EtherType 0x88B7/0x88BA），要求交换机支持 VLAN、优先级队列、RSTP 快速收敛，且不允许 IP 层出现 —— 与配电终端走 APN 专网（L3 + NAT）形成两层并存的现实。
