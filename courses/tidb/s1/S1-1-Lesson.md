# TiDB 计算存储分离架构

> 本节难度：★★★★☆
> 本节重要性：★★★☆☆
> 学习产出：掌握 TiDB 三层架构（TiDB Server / PD / TiKV）的职责划分、数据分片与一致性协议（Raft），以及计算存储分离带来的弹性与运维优势。

## 一、整体架构概览

```flow
目的：展示 TiDB 集群三层组件与数据流向
Client → [TiDB Server × N（无状态 SQL 层）] → [PD Cluster（调度中心）]
                                ↓                        ↓
                    [TiKV × N（行存引擎，Raft 多副本）]  ← 心跳/Region 调度
                                ↓
                    [TiFlash × N（列存副本，实时同步）]
```

| 组件 | 职责 | 状态 |
|------|------|------|
| TiDB Server | SQL 解析、优化、执行；事务协调（Percolator） | 无状态，水平扩 |
| PD (Placement Driver) | 元数据管理、Region 调度、TSO 全局时钟 | 有状态（Raft 3/5 节点） |
| TiKV | 行存 KV 引擎，数据按 Region 分片，Raft 复制 | 有状态，水平扩 |
| TiFlash | 列存分析引擎，通过 Raft learner 实时同步 | 可选组件 |

## 二、TiDB Server（计算层）

### 2.1 无状态设计

TiDB Server 不存储数据，每个节点等价：
- 接收 MySQL 协议连接（兼容 MySQL 客户端/驱动/ORM）
- 解析 SQL → 逻辑计划 → 物理计划 → 生成 Task（Coprocessor + DAG）
- 向 TiKV/TiFlash 发送 KV 读写请求
- 事务协调：Percolator 模型，TiDB Server 作为 Coordinator

```java
// 目的：TiDB 兼容 MySQL 协议——应用几乎无需改代码即可迁移
// 错误用法: 连接串写 jdbc:mysql://tidb:4000 但驱动版本过低不支持新认证插件
// 反例: 使用 MySQL 特有的 LOAD DATA LOCAL INFILE → TiDB 不支持
Connection conn = DriverManager.getConnection(
    "jdbc:mysql://tidb-server:4000/test?useSSL=false",  // 结果：TiDB 默认端口 4000
    "root", "");
// 说明：大部分 MySQL 语法兼容，但不支持存储过程、触发器、外键约束
```

### 2.2 SQL 执行流程

1. **Parser**：SQL → AST
2. **Planner**：AST → 逻辑计划 → 选择索引/Join 算法
3. **Executor**：向 TiKV 发起 Coprocessor 下推（Filter/Agg 在存储节点执行）
4. **Txn**：两阶段提交（Percolator）→ Primary Key + Secondary Keys

## 三、PD（调度中心）

### 3.1 核心职责

- **TSO（Timestamp Oracle）**：分配全局单调递增时间戳，供 MVCC 和事务使用。
- **Region 调度**：负载均衡、热点打散、副本补齐。
- **元数据中心**：维护 Schema/Region/Store 拓扑信息。

### 3.2 PD 高可用

```text
目的：PD 集群基于 Raft 选主，保证元数据一致性
PD-1(Leader) ←→ PD-2(Follower) ←→ PD-3(Follower)
部署建议：3 或 5 节点奇数；与 TiKV 分离部署避免 IO 争抢
```

## 四、TiKV（存储层）

### 4.1 Region 数据分片

- 数据按 Key 范围划分为 Region（默认 96MB 触发分裂，最大 144MB）。
- 每个 Region 有 Leader + 2 Follower（默认 3 副本），Raft 协议保证强一致。
- Region 是调度的最小单位：PD 可把热点 Region 迁移到空闲 Store。

```sql
-- 目的：查看 Region 分布与副本状态
-- 错误用法: 只看总数据量不看 Region 分布 → 热点 Region 压垮单节点
SELECT * FROM information_schema.tidb_regions LIMIT 10;
-- 结果：每个 Region 的 START_KEY / END_KEY / PEER_COUNT / LEADER_STORE_ID
```

### 4.2 Coprocessor 下推

TiKV 的 Coprocessor 能在存储节点执行部分计算：
- `WHERE` 条件下推：减少网络传输
- `Agg`/`TopN` 下推：列式计算框架（DAG Request）
- TiFlash MPP：复杂分析查询并行执行

## 五、事务模型：Percolator

```flow
目的：展示 TiDB 的 Percolator 两阶段提交流程
Phase 1: Write Primary Lock + Data → 成功则进入 Phase 2
Phase 2: 并行 Write Secondary Locks + Data → 异步 Clean Up Primary Lock
读请求遇到 Lock → 检查 Lock TTL / 判断事务状态（Rollback/Committed）
```

关键特点：
- 全局时钟由 PD TSO 提供，无需 2PC 时钟同步。
- Lock Column 标记事务状态，支持崩溃恢复（异步 Resolve Lock）。
- 隔离级别默认 SI（Snapshot Isolation，等价可重复读）；支持 RC。

## 六、与 MySQL 分库分表方案的对比

| 维度 | MySQL + ShardingSphere | TiDB |
|------|------------------------|------|
| 扩展方式 | 手动加库加表 + 数据迁移 | 加 TiKV 节点自动 Rebalance |
| 跨分片事务 | XA/Seata/TCC | 原生分布式事务 |
| 全局唯一 ID | 需号段/Snowflake | 自增序列 + AutoID |
| SQL 能力 | 中间件受限（跨片 JOIN/聚合） | 完整 SQL |
| 运维复杂度 | 分片规则 + DDL 变更困难 | 透明，像用单机 DB |
