# 课后作业：在线扩缩容与迁移、HTAP 取舍

## 作业 1：设计 MySQL 分库分表到 TiDB 的迁移方案（40分）

场景：当前有 32 个 MySQL 分库（按 user_id % 32），每库约 500GB，合计 16TB。需要平滑迁移到 TiDB。

要求：
1. 选择迁移工具（DM/Lightning/双写），说明理由。设计分库合并为单表的映射规则。
2. 画出完整迁移流程图：全量导出 → 数据校验 → 增量追平 → 双写验证 → 灰度切读 → 切写 → 下线旧库。
3. 写出数据校验方案：如何高效比对 16TB 数据的一致性？（提示：分片 CRC/抽样/全量 checksum）
4. 回滚方案：切写后发现问题如何回切 MySQL？需要保留 MySQL 多久的写入能力？

## 作业 2：TiFlash HTAP 实践（30分）

场景：TiDB 集群有 5 个 TiKV 节点 + 2 个 TiFlash 节点，orders 表 3 亿行。

要求：
1. 为 orders 表添加 TiFlash 副本并验证同步状态（写出 SQL 与观察到的 AVAILABLE 比例变化）。
2. 写一条复杂分析 SQL（按月聚合各品类 GMV），分别用 `EXPLAIN ANALYZE` 观察走 TiKV 与走 TiFlash 的执行计划与耗时差异。
3. 讨论：如果 TiFlash 副本同步延迟突然飙到 5 分钟，对业务有什么影响？你会如何告警与处理？

## 作业 3：在线扩缩容实验（30分）

环境：本地用 TiUP 部署最小 TiDB 集群（1 TiDB + 1 PD + 3 TiKV）。

要求：
1. 往集群写入 100 万条数据，观察 Region 数量和分布。
2. 新增 1 个 TiKV 节点，观察 PD 日志中调度任务生成、Region Leader 迁移过程；画出迁移前后各 Store 的 Region 数量变化。
3. 模拟一个 TiKV 节点宕机（kill -9）：观察 Raft 自动选举新 Leader、业务是否短暂抖动、恢复后 Region 是否自动回迁。
4. 执行 ADD INDEX 操作，同时在另一终端持续写入；观察 DDL 状态转换过程（SHOW DDL），确认不阻塞写入。
