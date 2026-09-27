# 在线扩缩容与迁移、HTAP 取舍

> 本节难度：★★★★☆
> 本节重要性：★★★☆☆
> 学习产出：理解 TiDB 在线扩缩容的 Region 调度机制、DDL 在线变更原理、数据迁移方案（DM/Lightning/Sync diffs），以及 HTAP 架构下 TiFlash 的适用边界与一致性代价。

## 一、在线扩缩容

### 1.1 扩容流程

```flow
目的：展示 TiDB 加 TiKV 节点后的自动数据再平衡过程
1. 部署新 TiKV 节点 → 注册到 PD（心跳上报 Store 信息）
2. PD 检测到负载不均 → 调度器生成 Region 迁移/复制任务
3. 源 TiKV 向目标 TiKV 发送 Region Snapshot → Raft 日志追平
4. 新 Region 副本加入 Raft Group → 旧副本可被裁减（如副本数 > 期望值）
5. 集群收敛：Region 分布均衡，无需人工干预
```

### 1.2 缩容流程

- `terraform destroy` 或手动下线 TiKV → PD 自动检测 Store Offline。
- PD 调度器在超时前把该 Store 上的所有 Region Leader/Peer 迁移到其他 Store。
- 全部迁走后可安全移除节点。

```sql
-- 目的：查看 Store 状态与 Region 分布
-- 错误用法: 未等 Region 全部迁走就强制关机 → 副本数不足触发 Raft 重选举
SELECT STORE_ID, ADDRESS, STATE, CAPACITY, AVAILABLE, REGION_COUNT
FROM information_schema.tikv_store_status;
-- 结果：STATE=Down 表示已下线；Region_COUNT=0 才能安全移除
```

### 1.3 DDL 在线变更

TiDB 的 DDL 采用 **online schema change**（类似 GitHub gh-ost）：

| 操作 | 实现方式 | 锁级别 |
|------|----------|--------|
| ADD COLUMN | 只改元数据（Schema Ver）| 不阻塞 DML |
| ADD INDEX | 多版本状态：Delete-only → Write-only → Public | 不阻塞读写 |
| MODIFY COLUMN | 需重建表（reorg） | 不阻塞但消耗资源 |

```text
目的：DDL 多版本状态机——保证不同 TiDB Server 在 Schema 变更期间不冲突
absent → delete-only → write-only → public（每个状态转换需等 2 × lease 时间，默认各 60s）
```

## 二、数据迁移方案

### 2.1 全量+增量迁移：DM (Data Migration)

- 用于 MySQL → TiDB 持续同步（支持分库分表合并）。
- 全量阶段：dump → loader 导入。
- 增量阶段：解析 MySQL Binlog → 转为 TiDB SQL 重放。
- 支持断点续传、DDL 同步（白名单过滤）。

### 2.2 大批量导入：TiDB Lightning

- 场景：离线初始化 TB 级数据。
- 后端模式：`local`（并写 KV SST 文件 → Ingest）/ `tidb`（走 SQL）。
- 性能：local 后端可达 10 万+ 行/秒/节点。

### 2.3 在线热切换：Sync Diff / Dual Write

1. 双写阶段：应用同时写 MySQL 和 TiDB。
2. 持续校验：定时比对两端数据差异，自动修复。
3. 切读阶段：灰度把读流量切到 TiDB。
4. 切写阶段：停 MySQL 写入，只保留 TiDB。
5. 回滚能力：任何阶段可切回 MySQL。

## 三、HTAP 架构：TiFlash

### 3.1 设计思想

```flow
目的：展示 TiFlash 列存副本如何通过 Raft Learner 与 TiKV 行存保持同步
TiKV (行存, OLTP) ←Raft Learner→ TiFlash (列存, OLAP)
TiDB Server 根据优化器代价选择走行存还是列存
```

- TiFlash 作为 Raft Learner：只接收日志、不参与投票，不影响写入延迟。
- 列式存储 + Delta Tree 引擎：扫描吞吐 10x~100x 于行存。
- 数据同步异步（典型延迟 < 1 秒），不保证强一致读。

### 3.2 适用场景与限制

| 适合 | 不适合 |
|------|--------|
| 大表全扫描/聚合/JOIN | 点查/短事务 |
| 报表/看板/BI | 实时性要求 < 100ms |
| 数据量 > 千万行 | 数据量很小（行存足够） |

```sql
-- 目的：为表添加 TiFlash 列存副本
-- 错误用法: 所有表都加 TiFlash → 存储成本翻倍
ALTER TABLE orders SET TIFLASH REPLICA 2;  -- 结果：创建 2 个列存副本
-- 说明：需等副本同步完成（SHOW TABLE orders STATUS 看 tiflash_available）
-- 反例: 在副本未 Ready 时查询走 TiFlash → 报错或回退行存
```

### 3.3 MPP 执行

TiFlash 支持 MPP（Massively Parallel Processing）：
- Exchange 算子在多个 TiFlash 节点间 Shuffle 数据。
- 大表 Hash Join：两表按 Join Key 分片 Shuffle → 本地 Join → 聚合。
- 优化器自动选择：代价低 → 走 TiKV；代价高 → 走 TiFlash MPP。

## 四、HTAP 的取舍

- 优势：一套系统同时服务 OLTP + OLAP，消除 ETL 链路与数据孤岛。
- 代价：TiFlash 副本占额外存储/内存；列存同步有亚秒级延迟；复杂分析不如专业数仓（ClickHouse/Doris）。
- 选型建议：数据量 TB 级 + 混合负载 + 不想维护多套系统 → TiDB+TiFlash；超大规模分析 → 专用数仓 + CDC 同步。
