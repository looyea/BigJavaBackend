# 消费组与再平衡 · 作业

## 作业 1：Rebalance 观察

**目标**：启动多 Consumer 实例观察分区分配与再平衡过程。

1. 创建 Topic `rebalance-test`（6 Partition）。
2. 启动 Consumer-A（group="g1"），观察日志：分配到 6 分区。
3. 启动 Consumer-B（同 group），观察 Rebalance 后各分到 3 分区。
4. kill Consumer-B → Consumer-A 再次 Rebalance 恢复 6 分区。
5. 改用 `CooperativeStickyAssignor`，重复步骤 3，观察仅变动分区被暂停。

**验收**：贴出日志截取 Rebalance 前后的 partition 分配变化。

## 作业 2：位移管理实验

**目标**：对比自动提交与手动提交的差异。

1. 配置 `enable.auto.commit=true, auto.commit.interval.ms=1000`，消费 100 条后 kill Consumer。
2. 重启后检查从哪个 offset 继续——可能丢部分（已 poll 未处理但已自动 commit）。
3. 改 `enable.auto.commit=false` + `commitSync()` after process → kill → 重启 → 验证从最后处理完的 offset 继续。

## 作业 3：精确一次事务实现

**目标**：使用 Kafka Streams 实现 word-count 拓扑，保证 EOS。

1. 消费 `input-topic`（acks=all 事务 Producer 写入）。
2. 处理：按 key 计数。
3. 输出到 `output-topic`（事务 Producer）。
4. 配置 `processing.guarantee=exactly_once_v2`。
5. 处理中途 kill → 重启 → 验证输出无重复无遗漏。
