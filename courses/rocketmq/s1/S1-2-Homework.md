# 事务消息与最终一致性 · 作业

## 作业 1：电商下单+扣库存事务消息实现

**目标**：完整实现"下单成功后异步扣库存"的事务消息链路。

**步骤**：
1. 创建 Spring Boot 项目，引入 `rocketmq-spring-boot-starter`。
2. 实现 `RocketMQLocalTransactionListener`（execute + check 两个方法）。
3. 下单接口中调用 `sendMessageInTransaction`，本地事务 = INSERT order 表。
4. 库存 Consumer 订阅 `StockDeductTopic`，扣减库存并写幂等表。
5. 模拟：execute 阶段抛异常 → 验证消息不投递；回查阶段正常 → 消息补投。

**验收**：贴出代码 + 日志截图展示正常/异常/回查三种路径。

## 作业 2：回查机制验证

**目标**：人为制造 Producer 在 Commit 前宕机的场景。

1. 在 execute 方法中 `Thread.sleep(30000)` 后 Commit。
2. 在 sleep 期间 `kill -9` Producer 进程。
3. 启动同组另一个 Producer 实例。
4. 观察 Broker 日志中回查请求，确认 check 方法返回 COMMIT 后消息投递。

## 作业 3：幂等消费方案对比

**场景**：Consumer 收到"加积分"消息，需防止重复加分。

对比两种幂等方案：
- 方案 A：Redis `SETNX msgId EX 86400` 去重。
- 方案 B：DB 表 `idempotent_record(biz_id UNIQUE)` + INSERT 冲突判断。

1. 分别实现并测试消息重复投递 3 次的结果。
2. 分析两种方案在 Redis 故障 / DB 主从延迟下的表现差异。
