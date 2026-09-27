# 分区、副本与 ISR 机制 · 作业

## 作业 1：3 Broker 集群搭建与 ISR 观察

**目标**：本地启动 3 个 Kafka Broker（KRaft 模式），创建 Topic 并观察 ISR 变化。

1. 创建 Topic `test-replica`，`--partitions 3 --replication-factor 3 --config min.insync.replicas=2`。
2. Producer 持续发消息（1000 TPS），观察 ISR：
   ```bash
   kafka-topics.sh --describe --topic test-replica
   ```
3. kill 一个 Broker → 观察 ISR 缩到 2 → Producer 仍能写。
4. 再 kill 一个 → ISR=1 < min.insync=2 → Producer 抛 NotEnoughReplicasException。

**验收**：贴出每一步 describe 输出和 Producer 异常日志。

## 作业 2：acks 性能对比

**目标**：对比 acks=0/1/all 三种配置下 Producer 吞吐。

1. 使用 kafka-producer-perf-test：
   ```bash
   kafka-producer-perf-test --topic bench --num-records 500000 \
     --record-size 1024 --throughput -1 --producer-props acks=0 bootstrap.servers=...
   ```
2. 分别设 acks=0/1/all + retries=0 vs MAX，记录 3 种组合的 records/sec。
3. 解释 acks=all 慢在哪里（网络往返 × ISR 数量）。

## 作业 3：分区顺序性验证

**目标**：验证同一 Key 的消息严格有序。

1. 创建 6 分区 Topic。
2. Producer 发 3 组消息（key=A 10条、key=B 10条、key=C 10条），value=序号(0~9)。
3. Console Consumer 打印 offset 和 value。
4. 验证同一 key 的 value 严格递增（0→1→...→9）。
