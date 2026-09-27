# 小测验：扩展生态与选型（PostGIS/pgvector）

### 1. PostgreSQL 扩展能做到的事情不包括？（10分）
- A. 注册自定义数据类型
- B. 注册新的索引方法
- C. 修改 PostgreSQL 的查询优化器核心源码
- D. 提供外部数据包装器（FDW）
> 答案：C
> 解析：扩展可以注册类型/操作符/索引方法/FDW/Hook，但不能修改优化器核心源码——那需要 fork 整个项目。

### 2. PostGIS 中 GEOGRAPHY 与 GEOMETRY 的核心区别是？（10分）
- A. GEOGRAPHY 只支持点，GEOMETRY 支持所有形状
- B. GEOGRAPHY 基于球面坐标计算距离，GEOMETRY 基于平面投影
- C. GEOMETRY 精度更高
- D. 二者完全相同只是别名
> 答案：B
> 解析：GEOGRAPHY 使用 WGS84 经纬度 + 椭球模型计算真实距离；GEOMETRY 在投影平面上做欧氏计算。

### 3. pgvector 支持的索引类型包括？（多选，10分）
- A. IVFFlat
- B. HNSW
- C. GiST
- D. B-tree
> 答案：A、B
> 解析：pgvector 目前支持 IVFFlat 和 HNSW 两种 ANN 索引。GiST 可以建但仅用于精确搜索（非 ANN 近似）；B-tree 不支持向量类型。

### 4. 以下哪个场景最适合用 PostGIS 而不是 Redis GEO？（10分）
- A. 存储 10 万个外卖骑手位置并查 3km 内最近骑手
- B. 判断一个坐标点是否落在复杂多边形围栏区域内
- C. 简单的经纬度距离排序
- D. 城市级别的天气站点距离
> 答案：B
> 解析：Redis GEO 只支持点数据 + 圆形范围查询；复杂多边形包含/相交/缓冲区等需要 PostGIS。

### 5. pgvector 中 `<=>` 运算符代表什么距离？（10分）
- A. 欧氏距离
- B. 余弦距离
- C. 曼哈顿距离
- D. 汉明距离
> 答案：B
> 解析：`<=>` 是余弦距离算子；`<->` 是欧氏距离；`<#>` 是负内积。

### 6. TimescaleDB 的核心能力是？（10分）
- A. 全文检索
- B. 自动时间分区 + 列式压缩
- C. 分布式事务
- D. 图遍历查询
> 答案：B
> 解析：TimescaleDB 自动按时间维度创建 hypertable 分区，并提供列式压缩和连续聚合（Continuous Aggregates）。

### 7. 判断："MySQL 的 JSON 类型性能与 PostgreSQL 的 JSONB 完全等价。"（5分）
- A. 正确
- B. 错误
> 答案：B
> 解析：PG 的 JSONB 是二进制存储 + GIN 索引支持，查询性能远优于 MySQL 的 JSON（文本存储，索引能力有限）。

### 8. 以下哪些属于 PostgreSQL 相对 MySQL 的优势？（多选，10分）
- A. 真正的并发 DDL（加列不锁表）
- B. 丰富的扩展生态（PostGIS/pgvector 等）
- C. 主从复制延迟更低
- D. 支持 CTE 和物化视图
> 答案：A、B、D
> 解析：主从复制延迟 MySQL 生态工具链更成熟（GTID/半同步/MGR），C 不一定是 PG 优势。

### 9. 简答题：你的项目需要"附近的人"功能（500 万注册用户，实时查 5km 内在线用户），你会选 PG+PostGIS 还是 Redis GEO？给出理由和方案。（15分）
> 参考答案：
> - Redis GEO 适合实时热数据（在线用户），S半径查询 O(N) 但 N 为区域内 key 数，5km 内通常可接受
> - 持久化存储和复杂属性过滤（性别/年龄/兴趣）用 PG 主表
> - 混合方案：在线状态 + 位置写 Redis GEO；查询用 Redis 拿 ID 列表再回 PG 过滤属性
> - 如果不需要实时性（如"附近的商家"），PostGIS GiST 索引 + ST_DWithin 即可

### 10. 简答题：pgvector HNSW 索引的 ef_search 参数是什么？调大调小分别有什么影响？（10分）
> 参考答案：
> - ef_search 是查询时在每层搜索的候选队列大小，默认 40
> - 调大：召回率提高、查询变慢（更多节点参与距离计算）
> - 调小：查询快但可能漏掉真正最近邻（召回率下降）
> - 实践：对召回率要求 > 99% 时设 ef_search ≥ 200；要求 95% 可用 40~80
