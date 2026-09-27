# 面试题：扩展生态与选型（PostGIS/pgvector）

## 高频面试题

### Q1：PostgreSQL 相比 MySQL 的核心优势有哪些？

**答题要点**：
- 扩展生态：PostGIS/pgvector/TimescaleDB 一套 PG 覆盖多场景
- JSONB：二进制存储 + GIN 索引，半结构化查询性能远超 MySQL JSON
- 并发 DDL：ADD COLUMN 不锁表（仅 ACCESS SHARE）
- SQL 标准兼容：CTE、窗口函数、LATERAL JOIN、递归查询
- 真正的 Serializable（SSI）隔离级别

**追问方向**：MySQL 8.0 也支持 CTE 和窗口函数了，还有什么差异？（答：执行器能力/优化器/扩展生态仍有差距；且 PG 的 CTE 12 起支持并行和物化控制）

### Q2：PostGIS 的空间索引是什么结构？为什么不适用 B-tree？

**答题要点**：
- GiST（Generalized Search Tree）：平衡树但非叶节点不要求不相交，支持 MBR 包含关系
- SP-GiST：适用于不规则分布数据（四叉树/kd-tree）
- B-tree 要求全序关系；空间对象是多维的，没有天然的"小于"定义
- 索引原理：用最小外接矩形（MBR）近似几何体，查询先过滤 MBR 再精确判断

**追问方向**：GiST 索引在极高密度区域性能下降怎么办？（答：调整 bbox 参数、分区表按区域分片、或用 Geohash 分桶预处理）

### Q3：pgvector 和专用向量数据库（Milvus/Pinecone）怎么选？

**答题要点**：
- 数据量 < 千万级 + 已有 PG + 需混合查询（元数据过滤 + 向量相似度）→ pgvector
- 数据量 > 亿级 / 需要 GPU 加速 / 需要多向量列 → 专用向量引擎
- pgvector 省去数据同步链路，事务一致性天然保证
- 专用引擎通常有分片/副本/在线索引构建能力，运维独立

**追问方向**：pgvector 性能到瓶颈怎么优化？（答：HNSW 调参 ef_search/M；分区减少单次搜索范围；考虑用 halfvec 半精度减少内存）

### Q4：什么时候选 PG 什么时候选 MySQL？给出你的决策框架。

**答题要点**：
- 选 PG：需要扩展（空间/时序/向量/全文）、复杂 SQL/分析查询、JSONB 重度使用
- 选 MySQL：团队熟悉度高、简单 OLTP CRUD、需要成熟主从/读写分离中间件生态
- 决策维度：业务需求 > 团队能力 > 生态工具链 > 性能
- 混合方案：MySQL 做主交易库 + PG/ES 做分析/搜索/推荐

**追问方向**：国内互联网大厂为什么 MySQL 用户远多于 PG？（答：历史原因——阿里去 IOE 后 MySQL 生态成熟；DBA 人才池；中间件/监控工具链完善）

### Q5：TimescaleDB 适合什么场景？与直接 PG 分区表有什么区别？

**答题要点**：
- 自动按时间创建/管理分区（hypertable），无需手动维护
- 列式压缩：近期数据行存、过期数据自动切列式压缩，节省 90%+ 空间
- 连续聚合（Continuous Aggregates）自动增量物化
- 与原生分区区别：TimescaleDB 提供策略引擎（自动 chunk 创建/压缩/归档/删除）
- 适合场景：IoT 指标、监控日志、金融 tick 数据

**追问方向**：TimescaleDB 和 InfluxDB 怎么比？（答：TimescaleDB 是 SQL 兼容的，能 JOIN 业务表；InfluxDB 是专用时序写入吞吐更高但查询语言受限）

### Q6：Citus 扩展能把 PG 变成分布式数据库吗？有什么限制？

**答题要点**：
- Citus 把表按分布键分片到多个 Worker 节点，协调器聚合结果
- 支持跨分片 JOIN（同键表 co-locate 后本地 JOIN 高效）
- 限制：分布式事务依赖 2PC、跨分片 UPDATE/DELETE 性能有限、不能随意改分布键
- 适合：多租户 SaaS 按 tenant_id 分片；大规模聚合查询
- 与 TiDB/CockroachDB 区别：Citus 不做副本自动故障转移，需要配合 PG 流复制

**追问方向**：分布键选择不当会怎样？（答：数据倾斜严重；跨分片查询多导致网络开销大；需重新分片代价高）
