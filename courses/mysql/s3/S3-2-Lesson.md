# 主从复制、高可用与冷热备份

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：讲清主从复制的**一条链路三个线程**（主库 binlog dump → 从库 IO 写 relay log → SQL 回放），**异步/半同步/MGR** 三种模式在"丢数据风险 vs 性能"上的取舍；用 **GTID** 替代易错的 binlog file+position 做复制与切换定位；理解**主从延迟**的成因与应对（并行复制、读写分离"刚写完读主"、`Seconds_Behind` 监控）。高可用侧掌握 **MHA / MySQL InnoDB Cluster（MGR + MySQL Shell + Router）**、**故障切换与脑裂防护、防双写**。备份侧分清**冷/热备、逻辑 `mysqldump`/物理 `XtraBackup`**，并能走通 **全量 + binlog 的 PITR 时间点恢复**与 `pt-table-checksum` 数据校验。呼应 s3-1：binlog 在这里既是复制载体又是恢复依据。

## 一、复制链路：一主多从的三个线程（★★★★☆）

```flow
主库                                    从库
 事务提交→写 binlog                       ┌ IO 线程：拉主库 binlog → 写 relay log(中继日志)
   ↑                                     └ SQL 线程：读 relay log → 回放成数据变更
 binlog dump 线程：把 binlog 推给从库 ←──┘
  (还有 用户线程执行事务、以及 8.0 的并行回放 worker 线程)
```

- 主库 **binlog dump 线程**把新 binlog 事件推给每个连它的从库。
- 从库 **IO 线程**接收并落 **relay log**；**SQL 线程**回放 relay log。
- 三态位置：主库 `binlog`（Glog）、从库 `relay log`（Mlog）、从库已回放位点——监控就是盯这几个位点的落差。

## 二、异步 / 半同步 / MGR（★★★★★，取舍核心）

| 模式 | 主库提交是否等从库 | 丢数据风险 | 性能 |
| --- | --- | --- | --- |
| **异步**（默认） | 不等 | 主库宕机可能丢**已提交未复制**的事务 | 最高 |
| **半同步**（lossless / AFTER_SYNC） | 等**至少 1 个从库 ACK 收到 binlog** | 做到"已提交必被至少一从收到"，**不丢**（lossless 半同步） | 略降（多一个网络往返） |
| **MGR / Group Replication** | 多数派认证通过才提交 | 多数派存活即不丢，自动选主 | 依赖共识往返，写放大大 |

> **金融/支付**核心库常用 **lossless 半同步 + 双一**：主库挂也不丢已提交；普通电商读多写少可容忍异步 + 快速故障切换。**MGR 单主模式**是最主流的高可用拓扑（一写多读 + 自动选主）。

## 三、GTID 与并行复制（★★★★☆）

- **GTID** = `server_uuid:transaction_id`，全局唯一、单调。好处：搭建/切换从库不必手算 binlog file+position（易错），`CHANGE MASTER TO MASTER_AUTO_POSITION=1` 自动定位；故障切换、级联、找回跳过的 GTID 都更稳。
- **并行复制**：老版本 SQL 线程单线程回放是延迟主因。MySQL 5.7 按 **库（schema）** 并行，**8.0 默认 `LOGICAL_CLOCK`** 按"主库同一组提交里可并行的事务"并行，`binlog_transaction_dependency_tracking=WRITESET` 进一步放大并行度、显著降延迟。

## 四、主从延迟：成因与工程应对（★★★★★，高频事故）

- 成因：从库单线程/弱并行回放、从库机器更差、大事务、DDL、从库还在被大量读。
- 观测：`SHOW REPLICA STATUS` 的 `Seconds_Behind_Source`（**注意它测的是 IO 而非回放落后的真实时间**，要配合 `pt-heartbeat`）。

```sql
-- 例子目的：读写分离下规避"刚写完读到旧数据"（延迟导致的读己之写不一致）
SHOW REPLICA STATUS\G        -- 看 Seconds_Behind_Source / Retrieved_Gtid_Set 与 Executed_Gtid_Set 差（落差大=延迟，正确监控姿势）
-- 应对策略（工程层，非纯 SQL）：
--   ① 强制"读己之写"：同一会话写后短时间内路由到主库，或写后带 GTID 等从库追到该号再读
--   ② 关键读（支付结果页、对账）直接走主库
--   ③ 缓存层记录"最近写时间戳"，从库读时若落后则回源主库
-- 错误用法：无脑把所有读打到延迟严重的从库 → 用户下单成功却查不到订单（读到旧快照）→ 客诉与重复下单
```

## 五、高可用与故障切换（★★★★☆）

- **MHA**：监控主库，宕机时补齐从库 binlog、选新主、把其它从库指向新主，秒级切换（较传统、需外部工具）。
- **MySQL InnoDB Cluster**：`MGR（组复制）+ MySQL Shell（搭建/管理）+ MySQL Router（读写路由与故障转移）`，官方一体化方案，**自动选主、多数派防脑裂**。
- **防脑裂/防双写**：靠 **多数派（quorum）** 判定存活——网络分区时少数派一侧**自动只读/拒绝写**，绝不允许两个"主"同时接受写（否则数据分叉不可逆）。VIP/路由层也要配合 fencing。

## 六、冷热备份与 PITR 时间点恢复（★★★★★）

- **冷备**：停库后拷数据文件（简单、要停机）。**热备**：运行中备份（InnoDB 支持，`XtraBackup` 典型）。
- **逻辑备份** `mysqldump`：导出 SQL，跨版本/迁移灵活、恢复慢、适合小库。**物理备份** `XtraBackup`：拷数据文件 + redo apply，大库快、同版本。
- **PITR（Point-In-Time Recovery）** = 全量备份 + 重放备份点之后的 **binlog** 到"误操作前一刻"：

```bash
# 例子目的：一次"下午 3 点误删、恢复到 14:59:59"的标准 PITR 流程（呼应 s3-1 ROW binlog）
FLUSH LOGS;                                                   # 先切一个新 binlog 文件（正确：隔离待恢复区间，避免正在写的文件混入误删之后的事件）
mysql -e "SET GLOBAL read_only=1; SET GLOBAL super_read_only=1;"  # 恢复窗口先禁写（错误用法：边恢复边让业务写→数据错乱、恢复失败）
mysql backup_db < full_backup_20260927.sql                     # ① 先还原最近一次全量（mysqldump --master-data=2 --single-transaction 得到，含备份点位）
mysqlbinlog --start-datetime="2026-09-27 00:00:00" \
            --stop-datetime="2026-09-27 14:59:59" \            # ② 只重放到误删"之前一刻"（错误：--stop-never 或时间点填到误删之后→把 DROP/DELETE 也重放，白恢复；时间戳务必用事件真实时间、留缓冲取 14:59:59）
            --database=backup_db binlog.000233 binlog.000234 | mysql backup_db
# 正确使用结果：全量 + 增量 binlog 精确回到 14:59:59 状态；随后校验行数/pt-table-checksum 再放开写
# 错误用法：只靠 mysqldump 全量、没保留 binlog → 只能恢复到"昨晚备份点"，白天数据全丢
```

> **备份三铁律**：① 全量 + **binlog 保留期足够** 才能 PITR；② **定期演练恢复**（没验证过的备份等于没备份）；③ 备份要**异地/异机**，与生产机同生共死的不算备份。

## 七、动手题

1. 搭一主一从（GTID + `MASTER_AUTO_POSITION=1`），主库写崩（大批量事务），从库观察 `Seconds_Behind_Source` 与 `Retrieved/Executed_Gtid_Set` 落差。
2. 开启 lossless 半同步，`kill -9` 主库，验证已提交事务在新主上不丢。
3. 全量 `mysqldump` + 制造一次误删，走一遍 PITR 恢复到误删前，用行数比对验证。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 下单成功但"我的订单"查不到 | 读写分离把读打到延迟从库，读到旧快照 |
| 主库宕机丢最近事务 | 纯异步复制 + 非双一，binlog 未同步到从库 |
| 切换后两个主都能写、数据分叉 | 缺 quorum/ fencing，脑裂双写 |
| 恢复到"昨晚"丢了白天数据 | 只留全量、没保留/没接上 binlog，无法 PITR |
| 从库永远追不上 | 单线程回放 / 大事务 / DDL，需并行复制 + 拆事务 |

## 九、关联技术栈

- **向前**：binlog 三种格式、双一、2PC ↔ s3-1；缩短事务/大事务 ↔ s2-2
- **横向**：缓存与库一致性常靠订阅 binlog（Canal）↔ redis s2-2；在线 DDL 影子表 ↔ s2-2
- **运维**：容器/编排里的 DB 主从、备份编排与告警 ↔ 构建运维；数据脱敏备份 ↔ 数据安全

## 十、本节小结

主从复制 = **binlog dump → IO 写 relay log → SQL 回放**，模式上 **异步快但可能丢、lossless 半同步不丢略慢、MGR 多数派自动选主**；**GTID** 让搭建与切换告别 file+position，**8.0 并行复制（LOGICAL_CLOCK/WRITESET）** 治延迟。**主从延迟**引发"读不到刚写的自己"，用"读己之写走主 / 带 GTID 等待 / 关键读走主"规避。高可用靠 **MHA / InnoDB Cluster**，用 **quorum 防脑裂双写**。备份分 **冷/热、逻辑 mysqldump / 物理 XtraBackup**，**全量 + binlog 的 PITR** 才能恢复到误操作前一刻——牢记"**演练过的、异地留存的、配足 binlog 的**"才算真备份。下一节慢查询治理与 SQL 优化实战。
