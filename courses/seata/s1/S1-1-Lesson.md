# AT 模式与全局锁

> 本节难度：★★★★★
> 重要程度：★★★★★
> 学习产出：理解 Seata AT 模式的 undo_log 机制、全局锁防脏写原理及与本地事务的边界关系。

## 一、AT 模式整体流程

```text
TM(@GlobalTransactional) → TC(Seata Server) ← 协调
RM(Branch)：每个数据源一阶段本地提交 + 二阶段异步删 undo/补偿回滚
```

```text
1. TM 开全局事务 → TC 分配 XID
2. RM 执行本地事务前：
   - before image（查询 SQL 影响的行快照）
   - 执行业务 SQL
   - after image（修改后快照）
   - 写 undo_log 到同库 → 本地事务 commit
3. 全部 Branch 成功 → TC 通知各 RM 删 undo_log（快速释放）
4. 任一 Branch 失败 → TC 通知 RM 用 undo_log 反向补偿回滚
```

## 二、全局锁

```java
// 目的：AT 模式一阶段提交后，二阶段回滚前，防止其他全局事务修改同一行
// TC 侧：RM 上报修改的 PK → TC 判断是否有全局锁冲突
// 若冲突 → RM 自旋重试（默认 10 次 × 10ms）→ 超时则整事务回滚
@GlobalTransactional
public void createOrder() {
    orderClient.create(order);  // 结果：INSERT t_order(id=1) → 全局锁锁住 t_order:1
    accountClient.debit(100);   // 说明：若另一事务正在改 t_account(id=2) → 需排队
    storageClient.deduct(1);    // 输出：t_storage(id=1) 全局锁 t_storage:1
}
// 错误用法：不走 Seata 的本地事务直接 UPDATE t_order WHERE id=1 → 绕过全局锁 → 脏写
```

**脏写防护**：同一行被两个全局事务交叉修改时，后提交者拿不到全局锁 → 等待 → 避免不一致。

## 三、undo_log 表结构

```sql
-- 目的：每个参与 AT 的库都建 undo_log 表
CREATE TABLE undo_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,     -- 说明：分支事务 ID
  xid VARCHAR(128) NOT NULL,     -- 输出：全局事务 ID
  context VARCHAR(128) NOT NULL, -- serializer + undo 类型
  rollback_log LONGBLOB NOT NULL, -- 结果：before/after image JSON
  log_state TINYINT NOT NULL,     -- 0=正常, 1=全局完成待清理
  gmt_create DATETIME(3),
  gmt_modified DATETIME(3),
  UNIQUE INDEX ux_branch_id(xid, branch_id)
);
-- 错误用法：漏建 undo_log 表 → 一阶段写 undo 失败 → 报 Cannot write undo_log
```

## 四、一阶段提交 vs 传统 2PC

| 维度 | AT 一阶段 | MySQL 2PC prepare |
|------|-----------|-------------------|
| 锁持有 | 本地提交后释放行锁 | prepare 后仍持 InnoDB 锁 |
| 资源占用 | 低（undo 异步清理） | 高（同步等二阶段） |
| 隔离级别 | 读未提交（默认）+ 全局锁防写 | 可重复读 |

## 五、隔离级别问题

AT 默认 **读未提交**：全局事务 A 的本地已提交数据，事务 B 可直接读到（因 InnoDB 已 commit）。

```java
// 目的：全局锁只防"写冲突"，不防"脏读"
// 需要隔离 → 用 SELECT FOR UPDATE 走全局锁
@GlobalTransactional
public void transfer() {
    // 说明：localLock 方式让后续读排队——Seata 提供 @GlobalLock + SELECT FOR UPDATE
    Account a = accountRepo.selectForUpdateWithGlobalLock(id);  // 结果：拿全局锁再读
    // 输出：读到的一定是已提交且未被其他全局事务修改的值
}
```

## 六、Seata Server（TC）高可用

```text
TC 集群：3 节点注册到 Nacos，RM/TM 长连接随机选 TC 节点
TC 无状态（事务日志在 DB：global_table / branch_table / lock_table）
存储模式：db（生产）/ file（单机测试）/ redis（实验）
```

## 七、关联技术

- 业务表必须主键（全局锁按 PK 粒度锁）。
- 不支持无 WHERE 的批量 UPDATE（before image 太大）。
- 与 MQ 最终一致互补：强一致→AT，允许秒级延迟→MQ 事件驱动。
