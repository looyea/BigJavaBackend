# 索引生命周期 ILM 与冷热架构 · 作业

## 作业 1：为演示集群配置完整 ILM（动手题）

**目标**：跑通"滚动 → 温层降级 → 删除"全自动闭环。

**任务**：
1. 创建 `applog-lifecycle` 策略：hot（`max_primary_shard_size: 5gb`、`max_age: 1d`）→ warm（`min_index_age: 3d`，shrink 到 1、forcemerge 1 段、allocate `data=warm`）→ delete（`min_index_age: 7d`）；
2. 建 index template 匹配 `applog-*`，挂策略并预建 `applog-000001` + write alias；
3. 用脚本灌 3 天量日志（可把 age 阈值临时调小加速演示），每 10 分钟查一次 `GET applog-000001/_ilm/explain`，记录 phase/step 迁移时间线；
4. 验证 warm 索引在带 `data=warm` 标签的节点上，且 `_cat/indices` 显示其分片数为 1。

**验收标准**：时间线截图/表格显示 Hot→Warm→Delete 全自动流转；能说清 `step` 卡在 `wait-for-migration` 时的排查路径（节点标签/分配规则不匹配是最常见原因）。

**参考解法要点**：`_ilm/explain` 的 `phase/step/step_info` 三字段就是 ILM 的"日志"；`POST applog-000001/_ilm/retry` 用于修复卡步，但先解决分配约束再 retry。

## 作业 2：冷热集群容量与成本规划（设计题）

背景：Spring Boot 微服务集群 60 个实例，日均日志 80GB（JSON 结构化后均值 1.2KB/条），热查询 95% 落在 72h，审计要求保留 180 天。

**任务**：
1. 计算 180 天总量（给出膨胀系数假设）与热/温/冷三层的容量分配；
2. 给出节点池规划：hot（SSD，数量、堆、每节点分片预算）、warm（HDD）、cold 用 searchable_snapshot 的对象存储桶与缓存盘大小；
3. 写出 rollover 阈值与分片数选择，并验证"1 shard/GB 堆"约束；
4. 用一段话向 CFO 解释为什么冷层不该用本地盘。

**验收标准**：所有数字可复算；副本策略分层明确（hot 1 副本、warm 起 0 副本的理由与风险声明）；包含快照备份（SLM）与生命周期删除的区分说明——删了不等于备份过。

## 作业 3：事故复盘（分析题）

某团队把 `forcemerge` 配在 hot 阶段且 `max_num_segments: 1`，一周后写入延迟从 5ms 涨到 2s、磁盘剩余 15%。请写出：故障机理（对活跃索引 merge 的循环代价）、为什么磁盘被吃掉、修复步骤（改策略 → `_ilm/move` 到正确 step → 观察 merge queue）、以及复盘三条改进项（策略评审清单、`_cat/fielddata`/merge 监控告警、staging 回放验证）。**验收标准**：机理段不超过 150 字但必须提到"新写入持续产生新段使 merge 永动"。
