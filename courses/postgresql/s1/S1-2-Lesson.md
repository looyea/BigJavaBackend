# 扩展生态与选型（PostGIS/pgvector）

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：了解 PostgreSQL 扩展机制的设计哲学，掌握 PostGIS 地理查询与 pgvector 向量检索的核心用法，能判断何时 PG 优于 MySQL 或其他专用引擎。

## 一、PostgreSQL 扩展机制

### 1.1 扩展架构设计

```text
目的：展示 PG 扩展的注册与加载机制
CREATE EXTENSION → pg_available_extensions 元数据 → 动态加载 .so 共享库
                                                 → 注册新数据类型/操作符/索引方法
```

PG 的扩展不是"插件"——它可以注册**自定义类型**、**操作符类**、**索引方法**甚至**FDW**（外部数据包装器），能力边界远超 MySQL UDF。

### 1.2 常用扩展一览

| 扩展 | 用途 | 典型场景 |
|------|------|----------|
| PostGIS | 地理空间数据 | LBS、地图、围栏判断 |
| pgvector | 向量相似度搜索 | AI Embedding 检索 |
| TimescaleDB | 时序数据自动分区 | IoT 监控、指标存储 |
| Citus | 分布式表 | 水平扩展写吞吐 |
| pg_trgm | 三元组模糊匹配 | 全文搜索兜底 |
| hll | HyperLogLog 基数统计 | UV 去重 |
| uuid-ossp / pgcrypto | UUID/加密函数 | 主键生成、字段加密 |

## 二、PostGIS 地理查询

### 2.1 核心数据类型

- `GEOMETRY`：平面坐标系（投影后），适合米级精确计算。
- `GEOGRAPHY`：WGS84 经纬度球面坐标，距离计算自动走椭球模型。
- 构造：`ST_GeomFromText('POINT(116.4 39.9)', 4326)`（SRID 4326 = WGS84）。

```sql
-- 目的：查询距离用户 3km 内的门店——GEOGRAPHY 类型 + GiST 空间索引
-- 错误用法: 用经纬度直接加减估算距离 → 不同纬度误差巨大
-- 反例: 没建空间索引 → 全表扫描每行算距离
CREATE TABLE stores (
    id BIGINT PRIMARY KEY,
    name TEXT,
    location GEOGRAPHY(POINT, 4326)  -- 结果：存储球面坐标点
);
CREATE INDEX idx_store_loc ON stores USING GIST (location);  -- 说明：GiST 支持空间检索

SELECT name, ST_Distance(location, ST_GeogFromText('SRID=4326;POINT(116.4 39.9)')) AS dist_m
FROM stores
WHERE ST_DWithin(location, ST_GeogFromText('SRID=4326;POINT(116.4 39.9)'), 3000)  -- 3km
ORDER BY dist_m LIMIT 20;  -- 结果：利用索引做距离过滤，毫秒级返回
```

### 2.2 常用空间操作

- `ST_Contains(区域, 点)`：判断点是否在多边形内（电子围栏）。
- `ST_Buffer(几何体, 半径)`：缓冲区生成。
- `ST_Intersects(A, B)`：两几何体是否相交。

## 三、pgvector 向量检索

### 3.1 场景：AI Embedding 相似度搜索

传统方案需要独立向量数据库（Milvus/Pinecone）；pgvector 让 PG 直接存向量 + ANN 索引，省去数据同步。

```sql
-- 目的：用 pgvector 存储商品 128 维 embedding 并做余弦相似度检索
-- 错误用法: 暴力精确计算（ORDER BY embedding <=> query LIMIT K 无索引）→ 百万级秒级以上
-- 反例: 用 HNSW 索引但不调 ef_search → 召回率低
CREATE TABLE products (
    id BIGINT PRIMARY KEY,
    title TEXT,
    embedding vector(128)  -- 结果：128 维浮点向量列
);
CREATE INDEX ON products USING hnsw (embedding vector_cosine_ops);  -- 说明：HNSW 索引 + 余弦距离

-- 相似度查询（<=> 是余弦距离算子）
SELECT title, 1 - (embedding <=> '[0.12, 0.34, ...]'::vector) AS similarity
FROM products
ORDER BY embedding <=> '[0.12, 0.34, ...]'::vector
LIMIT 10;
```

### 3.2 索引选择

| 索引类型 | 构建速度 | 查询速度 | 召回率 | 适用 |
|----------|----------|----------|--------|------|
| IVFFlat | 快 | 中 | 中（需调 nprobe） | 数据量大且可离线建 |
| HNSW | 慢（耗内存） | 极快 | 高（>0.95） | 在线实时检索 |
| 无索引 | — | O(n) | 100% | < 10 万行可接受 |

## 四、何时选 PG 而非 MySQL

```flow
目的：PG vs MySQL 选型决策树
需要复杂空间/地理查询？→ PG (PostGIS)
需要向量搜索且不想引入独立引擎？→ PG (pgvector)
需要 JSONB 半结构化 + GIN 索引？→ PG
需要时序自动分区 + 压缩？→ PG (TimescaleDB)
需要严格 MySQL 生态兼容（ORM/中间件）？→ MySQL
团队运维能力有限、简单 CRUD 读为主？→ MySQL
```

PG 优势：扩展生态丰富、SQL 标准兼容度高、真正的并发 DDL、CTE/Materialized View、JSONB 性能优于 MySQL JSON。

MySQL 优势：主从复制工具链成熟、连接池/中间件生态广泛、DBA 人才池大、简单查询优化器更可预测。
