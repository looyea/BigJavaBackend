# 定时任务的演进与分布式调度架构 · 面试题

## 题 1：为什么不建议在 Spring Boot 里大量使用 @Scheduled？

1. **集群重复执行**：N 个实例都会触发 → 需外挂 ShedLock 或自研锁。
2. **线程池共享**：默认单线程，一个任务卡住则后续全部延迟。
3. **无可观测性**：无执行历史、失败重试、告警。
4. **改 Cron 需重启**：不支持热更新。

## 题 2：XXL-Job Admin 单点怎么办？

Admin 支持集群部署（多节点共享同一 MySQL）：
- 各 Admin 节点通过 DB 分布式锁（`xxl_job_lock` 表 `FOR UPDATE`）保证同一任务只有一个节点触发。
- Executor 注册时向所有 Admin 地址列表发心跳，任一 Admin 存活即可调度。

## 题 3：ElasticJob 的"作业抢占"机制是什么？

场景：某实例宕机，其分片需被存活实例接管。ElasticJob 监听 ZK 临时节点消失 → Leader 重新计算分片分配 → 通过 ZK 写入新分配方案 → 各实例 Watch 到变化 → 接管新分片。此过程约 3-5s。

## 题 4：金融日切场景对调度的特殊要求？

- **精确一次**：日切只跑一次，不能因为时钟漂移或调度重试导致重复切账。
- **全量成功才能标记完成**：任一分片失败则整体未通过 → 阻塞后续清算流程。
- **可重跑**：幂等设计——同一天重跑结果与首次一致。
- **告警与人工介入**：超过阈值（如 3 次重试）必须停止并通知人工确认。

## 题 5：Quartz 集群与 XXL-Job 集群的本质区别？

| 维度 | Quartz 集群 | XXL-Job 集群 |
|------|------------|-------------|
| 锁机制 | DB `SELECT FOR UPDATE` 抢占触发 | Admin 间 DB 锁 + 路由到单一 Executor |
| 职责 | 调度与执行在同一 JVM | 调度(Admin)与执行(Executor)分离 |
| 扩展 | 只能加同一应用节点 | Executor 独立扩容不影响 Admin |
| 管理 | 无 UI（需自建） | 内置 Admin UI |

## 题 6：如何实现任务执行超时自动中断？

```java
// 目的：XXL-Job 支持 kill 按钮；ElasticJob 支持超时删除策略
// XXL-Job：Admin 发 kill 请求 → Executor 线程 interrupt
@XxlJob("longTask")
public void longTask() throws Exception {
    while (!XxlJobHelper.isKill()) {  // 说明：循环检查是否被终止
        processBatch();               // 结果：收到 kill 后立即退出
    }
}
// 错误用法：任务阻塞在 JDBC 调用中 → interrupt 无效 → 需设 socket timeout
```
