# Redisson 在 Cluster/Sentinel 下的可靠性

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：能把 Redisson 从"单机能用"推进到"集群/哨兵下也可靠"——理解 **Cluster 的 slot 分片**对多 Key 操作的约束（跨 slot 的命令/事务/Lua 需 **hash tag `{...}`** 把相关 key 钉到同一 slot，否则 `CROSS_SLOT` 报错）、`RTopic` 在 Cluster 下的广播语义与订阅收敛、连接层在 **节点故障/主从切换**时的自动重连与重试；关键要认清 **Sentinel/Cluster 主从切换与锁可靠性之间的张力**：单节点 `RLock` 依赖数据不丢，而主从异步复制在 master 挂掉、slave 提升时**可能丢失尚未同步的锁**，这正是 RedLock 想解决却又有争议的场景。据此做出工程判断：一般互斥用单节点锁 + 合理 TTL + 幂等/双重校验兜底，强一致要求才权衡 RedLock 或改走 CP 协调服务（ZooKeeper/etcd）。识破"跨 slot 多 key 操作不加 hash tag""以为单点锁能扛主从切换不丢""看门狗在网络分区脑裂时两边都持锁"等坑。

## 一、Cluster：slot 分片与 hash tag

```text
图目的：Cluster 按 key 哈希分 16384 slot, 相关 key 不同 slot 会限制作案
单 key 命令天然可用; 多 key 命令/MULTI/Lua 要求所有 key 同 slot
解法: 用 hash tag 把逻辑相关的 key 钉到同一 slot → "order:{user1001}:lock" 与 "order:{user1001}:stock"
代价: tag 选不好会造成热点集中到少数节点
```

```java
// 目的：同一用户的锁与库存放到同一 slot, 才能让一次 Lua/事务跨这两个 key 原子执行
RLock lock = redisson.getLock("order:{user1001}:lock");   // 说明：{} 内子串决定 slot, 大括号外前缀仍可读
RMap  stock = redisson.getMap("order:{user1001}:stock");   // 结果：二者 hash tag 相同 → 同 slot, 多 key 操作不再 CROSS_SLOT
// 反例：key 写成 "lock:user1001" 和 "stock:user1001" ❌ 两个 key 落不同 slot, 跨 slot 事务/Lua 直接报错
```

## 二、故障切换下的连接与锁语义

```text
图目的：连接层会自愈, 但"锁数据"未必跟着自愈
连接: Cluster/RedissonClient 感知拓扑变更、自动重连、命令级重试(timeout/retryDelay/retryAttempts)
主从切换: Sentinel/Cluster 异步复制, master 挂→slave 提升, 未同步的写(含锁)可能丢
风险: 单节点 RLock 不是为"跨故障切换仍不丢"设计; 脑裂时两边可能各自持锁
```

- **看门狗的两面性**：持锁线程存活时自动续期避免"业务没做完锁先过期"；但网络分区使旧 master 与客户端失联又未及时释放时，可能与其他节点上的新持锁者并存——锁的"不丢"最终要靠架构，不是靠续期。

## 三、可靠性选型阶梯

```text
图目的：按"能容忍偶发双持锁吗"决定方案, 别无脑上 RedLock
① 单节点锁 + 合理 TTL + 业务幂等/唯一约束兜底 → 绝大多数场景够用、性能最好
② RedLock(N 个独立 master 多数派) → 提升切换期安全性, 但受时钟漂移/GC 停顿质疑、成本高
③ 强一致/ fencing token → 走 CP 协调服务(ZooKeeper/etcd)带单调序号, 能拒绝旧持有者写入
```

## 四、坑与底线

- **RTopic 订阅在 Cluster**：广播可用，但要验证切换期消息不重不丢的语义边界，别把失效广播当可靠投递（关键失效仍应落库/版本校验）。
- **别迷信"锁一定安全"**：异步复制就存在丢锁窗口；正确性关键处叠加幂等与唯一约束，或用带 fencing 的方案兜底。

## 五、关联课程

锁与看门狗的基础语义见 [RLock 可重入锁与看门狗续期](../s1/S1-1-Lesson.md)，RedLock 的争议承接 [RedLock 争议与读写锁/信号量/闭锁](../s1/S1-2-Lesson.md)；主从/哨兵/集群复制模型见 [持久化与高可用架构](../../redis/s1/S1-2-Lesson.md)；连接层的多节点重连与 Cluster 支持对比见 [连接池、Cluster/Sentinel 与异步/响应式 API](../../lettuce/s1/S1-2-Lesson.md)。
