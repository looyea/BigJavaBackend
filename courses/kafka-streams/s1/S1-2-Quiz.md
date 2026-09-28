# 状态存储、精确一次与与 Flink 对比（关联） · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. KTable 与聚合的"全量最新值"落在哪种 State Store？（6分）

- A. WindowStore
- B. KeyValueStore
- C. SessionStore
- D. 无状态
> 答案：B
> 解析：KeyValueStore 存按 key 的最新值（KTable/全局聚合）；Window/Session 存带时间边界的状态。

### 2. KS 本地 RocksDB store 靠什么实现故障恢复？（6分）

- A. 存到 ZooKeeper
- B. 持续写 compacted changelog topic，重启从 store+changelog 重建
- C. 每次全量重算
- D. 依赖副本同步到其他实例
> 答案：B
> 解析：状态写本地同时进压缩 changelog 备份，配合 standby 任务支撑恢复与迁移。

### 3. KS 实现 effectively-once(eos_v2) 的基石是？（6分）

- A. 幂等哈希
- B. Kafka 事务把消费位移+changelog+产出绑定一次提交
- C. 分布式锁
- D. 关闭多线程
> 答案：B
> 解析：eos_v2 用 Kafka 事务让"读位移、写状态、写输出"原子提交，消费端 read_committed 只读已提交。

### 4. KS 的 EOS 保护范围是？（6分）

- A. 覆盖一切外部系统
- B. 仅限"Kafka 进 / Kafka 出"的拓扑，外部非幂等副作用不受保护
- C. 只保护读
- D. 不保护状态
> 答案：B
> 解析：事务只约束 Kafka 内的位移/状态/输出；写第三方 API/非幂等 DB 不在事务内，回滚补不回。

### 5. 关于 KS 与 Flink 状态规模，正确的对比是？（6分）

- A. KS 更适合 TB 级大状态
- B. KS 本地 store 受单机与 rebalance 迁移约束，Flink 分布式 Checkpoint 撑更大状态
- C. 两者状态模型完全相同
- D. Flink 无分布式状态
> 答案：B
> 解析：这是"库 vs 引擎"在状态维度的硬约束差异。

### 6. Flink 相比 KS 在 exactly-once 覆盖上的优势是？（6分）

- A. 不需要事务
- B. 端到端 once 可覆盖更广外部系统（Checkpoint+2PC/幂等 Sink）
- C. 只能 Kafka 内 once
- D. 没有 once
> 答案：B
> 解析：Flink 把 Sink 写入与 Checkpoint 绑定，能延伸到 DB/外部；KS 的 once 以 Kafka 事务为边界。

### 7. 用 Interactive Queries 的价值是？（6分）

- A. 加速分词
- B. 把实例上的本地 store 当可查询状态服务，就近低延迟读聚合结果
- C. 替代 Kafka
- D. 触发 rebalance
> 答案：B
> 解析：IQ 让外部直接查某 key 的当前状态（如实时计数），不必再落一份到外部存储。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. 以下哪些做法会破坏 KS 的 effectively-once 保证？（多选）（9分）

- A. 拓扑中 join 一个非幂等的外部 HTTP 服务
- B. 下游消费者设置 read_committed
- C. 输出写外部系统且无幂等键
- D. 把状态 store 接 changelog 持久化
> 答案：A、C
> 解析：外部非幂等副作用(A/C)不受 Kafka 事务保护会破坏端到端 once；B(read_committed)、D(changelog) 是正确配置。

### 9. 判断"该用 Flink 而不是 KS"的信号有？（多选）（9分）

- A. 状态大到超单机承受
- B. 需要跨外部系统的端到端 exactly-once
- C. 需要复杂 CEP/大窗口/流批一体
- D. 只是把某 topic 无状态过滤后写回 Kafka
> 答案：A、B、C
> 解析：D 是 KS 的甜点场景（轻量、Kafka 为中心、免运维集群），其余三项是升级到引擎的信号。

## 三、简答题（共 40 分）

### 10. 简答题：说明 Kafka Streams 的状态存储与恢复机制、其 effectively-once 的实现原理与保护边界，并据此给出"选 KS 还是选 Flink"的判断依据。（40分）

> 参考答案：
- 要点1：store 类型（KeyValue/Window/Session）落本地 RocksDB，写时进 compacted changelog，重启 store+changelog 重建，standby 助迁移。（12分）
- 要点2：eos_v2 用 Kafka 事务把消费位移+changelog+输出原子提交，消费端 read_committed 隔离脏事务。（12分）
- 要点3：边界=只覆盖 Kafka↔Kafka，外部非幂等副作用不受事务保护。（6分）
- 要点4：状态超单机/跨外部 once/复杂窗口CEP流批一体→Flink；轻量贴应用 Kafka 为中心→KS。（10分）
