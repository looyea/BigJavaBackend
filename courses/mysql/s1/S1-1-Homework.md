# 作业题 · MySQL 体系结构与 SQL 旅程

## 作业 1：造数据与观察执行计划（必做）

创建 100 万行 `t_user(id BIGINT PK AUTO_INCREMENT, name VARCHAR(32), phone VARCHAR(20), age INT, create_time DATETIME)`，然后完成下表：

| SQL | 索引情况 | type | key | rows | Extra | 实测耗时 |
| --- | --- | --- | --- | --- | --- | --- |
| `WHERE name = ?` | 无索引 | | | | | |
| `WHERE name = ?` | `idx_name` | | | | | |
| `WHERE name = ? AND age = ?` | `idx_name_age` | | | | | |
| `WHERE age = ?` | `idx_name_age` | | | | | |
| `SELECT name, age WHERE name = ?` | `idx_name_age` | | | | | |

要求：全部用 `EXPLAIN` 实测填写，并对第 4 行为什么用不上索引给出一句话解释（最左前缀）。

## 作业 2：回表的量化代价（必做）

基于作业 1 的表，对比执行：

1. `SELECT * FROM t_user WHERE name BETWEEN 'u10000' AND 'u11000'`
2. `SELECT id, name FROM t_user WHERE name BETWEEN 'u10000' AND 'u11000'`

用 `SHOW SESSION STATUS LIKE 'Handler_read%'` 与耗时对比，写出覆盖索引带来的 IO 差异结论。

## 作业 3：亲手制造一次主从不一致（必做，理解两阶段提交）

搭建一主一从（Docker Compose 即可），然后：

1. 把主库参数改为 `innodb_flush_log_at_trx_commit=1`、`sync_binlog=100`（或 `innodb_flush_log_at_trx_commit=2`）。
2. 批量写入 1 万行，写入过程中 `kill -9` 主库 mysqld 进程。
3. 重启主库，比对主从行数差异，记录差异条数。
4. 恢复"双一"参数重做实验，说明为什么差异消失（或显著减少）。

**产出**：一段 200 字结论，说明"参数性能优化"与"数据一致性"的取舍边界。

## 作业 4：崩溃恢复日志阅读（必做）

抓取 `kill -9` 后重启时的 error log，找出并解释这几行的含义：

- `Database was not shut down normally!`
- `Starting crash recovery`
- `Read of log segment ... completed` / `Applying a batch of ...`
- `Completed transaction ... in the prepared state`

## 作业 5：Java 端联调（选做）

用 Spring Boot + HikariCP 连接该库，压测 100 并发下的 `SELECT` P99；分别设置 `maximumPoolSize` 为 10 / 30 / 80，观察 MySQL `Threads_running` 曲线，回答："连接池越大越好"为什么是错的？
