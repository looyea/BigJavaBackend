# 可靠性语义、幂等与消息不丢不重 · 面试题

## 题 1：Kafka 怎么保证消息"不丢"？

- 分三段：生产 `acks=all`、broker 副本 `RF>=3`+`min.insync.replicas>=2`+关 `unclean.leader.election`、消费先处理成功再手动提交 offset。
- 任一段掉链子都有丢窗口：`acks=1` leader 崩未同步、非 ISR 上位、`auto.commit` 处理前提交后崩溃。
- 加分：指出 ISR 不足时 `acks=all` 会拒写（`NotEnoughReplicas`），是拿可用性换不丢。

## 题 2：`acks=-1` 是不是一定不丢？

- 不一定。`-1` 只在 `min.insync.replicas>=2` 且 `RF>=3` 时才有冗余意义；若 `min.insync=1/RF=1`，leader 挂仍丢。
- 真正不丢要 `acks=all` + 足够的 ISR/副本数 + 禁 unclean 选举一起配。
- 加分：能说出"配置不一致时 broker 宁可报错拒写也不违反不丢"。

## 题 3：幂等 Producer 解决了什么、解决不了什么？

- 解决：网络/重试导致的**单分区内重复**（靠 `PID+sequence` 让 broker 去重），分区内 effectively exactly-once。
- 解决不了：跨分区原子、业务层面的重复消息——那些要靠事务与消费幂等。
- 加分：给出约束 `acks=all`、`retries` 大、`in.flight<=5`。

## 题 4：消息重复是怎么产生的？怎么兜底？

- 生产重试（未配幂等）、消费"处理成功但 offset 提交前崩溃→重投"、再平衡重复投递等，本质是 at-least-once。
- 兜底靠**消费幂等**：业务唯一键/去重表/`upsert`/状态机单向流转，保证重复投递不产生重复副作用。
- 加分：区分"技术去重（Kafka 幂等）"与"业务去重（幂等键）"两层。

## 题 5：端到端 exactly-once（EOS）怎么实现，代价是什么？

- 用 Kafka 事务（`transactional.id`）把"消费位点提交 + 处理 + 生产"包成原子（read-process-write）。
- 代价：协调器开销、吞吐与延迟下降、运维更复杂。
- 加分：说明工业更常用"生产幂等 + 消费幂等"逼近 effectively-once，性价比更高。

## 题 6：消费端为什么建议关掉 `enable.auto.commit`？

- 自动提交可能在消息还没处理成功时就把位点推走，处理失败/崩溃即永久丢该消息。
- 关掉后手动"处理成功再 `commitSync`"，位点不前进则失败可重投，配合幂等消费保证不丢不重。
- 加分：能提到重投带来重复，所以"不丢"和"不重"要一起做，不能只改提交时机却不做幂等。
