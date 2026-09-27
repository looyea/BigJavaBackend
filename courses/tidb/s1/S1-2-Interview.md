# 面试题：在线扩缩容与迁移、HTAP 取舍

## 高频面试题

### Q1：TiDB 扩容时业务有影响吗？数据迁移的原理是什么？

**答题要点**：
- 新 TiKV 启动后向 PD 注册 → PD 调度器发现负载不均 → 生成 Region Split/Move 任务
- 迁移基于 Raft：新增 Learner → 快照传输 → 日志追平 → 转为 Follower → 可能升级为 Leader
- 全程在线，业务不感知；可通过 PD 配置限速避免影响 IO
- 缩容需等 Store 上 Region 全部迁走才能安全下线

**追问方向**：Region 迁移会不会导致短暂不可用？（答：Leader 切换时可能 < 1s 毛刺；PD 调度策略优先迁移 Follower 避免 Leader 切换）

### Q2：TiDB 的 DDL 为什么要等 2 个 lease 时间？

**答题要点**：
- 每个 TiDB Server 定期（每 lease=60s）从 PD 拉取最新 Schema
- DDL Owner 转换状态前需等 2×lease：保证所有 Server 都已看到旧状态并处理完进行中的事务
- 若不等：某 Server 还在用旧 Schema 写入 → 与新 Schema 不兼容 → 数据不一致
- 极端场景：若 TiDB Server 假死但 TCP 连接不断，lease 可能不准；需要 owner check

**追问方向**：DDL 执行过程中 TiDB Server 重启了怎么办？（答：DDL Job 持久化在 TiKV，任何 Server 成为新 Owner 后从中断状态继续执行）

### Q3：DM 工具迁移过程中遇到 DDL 怎么办？

**答题要点**：
- DM 支持同步 DDL（如 ALTER TABLE ADD COLUMN）到 TiDB
- 风险：MySQL 的 DDL 可能与 TiDB 不兼容（如某些 MySQL 特有语法）
- 策略：白名单过滤 / 黑名单屏蔽 / 人工确认后放行
- 最佳实践：迁移期间冻结 DDL；业务变更后统一手动执行

**追问方向**：如果 DDL 导致上游 schema 变化但 TiDB 侧同步失败，DM 如何处理？（答：报错阻塞增量同步 → 人工修复后 resume）

### Q4：TiFlash 如何保证数据与 TiKV 最终一致？

**答题要点**：
- Raft Learner 机制：TiKV Region Leader 提交 Raft Log 后，异步推送给 TiFlash Learner
- Delta Tree 引擎：先写 Delta（增量）、后台 Merge 到 Main（基线）
- 一致性读保障：TiFlash 查询前等 Region 的 `applied_index >= commit_index`（可读检查点）
- 不阻塞写入：Learner 不参与投票；TiFlash 节点全挂只影响分析查询，OLTP 无影响

**追问方向**：TiFlash 同步延迟过大怎么排查？（答：检查 TiFlash 节点 IO/CPU、Raft 日志堆积、Region 热点写入是否超吞吐上限）

### Q5：从 MySQL 迁到 TiDB，自增 ID 怎么处理？

**答题要点**：
- TiDB AUTO_INCREMENT 默认批量分配（每个 TiDB 节点缓存一段），不保证连续
- 迁移时 DM 会保留原表 AUTO_INCREMENT 值继续递增
- 如需严格连续：使用 `AUTO_ID_CACHE=1`（性能有损）或应用层发号器
- TiDB 也支持 `AUTO_RANDOM`（分布式友好的打散主键，避免写入热点）

**追问方向**：为什么需要 AUTO_RANDOM？（答：顺序递增主键导致所有写入落在最后一个 Region 形成热点；AUTO_RANDOM 打散分布）

### Q6：HTAP 架构相比"OLTP 库 + CDC + 独立 OLAP 数仓"的优劣？

**答题要点**：
- HTAP 优势：无 ETL 链路、数据实时性更好、运维一套系统成本低
- HTAP 劣势：分析能力有限（不如 ClickHouse 的向量化极致）、存储成本（双份）、不适合 PB 级
- 独立数仓优势：专职分析性能更强、历史数据可归档压缩、数据治理/血缘体系完善
- 决策点：数据规模、查询复杂度、团队运维能力、实时性要求

**追问方向**：TiFlash 查询能走 MPP 意味着什么？（答：多个 TiFlash 节点间 Shuffle 数据做分布式 Join/Agg，不再只靠单节点扫描）
