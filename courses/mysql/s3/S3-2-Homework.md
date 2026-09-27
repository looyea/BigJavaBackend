# 作业题 · 主从复制、高可用与冷热备份

> 作业不判分，做完对照参考答案自查。建议用两台 MySQL 8.0（或 docker 双实例）。

## 作业 1：GTID 主从搭建（必做）

主从都开 `gtid_mode=ON`、`enforce_gtid_consistency=ON`，从库用 `CHANGE REPLICATION SOURCE TO ... SOURCE_AUTO_POSITION=1` 接上主库。主库批量写入，从库观察 `SHOW REPLICA STATUS\G` 的 `Seconds_Behind_Source`、`Retrieved_Gtid_Set` 与 `Executed_Gtid_Set` 落差。

注释说明：为什么 GTID 免去手算 file+position；落差代表什么。

## 作业 2：主从延迟下的"读不到自己"（必做）

制造延迟（从库跑一个大 `SLEEP` 事务占住回放），随后主库插入一条订单，立刻用"读走从库"的应用逻辑查询，复现"下单成功却查不到"。

再实现"读己之写"修复：写后同一会话短期内强制走主库。注释对比两种结果。

## 作业 3：lossless 半同步不丢事务（选做）

主从装半同步插件、`rpl_semi_sync_master_wait_point=AFTER_SYNC`，主库提交后立刻 `kill -9`，在新主上验证最后一条已返回成功的 INSERT **仍在**。

**参考答案要点**：AFTER_SYNC（lossless）在"从库 ACK 收到 binlog 后才返回客户端提交成功"，故返回成功的事务至少已在一个从库留存。

## 作业 4：PITR 时间点恢复演练（必做）

全量 `mysqldump --single-transaction --master-data=2` → 之后制造一批正常写入 + 一次 `DELETE` 误删 → 用 `mysqlbinlog --start/stop-datetime` 只重放到误删前一刻恢复 → 行数比对校验。

注释记录每一步命令与"为什么 stop 时间要卡在误删之前、不能用 --stop-never"。

## 作业 5：数据校验与备份三铁律（选做）

用 `pt-table-checksum` 校验主从一致性，制造一处不一致（直接在从库改数据）观察报警。

注释复述备份三铁律（全量+足够 binlog、定期演练、异地留存），并说明"演练"为何不可省。

**参考答案要点**：未经恢复验证的备份等于没有备份；从库被人为改动会破坏一致性且暴露"绕过主库写从库"的管理漏洞。
