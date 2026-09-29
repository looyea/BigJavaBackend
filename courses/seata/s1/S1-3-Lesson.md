# Seata 高可用、TC 集群与生产调优（关联）

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能把 Seata 从"能跑通的分布式事务 demo"运维成"协调器不成为单点、热点不雪崩、日志不撑爆、超时可兜底"的生产系统。先分清三角色：**TC（Transaction Coordinator）** 独立部署、维护全局/分支事务状态；**TM（Transaction Manager）** 在应用侧由 `@GlobalTransactional` 发起/提交/回滚全局事务；**RM（Resource Manager）** 代理数据源、管理分支事务与 `undo_log`。TC 是**全局瓶颈与潜在单点**，生产要 **TC 集群 + 事务状态持久化**（`store.mode=db/redis`，多 TC 共享 `global_transaction`/`branch_transaction`/`lock_table`），集群靠注册到 Nacos 被发现；关键陷阱是**同一 xid 的事务请求要落到同一 TC 分片**（通过 vgroup→cluster 映射/路由），否则两台 TC 各持一半状态会造成事务状态错乱——这是 TC 集群"分区/路由"的要点。调优三大战场：①**全局锁冲突与热点**：AT 模式分支提交要获取**行级全局锁**（防止不同全局事务改同一行破坏隔离），高并发热点行（爆款库存、热点账户余额）会引发大量全局锁冲突、重试排队乃至雪崩——缓解靠热点改用 **TCC**（try 冻结/confirm 扣减，绕开行级全局锁）、**库存分桶拆行**降争用、调 `lock` 重试次数/间隔、或干脆用本地乐观锁；②**`undo_log` 膨胀**：AT 每个分支把数据**前后镜像**写入 `undo_log`，事务量大时暴涨，需**定时清理**已终结事务的日志、设保留期、按时间分区归档，否则膨胀拖慢分支提交与全局回滚扫描、撑爆磁盘；③**超时与降级**：全局事务有超时（默认 30s），配太长会长时间锁资源、挂起事务堆积；分支注册/状态上报经 Netty 连 TC，与 Nacos（发现）、MQ（异步解耦）协同时网络抖动会让"提交/回滚"卡住——要设合理超时 + 重试，对**挂起（committed 失败待人工）事务**告警并做最终一致兜底。识破"单 TC 单点""TC 集群没做 xid 分片路由→状态错乱""AT 热点行全局锁雪崩""undo_log 不清理撑爆磁盘""全局超时配太长锁死资源"等坑——金融账户多用 TCC 规避全局锁、电商库存 AT 要防热点行、跨服务转账要盯挂起事务告警。

## 一、AT 全局锁与热点行

```java
// 目的：AT 模式热点行(库存)是全局锁冲突重灾区, 用 TCC/拆行/乐观锁缓解
@GlobalTransactional(timeoutMills = 30_000, name = "deduct-stock") // 说明：全局超时默认 30s, 配太长会长时间锁资源+挂起堆积
public void deduct(long sku, int n) {
    // 反例：高并发爆款 sku 上用 AT 直接改库存行 ❌ 各全局事务争同一行全局锁 → 排队/重试雪崩 ❌
    stockMapper.deduct(sku, n);          // 结果：AT 提交要拿该行全局锁, 并把前后镜像写入 undo_log
}
// 缓解热点：①热点库存改 TCC(try 冻结/confirm 扣减) 避开行级全局锁 ②库存分桶拆行降争用 ③调 lock 重试次数/间隔
```

## 二、TC 高可用与 xid 路由

```text
图目的：TC 是全局协调者, 不能单点也不能"集群但状态分裂"
store.mode=db/redis: 多 TC 共享 global_transaction/branch_transaction/lock_table, TC 宕机可恢复状态
TC 注册到 Nacos, TM/RM 经 Nacos 发现 TC 集群
分区要点: 同一 xid 的事务请求应路由到同一 TC 分组(vgroup→cluster 映射), 否则两台 TC 各持一半状态 → 事务错乱
运维: TC 无状态计算但有状态存储 —— 部署可多实例, 存储必须 HA(如 MySQL 主从/Redis 哨兵)
```

## 三、undo_log 膨胀治理

```sql
-- 目的：undo_log 只增不清会撑爆磁盘并拖慢回滚查询, 需定期清理已终结事务的镜像
DELETE FROM undo_log WHERE log_created < DATE_SUB(NOW(), INTERVAL 7 DAY); -- 说明：删除超过保留期、对应全局事务已终结的日志
-- 结果：undo_log 只承载在途/待回滚事务, 表小、索引高效、回滚定位快
-- 反例：undo_log 无限堆积 ❌ 膨胀拖慢分支提交与全局回滚扫描 ❌ 磁盘打满连锁宕机 ❌
```

## 四、超时与降级底线

- **全局超时按业务定**：默认 30s 是偏大的保护值，短事务应调小，避免长时间占锁与挂起堆积。
- **挂起事务必须告警**：commit/rollback 失败进入挂起态，需人工/补偿兜底达成最终一致，不能"默默丢下"。
- **热点规避全局锁**：高争用行改 TCC/Saga 或分桶拆行；AT 适合低冲突普通业务。

## 五、关联课程

全局锁与 `undo_log` 的生成/回滚机制承接 [AT 模式与全局锁](./S1-1-Lesson.md)；热点行改用 TCC 的 try/confirm/cancel 见 [TCC / Saga / XA 与模式选型](./S1-2-Lesson.md)。
