# 事务消息与最终一致性 · 面试题

## 题 1：RocketMQ 事务消息与 Seata AT 模式的区别？

| 维度 | 事务消息 | Seata AT |
|------|----------|----------|
| 一致性 | 最终一致（异步） | 强一致（同步，全局锁） |
| 耦合 | Producer-Consumer 解耦 | 各服务需 Seata TC 协调 |
| 性能 | 高（无同步等待） | 中（全局锁竞争） |
| 场景 | 下游只需"知道发生了" | 下游需同步返回结果 |

## 题 2：回查接口如何设计才能正确处理？

```java
// 目的：回查时根据业务主键查 DB 确认本地事务是否已完成
@Override
public LocalTransactionState checkLocalTransaction(MessageExt msg) {
    String orderId = msg.getKeys();  // 说明：约定 Key = 业务订单号
    // 结果：查 DB 而非内存——Producer 可能已重启，内存状态丢失
    boolean exists = jdbcTemplate.queryForObject(
        "SELECT COUNT(1) FROM orders WHERE id=?", Integer.class, orderId) > 0;
    return exists ? COMMIT_MESSAGE : UNKNOW;
    // 输出：返回 UNKNOW 让 Broker 下一轮再查（可能 DB 事务还未提交完成）
}
// 错误用法：返回 ROLLBACK → 消息被删 → 但 DB 中订单实际已写入 → 库存未扣
```

## 题 3：如果半消息写入成功但 Broker 随后宕机，消息会丢吗？

Dledger + SYNC_FLUSH：半消息写入已 Raft 多数确认并 fsync → 不丢。
传统 Master-Slave + ASYNC_FLUSH：可能丢（仅 PageCache 未落盘）。生产建议事务消息场景用 SYNC_FLUSH。

## 题 4：事务消息能否保证下游一定成功消费？

**不能保证业务执行一定成功**——只保证消息一定投递到 Consumer。Consumer 若消费失败：
1. RocketMQ 梯度重试（10 级：1s/5s/10s/30s/1m/2m/3m/4m/5m/6m...）。
2. 超过 `maxReconsumeTimes`（默认 16）进入死信队列 `%DLQ%group`。
3. 最终需人工介入或补偿任务。

## 题 5：事务消息 + 幂等 = 完整最终一致性，解释为什么缺一不可？

- 无事务消息：本地事务成功但消息丢失 → 下游永远不知道 → 不一致。
- 无幂等：网络抖动导致 Consumer 重复消费 → 多扣库存/多加积分 → 数据错误。
- 两者结合：消息不丢 + 消费不重 = 业务结果最终正确。

## 题 6：本地消息表方案 vs 事务消息方案怎么选？

| 维度 | 本地消息表 | RocketMQ 事务消息 |
|------|-----------|-----------------|
| 额外依赖 | 只需 DB | 需 MQ 集群 |
| 实时性 | 定时扫描（秒~分钟级） | 秒级推送 |
| 运维成本 | 表膨胀、清理 | MQ 集群维护 |
| 适用 | 低量 / 无法引入 MQ | 高并发 / 已有 MQ |

选型原则：已有 RocketMQ → 事务消息；技术栈简单 / 消息量小 → Outbox。
