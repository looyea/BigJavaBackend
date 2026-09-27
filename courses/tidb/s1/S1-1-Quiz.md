# 小测验：TiDB 计算存储分离架构

### 1. TiDB 架构中负责全局时间戳分配的是哪个组件？（10分）
- A. TiDB Server
- B. TiKV
- C. PD (Placement Driver)
- D. TiFlash
> 答案：C
> 解析：PD 的 TSO（Timestamp Oracle）提供全局单调递增时间戳，用于 MVCC 快照读和事务提交排序。

### 2. TiKV 中 Region 的默认大小限制是多少？（10分）
- A. 16MB
- B. 64MB
- C. 96MB（分裂阈值）/ 144MB（最大）
- D. 1GB
> 答案：C
> 解析：Region 默认 96MB 触发分裂，最大不超过 144MB。Region 是数据分片和调度的最小单位。

### 3. 以下关于 TiDB Server 的说法，正确的有？（多选，10分）
- A. TiDB Server 是有状态的，存储部分数据
- B. TiDB Server 无状态，可水平扩展
- C. TiDB Server 兼容 MySQL 协议
- D. TiDB Server 负责事务协调
> 答案：B、C、D
> 解析：TiDB Server 完全无状态，不存储数据；负责 SQL 解析优化执行和事务协调。

### 4. TiDB 的默认事务隔离级别是？（10分）
- A. READ UNCOMMITTED
- B. READ COMMITTED
- C. Snapshot Isolation（等价可重复读）
- D. SERIALIZABLE
> 答案：C
> 解析：TiDB 默认 SI（通过 Percolator + TSO 实现），行为等价于可重复读；也支持 RC。

### 5. TiFlash 在 TiDB 架构中的角色是？（10分）
- A. 分布式事务协调器
- B. 行存引擎
- C. 列存分析引擎，通过 Raft learner 同步数据
- D. 缓存层
> 答案：C
> 解析：TiFlash 是列存引擎，作为 Region 的 Raft Learner 实时同步数据，加速 OLAP 分析查询。

### 6. Percolator 事务模型中 Primary Key 的作用是？（10分）
- A. 表示业务主键
- B. 标记事务的提交状态，崩溃后可据此判断事务是否成功
- C. 决定数据分片位置
- D. 用于 Raft Leader 选举
> 答案：B
> 解析：Primary Key 的 Lock 被 commit 后表示整个事务已提交。若 Coordinator 崩溃，其他事务可通过检查 PK 状态决定 Rollback 或 Commit。

### 7. 判断："TiDB 完全兼容 MySQL 的所有语法和特性。"（5分）
- A. 正确
- B. 错误
> 答案：B
> 解析：TiDB 兼容 MySQL 协议和大部分语法，但不支持存储过程、触发器、外键约束、EVENT 等特性。

### 8. 以下哪些是 TiDB 相比 MySQL 分库分表方案的优势？（多选，10分）
- A. 在线水平扩容无需手动迁移数据
- B. 原生分布式事务，无需 Seata/XA
- C. 完全兼容 MySQL 所有中间件和生态工具
- D. 跨分片 JOIN 和聚合无限制
> 答案：A、B、D
> 解析：TiDB 并非完全兼容 MySQL 所有工具（如某些 Binlog 工具不支持），但核心 SQL 能力不受分片限制。

### 9. 简答题：描述 TiDB 一条 SELECT 查询的完整执行路径（从客户端到返回结果）。（15分）
> 参考答案：
> - 客户端通过 MySQL 协议连接 TiDB Server → Parser 解析为 AST
> - Planner 生成逻辑/物理计划，决定索引扫描还是全表扫描
> - Executor 向 PD 获取 Region 位置信息（缓存），向对应 TiKV Leader 发起 Coprocessor 请求
> - TiKV 在本地执行过滤/聚合下推，返回中间结果
> - TiDB Server 汇总结果（如需要 Merge/Sort）后返回客户端

### 10. 简答题：PD 集群挂了会发生什么？TiDB 如何保障高可用？（15分）
> 参考答案：
> - PD 基于 Raft 多数派协议，3 节点可容忍 1 节点故障，5 节点可容忍 2 节点
> - PD 全挂时：已有事务可继续（TiDB Server 缓存 TSO 一段区间），但无法获取新 Region 路由/无法分配新 TSO
> - TiDB Server 本地缓存 TSO 预分配（通常 3 秒区间），短暂 PD 不可用不影响在线事务
> - 恢复：PD Leader 自动重选；若全部宕机需从 etcd 数据恢复元数据
