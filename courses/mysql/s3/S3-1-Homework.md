# 作业题 · binlog、redo、undo 与两阶段提交

> 作业不判分，做完对照参考答案自查。需要一台开了 binlog（ROW 格式）的 MySQL 8.0。

## 作业 1：观察双一与吞吐（必做）

在测试实例上分别配置并压测同一写入脚本：

```sql
-- 例子目的：量化"双一"与放宽后的吞吐差
SET GLOBAL innodb_flush_log_at_trx_commit = 1; SET GLOBAL sync_binlog = 1;   -- 基线：最安全
-- 记录 TPS；再改成 trx_commit=2 / sync_binlog=1000 复测（仅测试环境！）
```

注释对比两组 TPS，并说明为什么金融核心库即便牺牲这点吞吐也必须保持双一（提交即持久、断电不丢）。

## 作业 2：解析 ROW binlog（必做）

制造几条 UPDATE，用 `mysqlbinlog --base64-output=decode-rows -v binlog.000001` 解析，观察 `### UPDATE`、`### WHERE`(前镜像)、`### SET`(后镜像)。

注释说明 ROW 格式为何能精确重放、为何体积大于 STATEMENT。

## 作业 3：STATEMENT 的主从不一致（必做）

`SET SESSION binlog_format=STATEMENT;` 执行一条 `UPDATE t SET c=1 ORDER BY rand() LIMIT 3;`（含不确定函数），在从库/用 binlog 恢复到另一实例，观察结果与主库不同。

再切 ROW 重做，验证一致。注释解释不确定函数为何让 statement 复制危险。

**参考答案要点**：`rand()/NOW()/无序 LIMIT` 在不同实例求值不同 → statement 复制主从算出不同行；ROW 记前后镜像不受影响。

## 作业 4：崩溃恢复体验（选做）

写入一批事务后 `kill -9 mysqld` 再重启，观察错误日志里的 `Recovering ... redo`、`Crash recovery completed`，确认已提交事务都在。

注释说明这正是 WAL + redo 崩溃恢复在起作用；若当时是 `trx_commit=0` 崩在同一时刻会怎样。

## 作业 5：闪回误删（选做）

用 `DROP`/`DELETE` 误删若干行后，基于 ROW binlog 用工具（如 binlog2sql/MyFlash 思路）**生成反向 SQL**（DELETE→INSERT、UPDATE 后镜像→前镜像）恢复。

**参考答案要点**：恢复依赖"双一 + ROW + binlog 保留期足够"，任一缺失都无法精确闪回——呼应本课参数与格式选择。
