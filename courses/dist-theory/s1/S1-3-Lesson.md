# 逻辑时钟、全局有序与幂等去重

> 本节难度：★★★★★
> 本节重要性：★★★★☆
> 学习产出：能说清物理时钟为什么不可依赖（NTP 漂移、回拨、crash 双写窗口），会用 Lamport 时钟建立" happened-before"偏序、用向量时钟区分并发与因果；理解 Raft/HLC/TrueTime 三种"全局有序"实现路径的代价梯度；能在业务代码里正确落地幂等去重——唯一键兜底、去重表与状态机幂等三种范式及其并发缺陷（先查后插的竞态）。

```flow
例子目的：展示没有统一时钟时"事件定序"为什么会出错——两个观测者对 A→B 的先后得出相反结论，必须引入逻辑时序标记
节点1 本地10:00:00.100 记事件A -> 节点2 本地10:00:00.090 收到A并记事件B: 物理时间戳显示 B 比 A 早（时钟漂了）
消息携带 逻辑时钟 lc=7 -> 节点2: lc=max(7,本地)+1=8: 逻辑顺序强制 A 在 B 前
```

## 一、物理时钟为什么不可信

分布式定序第一反应是"打时间戳"，但物理时钟有三个坑：

1. **漂移（drift）**：石英晶振偏差每天数十秒，NTP 校时是"拉斜率"不是瞬间对齐，两台机器秒级偏差常态存在；
2. **回拨（step）**：NTP 大幅纠偏会把时钟往回拨——用 `System.currentTimeMillis()` 做唯一 ID 时间段的雪花算法，回拨直接产生重复 ID；
3. **crash 窗口**：进程宕机重启期间时钟可能超前走，重启后回退——"时间戳更大的写先发生"不再成立。

结论：**跨节点比较"谁先发生"不能靠读墙上时钟**。NTP 可信区间约 ±10ms（广域更差），而 Spanner 干脆把"不确定区间"实体化（TrueTime 的 commit wait），这是下一节的后话。

```java
// 例子目的：识别"用物理时间戳做并发大小比较"的反例代码，并给出单调时钟修正
class ClockTrap {
    void badDedup(Event e, EventStore store) {
        long ts = System.currentTimeMillis();          // 错误用法：NTP step 回拨后，新一批事件 ts 反而更小——结果：去重窗口按 ts 比较时新事件被判"旧"而丢弃
        e.setSeen(ts);
        store.upsertIfNewer(e);                         // 说明：内部用 ts > old.ts 判断新旧，时钟回拨即失效
    }
    void goodDedup(Event e, EventStore store) {
        long mono = monotonicWallClock();               // 目的：本地维护 max(上次值+1, 系统时间)，回拨时继续单调递增（雪花时钟回拨的标准缓解）
        e.setSeen(mono);                                // 输出：序列仍严格递增——但注意：这只保证"本机内"单调，跨节点仍需逻辑时钟
        store.upsertIfNewer(e);
    }
    private static final java.util.concurrent.atomic.AtomicLong LAST = new java.util.concurrent.atomic.AtomicLong();
    static long monotonicWallClock() {                  // 例子：回拨安全的本地单调时钟核心 6 行
        for (;;) {
            long now = System.currentTimeMillis();      // 说明：每次取墙上时间与上次发布值比较
            long last = LAST.get();
            long next = now > last ? now : last + 1;    // 目的：now 回拨时走 last+1，序列绝不倒退
            if (LAST.compareAndSet(last, next)) return next;   // 输出：并发安全地发布新值
        }
    }
}
```

## 二、Lamport 时钟：便宜的全序近似

规则三行字：进程内事件 +1；发消息带自己的 lc；收消息 `lc = max(本地, 收到) + 1`。

性质：**A→B（因果先于）⟹ LC(A) < LC(B)**；逆命题不成立——LC 小不代表因果先于（两个无因果的并发事件也会被编号排出假先后）。

用途分级：只要"全进程一致的某种顺序"（如消息队列去重、状态机回放），Lamport 足够且 O(1) 开销；要区分"真并发 vs 有因果"，Lamport 无能为力。

## 三、向量时钟：把因果关系刻进编号

每个节点维护对自身事件的计数，消息携带整个向量；`VC(A) < VC(B)`（逐维 ≤ 且至少一维 <）⟹ A 因果先于 B；互相不 ≤ ⟹ **并发**。

- 优点：精确判定因果与并发——版本分叉检测（Riak 用它决定"需要业务合并"还是"直接取新"）；
- 代价：向量长度 = 节点数，元数据膨胀；剪枝（降为 Bag-of-Hashes/Dotted Version Vectors）会丢精度。

**选型直觉**：检测并发写冲突用向量（或位图化的 causal counter）；只为全局定序回放用 Lamport/序号即可，别为便宜付出 O(N) 向量。

## 四、三种"全局有序"的工程实现

| 路线 | 代表 | 原理 | 代价 |
| --- | --- | --- | --- |
| 单点定序 | Raft/ZAB 的 (term,index)、Kafka partition offset | 一切写经 Leader，由主分配全局序号 | 写吞吐受限于主；跨域延迟高 |
| HLC（混合逻辑时钟） | MongoDB、Cassandra LWT | 物理时间做主体，漂移时逻辑位进位——"尽量像时间，保证是时钟" | 仍是偏序增强，不保证真实时间先后 |
| TrueTime + 事务定序 | Spanner | GPS+原子钟把不确定区间压到 ε<10ms，提交等待区间过去 | 专用硬件，成本极高 |

Cassandra 的 LWT（`IF NOT EXISTS`）用 Paxos+HLC；普通写只按写入延迟到达的 timestamp 做 LWW——**LWW 的"最后写"是 HLC 序，不是真实时间序**，跨节点冲突时可能"先到者赢"。

## 五、幂等去重：定序问题的业务终点

全局有序 + 重试网络，最终都落到同一件事：**同一逻辑操作重复到达时，效果只算一次**。三种范式：

**1. 唯一键兜底（最可靠）**：业务自然键/请求 ID 建唯一索引，重复插入撞键即视为已处理。

```sql
-- 例子目的：演示"先查后插"竞态与唯一键正确姿势（MySQL）
-- 错误用法：SELECT 判断不存在再 INSERT——并发两线程同时查都"不存在"，双双插入，去重失效
-- SELECT COUNT(*) FROM pay_order WHERE order_no='X100';   -- 检查
-- INSERT INTO pay_order(order_no, amount) VALUES('X100', 99);  -- 错误用法：两步之间窗口期内并发插入重复单

INSERT INTO pay_order(order_no, amount, dedup_key)     -- 目的：唯一约束兜底，一条语句原子完成"不存在才插"
VALUES ('X100', 99, 'req-8f3e')                        -- 例子：dedup_key 有 UNIQUE 索引，重复请求直接撞约束
ON DUPLICATE KEY UPDATE id = id;                        -- 输出：重复时影响 0 行、不报错——应用据此判定"已处理过"，安全返回原结果
```

**2. 去重表 + 短 TTL**：网关层记 `dedup(key) → 处理结果`，命中直接回放缓存结果；注意"处理中"状态也要占位（否则并发重复穿透），完成后再写终态。

**3. 状态机幂等**：更新带当前状态条件 `UPDATE ... WHERE status='PAID'`，重复执行自然只生效一次——对"扣减/发货"这类有顺序的业务最有效。

**共同缺陷提醒**：幂等键必须覆盖"业务语义相同"而非仅"请求相同"——用户连点两次"确认付款"是两个请求、一个业务操作，键要取订单号而不是点击流水号。

## 六、常见线上问题

- **时钟回拨让雪花 ID 撞车**：虚拟机快照恢复后典型触发；缓解=单调时钟封装（本节例）或重启后借 zk/etcd 版本段。
- **LWW 吃掉并发更新**：Cassandra/Dynamo 风格默认后写覆盖，购物车合并场景直接丢 add——需 counter 类型或集合合并。
- **去重表先成功后写库**：缓存写入"已处理"但主流程失败，重试被自己拦截——去重终态必须与业务结果同事务/同回写。
- **拿 messageId 当幂等键**：消息重投换新 id 或上游重试生成新消息，去重击穿——键取业务单号。

## 七、关联技术栈

Seata/TCC 的幂等防护、RocketMQ 消息轨迹去重、Canal binlog GTID 定序、Redis SETNX+过期做去重占位、Kafka epoch+offset（单点定序实例）、下一节分布式事务与本节去重表直接配合。

## 八、本节小结

物理时钟不可依赖是分布式定序的原罪；Lamport 给全序、向量时钟给因果判别、HLC/TrueTime 在"像时间"与"是序"之间做不同折中。业务层不需要选协议，只需要：给重试配幂等键、给幂等配唯一约束兜底、给有状态业务配状态机条件更新。三层都做的系统，才谈得上"消息随便重投"。
