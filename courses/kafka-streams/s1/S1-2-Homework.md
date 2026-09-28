# 状态存储、精确一次与与 Flink 对比（关联） · 作业

## 作业 1：用 Processor API 写一个可恢复的去重算子

- 目标：亲手接一个 State Store 而非用内存集合。
- 任务：实现"按事件 id 去重"的自定义 Processor：用 KeyValueStore("seen-ids") 判断是否见过，见过丢弃、否则 put 并 forward；为其接 compacted changelog；加 TTL/定期清理防无界增长；重启实例验证去重状态不丢。
- 验收标准：重启后仍能识别历史 id 不重复放行；store 有清理策略不撑爆本地盘；能说明为什么内存 HashSet 在生产不可靠。
- 参考解法要点：状态必须落 store+changelog 才能跨重启/迁移；去重键要设保留窗口。

## 作业 2：开启 EOS 并验证事务边界

- 目标：体验 effectively-once 的成立条件与被破坏的情形。
- 任务：把一个 Kafka→聚合→Kafka 的作业配 `processing.guarantee=eos_v2`，下游消费者设 `read_committed`；注入实例宕机重启，校验结果既不重也不漏；再在拓扑里加一个"非幂等外部 HTTP 富化"，说明 EOS 为何名不副实。
- 验收标准：纯 Kafka 拓扑下故障恢复后计数精确；引入外部非幂等副作用后能指出破坏点；解释 read_committed 与中止事务的可见性关系。
- 参考解法要点：EOS 只保证 Kafka 内位移+状态+输出原子；外部副作用需自带幂等。

## 作业 3：写一份 KS vs Flink 的选型论证（含 Interactive Queries）

- 目标：把状态语义与运维约束转成决策文档。
- 任务：给一个"实时用户画像富化 + 就近查询当前在线人数"的应用，说明用 KS 的实现（流表 join + WindowStore + Interactive Queries 就近读）与用 Flink 的差异（状态规模、端到端 once 覆盖外部、rescale）；给出明确选择与升级触发条件。
- 验收标准：论证命中"状态是否超单机、once 是否需跨外部、是否要平台化共享"三轴；说明 IQ 如何免额外存储直接暴露状态。
- 参考解法要点：轻量贴应用选 KS、约束被突破再升级 Flink；选型可演进，不为统一而统一。
