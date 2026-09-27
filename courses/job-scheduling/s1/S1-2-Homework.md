# 分片、幂等与失败补偿 · 作业

## 作业 1：分片对账实现

**目标**：实现 4 分片并行对账任务。

1. 建 4 张 mock 流水表（`trans_00`~`trans_03`），各插 1000 条记录。
2. 用 XXL-Job 分片广播模式，`shardIndex % 4` 对应操作哪张表。
3. 执行后验证：4 张表各处理 1000 条，总计 4000 条。
4. 修改 `shardTotal=2`（只跑 2 实例），验证每个实例处理 2 张表。

## 作业 2：幂等防护验证

**目标**：人为重复触发同一分片，验证幂等不重复写入。

1. 日切流水表：`daily_settle(date, shard_idx, amount)` UNIQUE(date, shard_idx)。
2. 手动在 Admin 连续触发两次同一日期的任务。
3. 观察日志：第二次 "DuplicateKeyException → 跳过"。
4. 验证流水表只有一条记录。

## 作业 3：失败补偿与告警

**目标**：模拟 3 分片中 1 片失败，补偿 Job 自动修复。

1. 在分片 2 逻辑中加 `if (shardIndex==2) throw new RuntimeException("模拟故障")`。
2. 配置 `executorFailRetryCount=2`，观察 Admin 重试日志。
3. 重试仍失败 → 补偿 Job 5 分钟后扫描到 `status=FAILED` 记录。
4. 补偿去掉故障逻辑后执行成功，验证流水完整。
5. 钉钉 Webhook 通知验证（mock）。
