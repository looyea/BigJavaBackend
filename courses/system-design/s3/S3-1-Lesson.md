# 分布式消息 / 缓存 / ID 生成器设计

> 本节难度：★★★★★
> 本节重要性：★★★★☆
> 学习产出：能从零设计一个高可靠分布式消息队列、一个多级缓存架构和一个全局唯一 ID 生成器，覆盖一致性保证、水平扩容与故障恢复。

## 一、分布式消息队列设计

### 1.1 核心需求与架构选型

设计一个消息队列需要回答：吞吐量多大？消息是否允许丢失？是否需要顺序？消费模型是推还是拉？

```flow
目的：展示分布式 MQ 的整体架构分层
Producer → Broker Cluster（多 Partition × 多副本）→ Consumer Group
                                                    ↓
                                          Controller（Leader 选举 / 分区再分配）
```

**关键设计决策**：
- **分区（Partition）**：水平扩展的基本单位，单分区内有序。
- **副本（Replica）**：高可用保障，ISR（In-Sync Replica）机制控制同步。
- **持久化**：顺序写磁盘 + 页缓存 + 零拷贝，顺序写吞吐可达 SSD 6 GB/s。

### 1.2 消息可靠性三端保障

```java
// 目的：演示 Producer 端确保消息不丢的完整配置链路
// 错误用法: acks=0  fire-and-forget 丢消息无感知
// 反例: 只用 retries 不设置幂等 Producer，重试导致重复消费
Properties props = new Properties();
props.put("acks", "all");                // 结果：Leader + ISR 全部确认后才返回成功
props.put("retries", Integer.MAX_VALUE); // 结果：无限重试直到超时
props.put("enable.idempotence", "true"); // 结果：Broker 端 PID+SeqNum 去重，保证 exactly-once produce
// 说明：生产环境还需配合事务 API，把"写本地 DB + 发消息"原子化
```

**Consumer 端**：手动提交 offset，先处理完业务逻辑再 commit，避免"已提交但未处理"。

**Broker 端**：`min.insync.replicas >= 2`，配合 `unclean.leader.election=false` 禁止非 ISR 副本当 Leader。

### 1.3 顺序与事务消息

- 全局顺序：单 Topic 单 Partition（牺牲并行度）。
- 分区有序：按业务 Key（如订单 ID）做 Partition 路由。
- 事务消息：Half Message → 本地事务 → Commit/Rollback → 定时回查。

## 二、分布式缓存架构设计

### 2.1 多级缓存模型

```text
目的：展示 L1~L4 多级缓存命中链路与失效边界
L1 浏览器缓存 → L2 CDN → L3 本地缓存(Caffeine) → L4 分布式缓存(Redis Cluster) → DB
命中即返回；未命中逐穿透，最终回填。
```

### 2.2 一致性策略选择

| 场景 | 策略 | 说明 |
|------|------|------|
| 读多写少 | Cache Aside | 先更新 DB 再删缓存 |
| 强一致 | Write Through | 同步双写，缓存与 DB 同生命周期 |
| 允许短暂不一致 | 延迟双删 | 写 DB 前删、延迟 500ms 再删 |

```java
// 目的：Cache Aside 模式——先写 DB 后删缓存，演示正确与错误顺序
// 错误用法: 先删缓存再写 DB → 并发读写导致脏缓存
// 反例: 删缓存失败不重试 → 缓存长期脏数据
public void updateOrder(Order order) {
    orderMapper.updateById(order);      // 结果：DB 写入成功
    redisTemplate.delete("order:" + order.getId()); // 结果：缓存失效，下次读回填新值
    // 说明：生产环境需配合 Canal 监听 binlog 做兜底删除
}
```

### 2.3 缓存三大经典问题

- **穿透**：查不存在数据 → 布隆过滤器前置拦截 + 空值缓存（短 TTL）。
- **击穿**：热点 Key 过期瞬间 → 互斥锁 singleflight 重建。
- **雪崩**：大面积同时过期 → TTL 加随机抖动；集群化 + 熔断降级。

## 三、分布式 ID 生成器设计

### 3.1 方案对比

| 方案 | 有序性 | 性能 | 依赖 | 典型代表 |
|------|--------|------|------|----------|
| UUID | 无序 | 高 | 无 | — |
| 数据库自增 | 趋势递增 | 低 | DB 单点 | MySQL auto_increment |
| 号段模式 | 趋势递增 | 中高 | DB + 本地缓存 | 美团 Leaf-segment |
| Snowflake | 严格递增 | 极高 | 时钟 | Twitter Snowflake |

### 3.2 Snowflake 实现

```java
// 目的：64 位 Snowflake 算法——1 符号 + 41 时间戳 + 10 机器 + 12 序列号
// 错误用法: 不处理时钟回拨 → 同一毫秒生成重复 ID
// 反例: 机器 ID 手动配置 → 扩容时冲突
public synchronized long nextId() {
    long ts = System.currentTimeMillis();
    if (ts < lastTs) { // 结果：检测到回拨，等待追平或抛异常
        if (lastTs - ts <= 5) { Thread.sleep(lastTs - ts); ts = System.currentTimeMillis(); }
        else throw new RuntimeException("Clock moved backwards");
    }
    if (ts == lastTs) {
        sequence = (sequence + 1) & 0xFFF; // 结果：4096/ms 上限
        if (sequence == 0) ts = tilNextMillis(lastTs);
    } else { sequence = 0; }
    lastTs = ts;
    return ((ts - EPOCH) << 22) | (workerId << 12) | sequence;
}
```

### 3.3 号段模式

```text
目的：号段模式核心流程——批量预取减少 DB 交互
DB 表 max_id 每次 +1000 → 应用本地 AtomicLong 发放 → 用完再取下一段 → 双 Buffer 预加载避免毛刺
```

## 四、扩容与故障恢复

- MQ 扩容：增加 Partition → 触发 Rebalance → 生产消费端透明。
- 缓存扩容：Redis Cluster 16384 slot 迁移，客户端 MOVED 重定向。
- ID 生成器：号段模式无状态扩容；Snowflake 需 ZK/etcd 分配 workerId 防冲突。
