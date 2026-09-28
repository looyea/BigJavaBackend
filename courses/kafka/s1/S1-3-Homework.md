# 可靠性语义、幂等与消息不丢不重 · 作业

### 作业 1：搭一套"不丢"的生产/ broker 配置并验证拒写

- 目标：验证 `acks=all` 只有配合 `RF`/`min.insync.replicas` 才防丢。
- 任务：建一个 `RF=3` 的 topic，设 `min.insync.replicas=2`，生产者 `acks=all`；手动 kill 两个 broker 使 ISR<2，观察写入抛 `NotEnoughReplicasException`（拒写而非丢）；再对比 `acks=1` 时同样场景是否会丢。
- 验收标准：能展示"ISR 不足→拒写"的日志与现象；能解释为何 `acks=1/RF=1` 存在 leader 崩溃丢数据窗口。
- 参考解法要点：区分 `acks` 语义；用 `--describe` 看 ISR 变化；unclean 选举开关对可用/持久的权衡。

### 作业 2：开启幂等 Producer 观察去重

- 目标：理解幂等如何消除"重试导致的分区内重复"。
- 任务：设 `enable.idempotence=true`（`acks=all`、`retries` 大、`in.flight<=5`），人为注入网络抖动/超时触发重试，统计下游收到的消息 sequence 是否有重复；再关掉幂等复现"重试导致重复"。
- 验收标准：幂等开启时重试不产生分区内重复；关闭后能观察到重复；能说清幂等的边界（只分区内、不跨分区、不管业务重复）。
- 参考解法要点：`PID+sequence` 去重原理；对比事务才能覆盖跨分区原子的差异。

### 作业 3：消费端"先处理后提交 + 业务幂等"

- 目标：落地 at-least-once + 消费幂等的 effectively-once。
- 任务：把消费者设为 `enable.auto.commit=false`，改成处理成功后 `commitSync`；用一张去重表（业务唯一键如支付流水号）做 `upsert`；构造"处理成功但提交前崩溃→消息重投"，验证去重表挡住二次扣款。
- 验收标准：处理失败/提交前崩溃时位点不前进、消息被重投；重投因业务唯一键幂等不产生重复副作用；能说明为何单靠 Kafka 幂等 Producer 不够。
- 参考解法要点：位点提交与业务写入尽量同库同事务；去重存储设合理 TTL 窗口。
