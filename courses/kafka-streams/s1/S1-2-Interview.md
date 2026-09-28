# 状态存储、精确一次与与 Flink 对比（关联） · 面试题

## 题 1：Kafka Streams 有哪几种 State Store，分别服务什么？

- KeyValueStore 存按 key 的最新值（KTable/全局聚合）；WindowStore 按时间桶存窗口状态、过期清理；SessionStore 按会话 gap 动态合并。
- DSL 的 groupByKey/join/window 最终都落到这些 store 上。
- 加分：能说明 store 用本地 RocksDB 支撑随机读写，并持续写 compacted changelog 以便恢复。

## 题 2：KS 的状态实例重启后怎么恢复？rebalance 时状态怎么办？

- 从本地 store + changelog topic 重建；standby task 预热副本减少迁移停顿。
- 扩缩容触发 rebalance，分区/任务重分配，对应状态随任务迁移，靠 changelog 保证不丢。
- 加分：把 changelog 压缩、standby、迁移恢复串成"可用性/停顿时间"的权衡。

## 题 3：Kafka Streams 的 effectively-once 是怎么实现的？

- 设 `processing.guarantee=eos_v2`，用 Kafka 事务把"消费位移 + 状态 changelog 写入 + 输出"绑定成一次原子提交。
- 消费端用 `read_committed` 只读已提交事务，中止的脏事务数据不可见，从而端到端不重不漏。
- 加分：说明一次 commit 相当于对齐了一个"状态快照点"，理念与 Flink Checkpoint 相通。

## 题 4：KS 的 EOS 有什么边界？为什么加了外部 HTTP 调用就不算了？

- 边界是"Kafka 进 / Kafka 出"，事务只约束 Kafka 内部的位移/状态/输出。
- 外部非幂等副作用（写第三方 API、非幂等 DB）不在事务里，回滚补不回，重复调用会破坏 once。
- 加分：给解法——把外部写改造成幂等（唯一键 upsert）或纳入 Flink 2PC/幂等 Sink 才谈端到端 once。

## 题 5：从状态和运维看，什么时候 KS 够用、什么时候必须 Flink？

- KS 够用：以 Kafka 为输入输出、状态能放单机、once 需求在 Kafka 事务内可满足、不想多运维一套集群。
- 需 Flink：状态超单机、需跨外部系统端到端 once、复杂窗口/CEP/流批一体、要平台化共享算力与容错。
- 加分：强调这是"库 vs 引擎"的形态差异决定的，不是谁更高级，选型可随约束演进。

## 题 6：Interactive Queries 有什么用，能替代外部缓存/存储吗？

- IQ 把某实例上的本地 store 当可查询状态服务，按 key 就近低延迟读当前聚合值（如实时在线人数）。
- 对"只读当前状态、无需复杂二级索引/长期历史"的场景，可省掉再落一份到 Redis/DB。
- 加分：点出限制——查询路由到持有该 key 的实例、跨机需元数据定位、历史归档与复杂查询仍需外部存储，体现工程边界感。
