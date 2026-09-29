# 分布式共识：Paxos / Raft / ZAB

> 本节难度：★★★★★
> 重要程度：★★★★★
> 学习产出：能用"多数派相交必有余集"讲清 Quorum 为什么能保证已提交值不丢；画出 Raft 的选主—日志复制—安全提交三条主线并解释 term 与预选举限制各自防什么；说清 Multi-Paxos、Raft、ZAB 的目标差异与工程对应物（etcd/ZooKeeper/Kafka KRaft）；识别共识日志与数据库复制的本质区别——共识是"对条目顺序达成一致"，不是"备份数据"。

```flow
例子目的：一次 Raft 写入的完整旅程——客户端只与 Leader 对话，Leader 把条目复制给多数派后才提交并对客户端确认
Client -> Leader(term=5): 写 x=1
Leader -> Follower A: append_entries(term=5, idx=8, x=1)
Leader -> Follower B: append_entries(term=5, idx=8, x=1)
Follower A -> Leader: ack idx=8
Follower B -> Leader: ack idx=8(多数派 3/5 达成)
Leader -> Leader: 状态机应用 x=1 并提交
Leader -> Client: OK(此后任何新 Leader 的日志必含该条目)
```

## 一、共识要解决的最小问题

单机故障转移的根因：**两个节点都自认为是主**（网络分区、GC 停顿都可能）。共识 = 让一组节点对"**什么值在什么顺序上成立**"达成一致，且满足三条安全性：

1. **终止性**：正常节点最终会得到决定（活人不会永远等）；
2. **Agreement（不矛盾）**：不会有两个节点决定出不同的值；
3. **非平凡性**：决定的值必须是某个节点提出过的（不能凭空投票）。

核心武器只有一个——**多数派（Quorum）**：`N/2+1` 个节点确认才算提交。数学依据：**任意两个多数派至少相交 1 个节点**，相交节点记住了已提交的历史，新任 Leader 提案时必然经过它，因此已提交的值永远不会"被遗忘后覆盖"。

```java
// 例子目的：用 30 行代码验证"多数派相交"这一共识安全性的唯一基石
class QuorumMath {
    // 目的：模拟 N=5 集群中任意两个 quorum 的交集必非空
    static java.util.Set<Integer> quorum(int n, int seed) {   // 例子：按 seed 确定性取 N/2+1 个节点
        java.util.Set<Integer> s = new java.util.TreeSet<>();
        for (int i = 0; i < n / 2 + 1; i++) s.add((i * 2 + seed) % n);   // 说明：只是构造示例子集，重点是大小=N/2+1
        return s;
    }
    public static void main(String[] args) {
        java.util.Set<Integer> a = quorum(5, 0);              // 输出：{0,2,4}（3 个节点）
        java.util.Set<Integer> b = quorum(5, 1);              // 输出：{1,3,0}（另一种多数派取法）
        a.retainAll(b);                                        // 结果：交集 {0}——错误用法：若改成各取 2 个（非多数派），交集可以为空，两拨人各选一个主，脑裂
        System.out.println(a);                                 // 输出：[0]——任何"已提交"记录至少被这 1 个节点持有
    }
}
```

## 二、Paxos：理论完备但难懂的鼻祖

Basic Paxos 对**单个值**达成一次共识，三角色两阶段：

- **Proposer**：发出 `prepare(n)` 提案编号 → 收到承诺后发 `accept(n, value)`；
- **Acceptor**：承诺"不再接受编号 < n 的提案"；若已有已接受值，把它回给新 Proposer；
- **Learner**：观察多数派接受结果。

关键不变式：**编号单调 + Acceptor 记住已接受值**，保证后到的提案只能"采纳先值"或提出新值，绝不推翻已定值。

工程痛点：Basic Paxos 一次只定一个值；要复制日志需 **Multi-Paxos**（选出一个稳定 Leader 后跳过 prepare 阶段，直接连续 accept）——但"怎么选稳定 Leader、日志怎么补齐空洞"规范里全没写，所以每个实现都自己发明，导致 Paxos 系实现难审正确性。Chubby 用 Multi-Paxos。

## 三、Raft：为可理解性设计的工程共识

Raft 把问题切成三块，每块都能讲成一个故事：

**1. 选主**：节点任期 term 递增；心跳超时转 Candidate，拉票获得多数派即 Leader。防脑裂双闸：一个 term 内一个节点只投一票 + 多数派相交。

**2. 日志复制**：Leader 把条目 `append_entries` 推给 Follower，多数派落盘即提交。**一致性检查**在追加时做：携带 prevLogIndex/prevLogTerm，不匹配则回退重试——这保证 Follower 日志是 Leader 日志的前缀，**不需要 Paxos 式的空洞补齐**。

**3. 安全性（最难也最关键）**：仅"活着的多数派"不够，必须保证**新 Leader 日志包含所有已提交条目**。两道规则：
- 投票限制（选举完整性）：Candidate 只有自己"最后条目 (term, index) 不低于投票者"才能拉票——落后节点当不上主；
- 只提交当前 term 条目：旧 term 条目靠"被后续条目间接带上去"才提交，堵住"多数派但未被下游复制"的窗口。

```yaml
# 例子目的：一份最小 etcd 配置，标注每个参数背后的 Raft 机制（改坏会直接违反安全性或终止性）
listen-peer-urls: http://10.0.0.1:2380      # 例子：节点间 Raft 通信口，结果：peer 流量走独立端口便于隔离限速
listen-client-urls: http://10.0.0.1:2379    # 说明：客户端读写字在此口，走 Leader 或 ReadIndex
initial-cluster: node1=http://10.0.0.1:2380,node2=http://10.0.0.2:2380,node3=http://10.0.0.3:2380   # 目的：静态 3 节点，凑齐多数派 2
heartbeat-interval: 150ms                   # 说明：Leader 心跳周期，输出：Follower 超过选举超时未收到即发起选举
election-timeout: 1500ms                    # 目的：约为心跳 10 倍——错误用法：设成比心跳还短，集群震荡永远在选主
snapshot-count: 100000                      # 说明：日志压缩阈值，目的：防止日志无限增长拖垮重启追平时间
```

## 四、ZAB：ZooKeeper 的"准同步"共识

ZAB 与 Raft 形似（单 Leader、多数派、zxid 全局单调），差异点：

- **两阶段提交广播**（类比 2PC）：Leader 发 `proposal` → Follower 落盘 ack → Leader 发 `commit`——**广播给全体**而非"多数派落盘即视为可应用"，各节点在同一个广播点应用，状态更同步；
- **恢复阶段**选主后先做数据对齐（新旧两种快照策略），再开服务；
- **zxid = epoch(高32位) + 计数**，等价 Raft 的 (term, index)。

## 五、三者对比与选型判断

| 维度 | Multi-Paxos | Raft | ZAB |
| --- | --- | --- | --- |
| 设计目标 | 理论普适共识 | 可理解、可教学可审 | ZK 顺序一致 + 同步友好 |
| Leader | 弱化（每次提案独立） | 强 Leader，一切经主 | 强 Leader |
| 日志形态 | 可能有空洞需补齐 | 前缀匹配强制对齐 | 广播 + 恢复阶段对齐 |
| 读优化 | 依赖实现 | ReadIndex / LeaseRead | ZK 读走任意节点（非严格线性化） |
| 代表系统 | Chubby、Spanner 部分 | etcd、Kafka KRaft、TiKV | ZooKeeper |

**共识 ≠ 数据备份**：共识复制的是**变更日志/操作序列**（小、必须全量），不是数据本身；5 节点共识集群存 5 份日志而非 5 份业务表。Kafka 早期"controller + ZooKeeper"迁到 KRaft，就是把元数据共识内化。

## 六、动手题

1. etcd 三节点：`etcdctl put` 后 kill 一个 Follower，继续读写验证仍可用；再 kill 第二个，观察 `put` 报错 `raft: leader unavailable`，解释多数派如何从 2/3 塌到 1/3。
2. 人为制造"落后 Leader"：隔离某 Follower 十分钟再放回，观察它先被旧主踢出、追日志、再参与投票的过程；说明预选举限制为什么阻止它当选。

## 七、常见线上问题

- **偶数节点集群**：6 节点容灾能力反而不如 5 节点——劈成 3+3 时两侧都凑不齐多数派 4，全停写；而 5 节点劈成 2+3 时大侧仍能服务。同样网络质量下奇数集群容忍对半分裂的能力更强，永远部署奇数。
- **磁盘 fsync 慢拖垮 Quorum**：一个节点盘坏使心跳/ack 超时，反复触发选举——监控 `wal_fsync_duration`。
- **把 ZK 任意节点读当强一致**：默认读走 Follower 可能返回旧状态，锁场景必须 `sync` 或走 Leader。
- **快照+日志恢复失败**：集群成员变更用 `peer` 地址写死、换 IP 后无法组恢复——变更要一次只动一个节点。

## 八、关联技术栈

etcd（K8s 控制面真相源）、ZooKeeper（Kafka 老版 controller / Dubbo 注册）、TiKV Raft groups（数据分片级共识）、Kafka KRaft、Nacos 持久实例（JRaft）、Seata TC 高可用（依赖注册中心共识选主）。

## 九、本节小结

共识的全部安全性建立在"多数派相交"一个引理上；Paxos 给出两阶段原型但工程细节留白，Raft 用强 Leader + 前缀日志 + 选举完整性限制把正确性变得可审阅，ZAB 用广播式两阶段贴合 ZooKeeper 的顺序一致需求。记住三句话：写走 Leader 多数派、读要 ReadIndex 才线性、部署奇数节点并盯住 fsync 延迟。
