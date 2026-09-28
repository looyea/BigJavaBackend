# AT 模式与全局锁 · 小测

### 1. Seata AT 模式中 TM 的职责是？（6分）

- A. 执行本地 SQL
- B. 定义全局事务边界，发起 begin/commit/rollback
- C. 存储 undo_log
- D. 管理数据库连接池

> 答案：B
> 解析：TM = Transaction Manager，通过 @GlobalTransactional 标注入口，协调 TC。

### 2. AT 模式一阶段做了什么？（6分）

- A. 只执行 SQL 不写 undo
- B. 执行业务 SQL + 写 undo_log + 本地事务 commit
- C. 等 TC 指令再提交
- D. 加全局锁后挂起

> 答案：B
> 解析：一阶段快速释放本地锁，同时记录 undo 以备回滚。

### 3. 全局锁的粒度是？（6分）

- A. 表级
- B. 数据库级
- C. 行级（按主键）
- D. 字段级

> 答案：C
> 解析：TC 的 lock_table 按 resource_id + table_name + PK 记录锁，粒度到具体行。

### 4. AT 模式默认隔离级别等价于？（6分）

- A. 可重复读
- B. 串行化
- C. 读未提交
- D. 读已提交

> 答案：C
> 解析：一阶段本地 commit 后数据对外可见（InnoDB），全局锁只防写冲突不防脏读。

### 5. undo_log 表的作用是什么？（6分）

- A. 记录 SQL 执行计划
- B. 存储 before/after image，二阶段回滚时使用
- C. 审计日志
- D. 全局锁表

> 答案：B
> 解析：回滚时 RM 读 undo_log 中的 before image 做反向 SQL。

### 6. 全局事务成功提交后，undo_log 如何处理？（6分）

- A. 永久保留
- B. TC 异步通知 RM 删除 undo_log
- C. 转为 redo
- D. 由 DBA 手动清理

> 答案：B
> 解析：成功后 undo 无用 → TC 发 branchCommit → RM 删对应 undo_log → 释放空间。

### 7. 以下哪种操作会绕过全局锁导致脏写？（6分）

- A. 通过 @GlobalTransactional 方法修改
- B. 直接 JDBC 执行 UPDATE 不接入 Seata
- C. 使用 @GlobalLock + SELECT FOR UPDATE
- D. Feign 调用经过 Seata 代理的数据源

> 答案：B
> 解析：非 Seata 代理的本地事务不向 TC 上报 → 不检查全局锁 → 可修改正被其他全局事务锁定的行。

### 8. AT 模式使用限制包括（多选）？（9分）

- A. 表必须有主键
- B. 不支持无 WHERE 的全表 UPDATE
- C. 不支持 DDL 回滚
- D. 只能 MySQL

> 答案：A、B、C
> 解析：D 错——AT 也支持 PostgreSQL/Oracle/MariaDB。

### 9. Seata TC 集群的存储模式有哪些？（多选）（9分）

- A. file（单机）
- B. db（生产推荐）
- C. redis
- D. zookeeper

> 答案：A、B、C
> 解析：D 非 TC 存储选项；file 仅测试，db 共享事务状态。

### 10. 简答题：描述 AT 模式从发起全局事务到成功提交的完整流程，以及异常回滚路径。（40分）

- 要点1：TM 发起 → TC 分配 XID → 传递给各 RM
- 要点2：RM 执行业务 SQL → 拦截器查 before image → 执行 → after image → 写 undo_log → 上报 branch → 本地 commit → TC 注册全局锁
- 要点3：全部 branch 成功 → TC 改状态 COMMITTED → 异步通知各 RM 删 undo_log
- 要点4：任一 branch 失败 → TM 调 rollback → TC 通知各 RM → RM 根据 undo_log before image 反向 UPDATE/DELETE → 释放全局锁
- 要点5：全局锁冲突时 RM 自旋重试（lockRetryInterval × times）→ 超时则标记失败

> 答案：见要点
> 解析：理解完整流程有助于排查"undo_log 膨胀""全局锁等待"等生产问题。
