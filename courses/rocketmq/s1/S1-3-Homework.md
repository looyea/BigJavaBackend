# 顺序、幂等、堆积与重试死信 · 作业

## 作业 1：分区有序消息实现

**目标**：模拟订单状态变更流（CREATED→PAID→SHIPPED→DONE），保证同一订单顺序消费。

1. Producer 对同一 orderId 连续发 4 条消息（使用 MessageQueueSelector 按 orderId 哈希）。
2. Consumer 使用 MessageListenerOrderly，打印消费顺序。
3. 启动 3 个 Consumer 实例观察 Rebalance 分配。
4. 验证同一订单的消息始终在一个实例中串行消费。

## 作业 2：幂等消费去重表

**目标**：实现 DB 唯一键幂等方案。

1. 建表 `idempotent_record(msg_id VARCHAR(64) PRIMARY KEY, biz_type VARCHAR(32), create_time DATETIME)`。
2. Consumer 逻辑：`INSERT` 成功才执行业务；`DuplicateKeyException` 则跳过。
3. 模拟同一消息投递 3 次，验证业务只执行 1 次。
4. 对比使用 Redis `SETNX msgId` 的方案差异（Redis 过期后重启是否影响）。

## 作业 3：堆积与 DLQ 演练

**目标**：制造堆积场景并观察处理结果。

1. 设置 Topic Queue 数=4，只启 1 个 Consumer 且 `consumeThreadMax=1`。
2. Producer 以 5000 TPS 发送 10 万条消息，Consumer 故意每条 `sleep(10ms)`。
3. 观察堆积增长曲线（Dashboard）。
4. 动态扩到 4 个 Consumer 实例，记录消化速度。
5. 设置 `maxReconsumeTimes=3`，让部分消息失败进 DLQ，验证 DLQ 消费补处理。
