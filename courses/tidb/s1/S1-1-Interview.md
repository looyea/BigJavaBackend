# 面试题：TiDB 计算存储分离架构

## 高频面试题

### Q1：TiDB 的三层架构各自解决什么问题？

**答题要点**：
- TiDB Server（计算层）：SQL 解析/优化/执行、事务协调；解决"扩展计算能力"
- PD（调度层）：全局时钟、Region 调度、元数据管理；解决"一致性"和"负载均衡"
- TiKV（存储层）：KV 持久化、Raft 多副本；解决"可靠存储"和"扩展存储"
- 分离的好处：各层独立伸缩，计算密集加 TiDB、存储密集加 TiKV

**追问方向**：如果 PD 成为瓶颈怎么办？（答：PD 只做轻量调度和 TSO，通常不是瓶颈；极端场景拆分 TSO 服务、预分配更大区间）

### Q2：TiDB 如何兼容 MySQL？兼容性到什么程度？

**答题要点**：
- 协议层：完整实现 MySQL Wire Protocol（4000 端口），MySQL Client/驱动直连
- SQL 层：支持 MySQL 5.7/8.0 大部分 DDL/DML/DQL；支持窗口函数、CTE
- 不支持：存储过程、触发器、外键约束（7.4+有实验性）、EVENT、LOAD DATA LOCAL INFILE
- 差异：自增 ID 不保证连续（批量分配）、不支持 PREPARE 所有形式

**追问方向**：迁移时应用改什么？（答：去掉存储过程逻辑上提到应用层；检查是否有依赖自增连续性的代码；Binlog 工具需切换到 TiCDC）

### Q3：Percolator 事务模型的核心思想是什么？

**答题要点**：
- 去中心化事务：无独立 TM，Coordinator 是发起事务的 TiDB Server
- 三列模型：Data（值）、Lock（锁信息）、Commit（提交版本号）
- 选一个 Key 作为 Primary Key，PK 的 Lock+Data 即事务状态标记
- 崩溃恢复：其他事务遇到 Lock 超时后检查 PK 状态 → Commit 或 Rollback

**追问方向**：Percolator 的缺点是什么？（答：PK 单点写放大；跨 Region 事务延迟受最慢 Region 制约；锁等待可能引起连锁回查）

### Q4：Region 分裂的触发条件和过程？

**答题要点**：
- 触发：Region 大小超过 region-split-size（默认 96MB）或 Key 数量超过阈值
- 过程：TiKV 后台线程检测 → 选择 Split Key（中间点或热点 Key）→ 通知 PD → PD 批准 → 分裂为两个子 Region
- 子 Region 各自有独立 Raft Group → 可被调度到不同 Store
- 热点调度：PD 发现某 Region QPS 远超平均 → 主动分裂 + 迁移到空闲节点

**追问方向**：为什么不直接把数据分散到更多节点而要用 Region？（答：Region 是 Raft 复制粒度，太小则 Raft 心跳/选举开销爆炸；96MB 是吞吐与元数据开销的平衡点）

### Q5：TiDB 的 Coprocessor 下推能做什么？

**答题要点**：
- 把计算"推"到存储节点执行，减少网络传输
- 支持：Selection（WHERE 过滤）、Aggregation（SUM/COUNT）、TopN、Limit
- TiFlash MPP：对分析型查询做并行 Exchange + Shuffle
- 下推由优化器决定：代价模型评估"本地算"vs"拉回再算"

**追问方向**：哪些操作不能下推？（答：跨 Region 的 Hash Join 不能下推到单 Region；子查询/窗口函数部分不能下推）

### Q6：TiDB 与 CockroachDB 的架构对比？

**答题要点**：
- 相似：都是 SQL-on-KV、Raft 复制、分布式事务、兼容 PostgreSQL/MySQL 协议
- 差异：TiDB 三层分离 + TiFlash HTAP；CRDB 两层（Node 融合 SQL+KV）
- TiDB 协议兼容 MySQL；CRDB 兼容 PostgreSQL
- TiDB 有 PD 集中调度；CRDB 完全去中心化（各节点自行 rebalance）
- 生态：TiDB 国内使用广、文档中文；CRDB 国际用户多

**追问方向**：生产选型你怎么选？（答：团队技术栈 + 协议兼容需求 + 是否需要 HTAP + 运维工具成熟度）
