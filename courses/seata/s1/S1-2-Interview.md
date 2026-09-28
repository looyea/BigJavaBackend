# TCC / Saga / XA 与模式选型 · 面试题

## 题 1：TCC 中"悬挂"问题如何解决？

```java
// 目的：Cancel 先到 Try 后到 → Try 不应再执行（资源已释放）
// 方案：在 Cancel 中写入"已回滚"标记（tcc_action_log status=CANCELED）
// Try 开始前检查：若 status=CANCELED → 跳过 Try → 返回 true（防悬挂）
public boolean tryFreeze(BusinessActionContext ctx) {
    String xid = ctx.getXid();
    if (actionLogRepo.isCanceled(xid, ctx.getBranchId())) {
        return false;  // 结果：已被 Cancel → 悬挂防护生效
    }
    // 正常冻结逻辑...
}
// 错误用法：只做空回滚不做悬挂检查 → 后到的 Try 再次冻结资源 → 再无人 Confirm/Cancel，资金永久冻结
```

## 题 2：Saga 和 TCC 都是补偿，区别在哪？

| 维度 | TCC | Saga |
|------|-----|------|
| 资源隔离 | Try 预留（其他事务看不到预留量） | 无隔离（每步直接提交） |
| 并发安全 | 高（资源已冻结） | 低（可能读到中间态） |
| 侵入 | 3 个方法/接口 | 正向 + 补偿方法 |
| 适用 | 资源有限需预留 | 步骤多无冲突/允许短暂不一致 |

## 题 3：XA 模式 crash recovery 靠什么？

InnoDB prepare 事务写入 redo log + binlog。MySQL 重启后扫描 binlog 中 prepare 但未 commit 的事务 → 向 TC 询问状态 → commit 或 rollback。Seata TC 需持久化 XA 状态（DB 模式）。

## 题 4：四模式中哪些支持"混合"？

- AT + TCC + Saga 可在同一 `@GlobalTransactional` 下混合（每个分支各自选模式）。
- XA 通常单独使用（强一致语义与最终一致混合有冲突风险）。

## 题 5：为什么 TCC 不直接扣款而要冻结？

```text
冻结 = 资源预留，不改变"可用余额"语义。
若 Try 直接扣 → 后续其他步骤失败需 Cancel → Cancel 要把余额加回 → 中间态被读到余额虚低。
冻结方案：Try 只加 frozen，可用不变 → Cancel 减 frozen → 对外无感知。
错误用法：Try 直接扣 balance → 被其他全局事务读到余额减少 → 影响并发决策。
```

## 题 6：选型口诀？

> "能 AT 不 TCC，能 TCC 不 Saga，能最终不 XA。"

- 内部 CRUD 且并发可控 → AT。
- 资金/库存需预留 → TCC。
- 跨多服务长流程 → Saga。
- 合规要求强一致 → XA。
