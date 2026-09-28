# AT 模式与全局锁 · 作业

## 作业 1：AT 基本流程验证

**目标**：搭建 Seata Server + 两个微服务，验证全局回滚。

1. Docker 启动 seata-server（db 模式），建 global_table/branch_table/lock_table。
2. order-service 和 account-service 各配 `@GlobalTransactional` 下单+扣款。
3. 两库各建 undo_log 表。
4. 正常下单：undo_log 先写后删；全局锁在 TC lock_table 可见。
5. 人为让扣款抛异常 → 观察 order INSERT 被 undo_log 回滚。

## 作业 2：全局锁冲突模拟

**目标**：两个并发全局事务修改同一行。

1. 事务 A：`@GlobalTransactional` 扣 account(id=1) 余额 100。
2. 事务 B（并发发起）：`@GlobalTransactional` 扣同一账户 50。
3. 观察 B 的 lock 等待日志；若超时 → B 全局回滚。
4. 分析 lock_table 中的竞争记录。

## 作业 3：绕过全局锁的脏写复现

**目标**：验证"非 Seata 连接的直接 UPDATE"导致脏写。

1. 事务 A（Seata）修改 t_order(id=1) status=PAID → 持全局锁。
2. 用原生 JDBC（不经 Seata 代理）直接 `UPDATE t_order SET status=CANCEL WHERE id=1`。
3. 结果：脏写成功 → A 回滚时 undo 的 before image 已不匹配 → 数据不一致。
4. 结论：所有写操作必须经 Seata 数据源代理。
