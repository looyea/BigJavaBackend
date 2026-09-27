# 课后作业：MVCC 与 VACUUM 机制

## 作业 1：膨胀诊断与 autovacuum 调优（35分）

环境：一张 5000 万行的 orders 表，日均 UPDATE 200 万次（仅修改 status 列，status 不在索引中）。

要求：
1. 用 pg_stat_user_tables 查询当前死元组数量和比例，判断 autovacuum 是否跟得上。
2. 为该表设置合理的 autovacuum 参数（scale_factor、threshold、cost_delay、cost_limit），说明每个值的理由。
3. 计算：如果 status 列不在索引中且 fillfactor=85，预估 HOT 命中率是多少？如何从 pg_stat_user_tables 中验证？
4. 如果发现 n_dead_tup 持续增长且 last_autovacuum 为 NULL，列出你的排查步骤（检查长事务、检查 prepared transaction、检查 autovacuum 是否被禁用）。

## 作业 2：XID 回卷风险处置（30分）

场景：某库 age(datfrozenxid) = 18 亿，接近 21 亿上限。

要求：
1. 解释为什么 XID 回卷会导致数据"消失"，用图示或文字说明比较逻辑失效过程。
2. 给出紧急处理方案：对哪些对象执行 VACUUM FREEZE？按什么顺序？如何避免锁表？
3. 设计长期防护策略：autovacuum_freeze_max_age、vacuum_freeze_table_age、nominage 参数如何配置？
4. 编写一段 SQL 巡检脚本，按 age 降序列出所有表和索引，age > 10 亿的标红。

## 作业 3：MVCC 可见性实验（35分）

环境：本地 Docker 启动 PostgreSQL 16。

要求：
1. 建表插入 3 行数据，开两个终端模拟并发：事务 A UPDATE id=1 未提交时，事务 B SELECT id=1 看到什么？xmin/xmax 各是多少？
2. 事务 A 提交后，事务 B 再次 SELECT（READ COMMITTED）结果如何变化？如果是 REPEATABLE READ 呢？
3. 用 pgstattuple 扩展查看 UPDATE 前后的表空洞率变化；执行 VACUUM 后空洞率如何变化？
4. 写实验报告：记录每步的 ctid 变化，证明 PG 的 UPDATE = 标记旧行 + 插入新行。
