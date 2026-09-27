# 定时任务的演进与分布式调度架构 · 作业

## 作业 1：单机定时 → 分布式迁移

**目标**：将一个现有 `@Scheduled` 任务迁移到 XXL-Job。

1. 原始代码：`@Scheduled(cron="0 */5 * * * ?")` 每 5 分钟清理过期 session。
2. 本地部署 XXL-Job Admin（Docker：`docker run xuxueli/xxl-job-admin`）。
3. 改造为 `@XxlJob("sessionCleanHandler")` 注解方法。
4. 在 Admin 创建任务、配置 Cron、路由策略=故障转移、超时=60s。
5. 关闭原 @Scheduled 并对比 Admin 日志中的触发记录。

## 作业 2：ElasticJob 分片并行采集

**目标**：模拟电力采集——30 个电表并行读取。

1. 配置 `sharding-total-count=30`，启动 3 个实例（各分 10 个分片）。
2. JobHandler 中按 `shardingItem` 读取 mock 数据并写入结果表。
3. kill 其中 1 个实例 → 观察 ElasticJob 重新分配分片到存活实例。
4. 记录重分配耗时和数据是否有遗漏。

## 作业 3：ShedLock 轻量防重

**目标**：不引入调度中心，仅用 ShedLock + `@Scheduled` 实现多实例不重复执行。

1. 引入 `shedlock-spring` + JDBC LockProvider。
2. 创建 `shedlock` 表。
3. 两台实例同时启动，观察只有一台打印日志。
4. 锁超时(`lockAtMostFor`)设为 30s，模拟执行慢（sleep 40s）时另一台是否抢锁执行。
