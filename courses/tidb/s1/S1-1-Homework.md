# 课后作业：TiDB 计算存储分离架构

## 作业 1：架构分析（35分）

场景：你的公司目前使用 MySQL + ShardingSphere 做 64 个分库，运维成本高、扩容困难。考虑迁移到 TiDB。

要求：
1. 画出当前分库分表架构与 TiDB 架构的对比图，标注各组件职责。
2. 分析 TiDB 三层架构中"如果 TiDB Server 挂了一半节点"、"如果 TiKV 一台机器宕机"、"如果 PD Leader 切换"分别会发生什么，业务影响是什么。
3. 给出迁移评估清单：哪些 SQL/特性不兼容？应用层需要改什么？灰度切流方案如何设计？

## 作业 2：Region 与数据分布（30分）

场景：TiDB 集群有 10 个 TiKV 节点，共 12000 个 Region。

要求：
1. 计算：如果每张表 1 亿行（平均行宽 500 字节），预估总 Region 数量。数据倾斜会导致什么问题？
2. 解释热点 Region 的形成原因（如自增主键写入集中），给出三种缓解方案。
3. 写出用 `SHOW TABLE regions` 或 `information_schema.tidb_regions` 排查热点的方法。

## 作业 3：Percolator 事务推演（35分）

要求：
1. 画出 TiDB 一个跨 Region 事务（修改了 3 个不同 Region 的数据）从 BEGIN 到 COMMIT 的完整时序图，标注 Primary Key 选择、Lock 写入、ReadTS 获取。
2. 假设 Phase 2 写完 Secondary Lock 后 Coordinator 崩溃：分析其他事务如何判断该事务状态、Resolve Lock 的触发条件与流程。
3. 对比 MySQL InnoDB 的 2PC（prepare + commit via binlog），说明 Percolator 的去中心化优势与代价。
