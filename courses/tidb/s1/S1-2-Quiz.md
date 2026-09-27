# 小测验：在线扩缩容与迁移、HTAP 取舍

### 1. TiDB 扩容 TiKV 节点后数据如何迁移？（10分）
- A. 手动执行 ALTER TABLE REBALANCE
- B. PD 调度器自动生成 Region 迁移任务，无需人工干预
- C. 重启整个集群自动分配
- D. 需要停写后导出导入
> 答案：B
> 解析：新 TiKV 注册后 PD 检测负载不均，自动把部分 Region 的副本迁移到新节点，全程在线。

### 2. TiDB DDL 状态机中，ADD INDEX 的正确状态顺序是？（10分）
- A. public → write-only → delete-only → absent
- B. absent → delete-only → write-only → public
- C. absent → write-only → public
- D. absent → public（一步到位）
> 答案：B
> 解析：TiDB 采用多版本 Schema 状态机，索引从 absent 到 public 需经过 delete-only 和 write-only 两个中间状态，确保所有 TiDB 节点同步。

### 3. TiFlash 数据同步到列存副本的一致性级别是？（10分）
- A. 强一致（与 TiKV 同步写入）
- B. 最终一致（Raft Learner 异步复制，典型延迟 < 1s）
- C. 完全不同步
- D. 定时批量同步（每小时）
> 答案：B
> 解析：TiFlash 作为 Raft Learner 异步接收日志，不阻塞 TiKV 写入，存在亚秒级延迟。

### 4. 以下哪些是 TiDB Lightning 的适用场景？（多选，10分）
- A. 从 MySQL 全量迁移数据到 TiDB
- B. 在线增量同步 Binlog
- C. TB 级离线批量导入
- D. 从 CSV/Parquet 文件导入
> 答案：A、C、D
> 解析：Lightning 做全量/批量导入；增量同步 Binlog 是 DM 的功能。

### 5. 缩容 TiKV 节点前必须确认的条件是？（10分）
- A. 该节点的 CPU 使用率为 0
- B. 该 Store 上 REGION_COUNT=0（所有 Region 已迁走）
- C. 集群已暂停业务
- D. PD Leader 在该节点上
> 答案：B
> 解析：PD 调度器需时间把待下线节点的 Region 副本迁走；REGION_COUNT 降到 0 才能安全移除，否则副本数不足。

### 6. DM（Data Migration）支持以下哪些功能？（多选，10分）
- A. 多对一迁移（多个 MySQL 分库合并到一张 TiDB 表）
- B. 全量 + 增量一体化
- C. 替代 MySQL 主从复制
- D. DDL 同步（白名单过滤）
> 答案：A、B、D
> 解析：DM 是 MySQL→TiDB 的迁移工具，不是 MySQL 主从替代品。

### 7. 判断："TiFlash 副本会参与 Raft 投票选举 Leader。"（5分）
- A. 正确
- B. 错误
> 答案：B
> 解析：TiFlash 是 Raft Learner，只接收日志不参与投票，不影响集群写入延迟和 Leader 选举。

### 8. TiDB 双写迁移方案中"持续校验"的目的是？（10分）
- A. 提高写入性能
- B. 发现 MySQL 与 TiDB 之间的数据不一致并自动修复
- C. 压缩数据节省空间
- D. 同步表结构
> 答案：B
> 解析：双写阶段两个库可能因 Bug/网络丢数据；持续比对发现差异，保证切换前两边数据一致。

### 9. 简答题：TiDB 的 DDL 为什么要用多版本状态机（absent→delete-only→write-only→public）？如果跳过中间状态会出什么问题？（15分）
> 参考答案：
> - 多版本状态机保证不同 TiDB Server 在 Schema 变更期间不会行为不一致（每个 Server 按 lease 刷新 Schema）
> - 如果跳过中间状态直接 public：某 Server 还未刷新 Schema 时写入的数据缺少索引列，导致索引数据不一致
> - delete-only：只允许删除索引条目不允许新增；write-only：允许新增/更新索引但查询不使用
> - 每步转换需等 2×lease（默认 120s），确保所有节点都看到了前一个状态后再推进一步

### 10. 简答题：什么时候 HTAP（TiFlash）方案够用，什么时候需要独立数仓？给出你的判断标准。（10分）
> 参考答案：
> - TiFlash 够用：数据量 < 10TB、分析查询为中等复杂度（多表 JOIN + 聚合）、不想维护 ETL 管道
> - 需要独立数仓：数据量 > 10TB、复杂 ETL/数据治理、需要跨业务域关联、查询模式涉及 PB 级扫描
> - 判断标准：查询延迟要求（亚秒级 vs 分钟级可接受）、并发分析用户数、存储成本预算
> - 混合方案：TiDB 做 OLTP + CDC 同步到 ClickHouse/Doris 做重分析
