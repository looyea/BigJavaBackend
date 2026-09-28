# TCC / Saga / XA 与模式选型

> 本节难度：★★★★★
> 本节重要性：★★★★☆
> 学习产出：掌握 Seata TCC/Saga/XA 三种模式的机制与适用场景，能根据一致性要求和业务特征选择事务模式。

## 一、TCC（Try-Confirm-Cancel）

```text
Try：预留资源（冻结金额/锁定库存），不真正提交
Confirm：真实执行（扣减冻结→可用）——幂等
Cancel：释放预留（解冻）——幂等 + 空回滚 + 悬挂控制
```

```java
// 目的：账户冻结——TCC Try 阶段
@TwoPhaseBusinessAction(name = "freezeAccount",   // 目的：声明 TCC 参与者及二阶段方法绑定
    commitMethod = "confirm", rollbackMethod = "cancel")
public boolean tryFreeze(BusinessActionContext ctx,
    @BusinessActionContextParameter(paramName = "acctId") Long acctId,
    @BusinessActionContextParameter(paramName = "amt") BigDecimal amt) {
    // 说明：只增加 frozen 字段，可用余额不变
    accountMapper.freeze(acctId, amt);  // 结果：balance 不变, frozen += amt
    return true;                        // 输出：Try 成功，TC 据此决定进入 Confirm 阶段
}
public boolean confirm(BusinessActionContext ctx) {   // 说明：全部分支 Try 成功后 TC 才会调到此处
    Long id = (Long) ctx.getActionContext("acctId").get();
    BigDecimal amt = (BigDecimal) ctx.getActionContext("amt").get();
    accountMapper.deductFrozen(id, amt);  // 输出：真正扣减（frozen → 已使用）
    return true;
}
public boolean cancel(BusinessActionContext ctx) {
    // 错误用法：cancel 中未判空（空回滚场景 Try 都没执行过）→ NPE
    Long id = (Long) ctx.getActionContext("acctId").get();
    BigDecimal amt = (BigDecimal) ctx.getActionContext("amt").get();
    if (id == null) return true;  // 说明：空回滚——Try 未成功直接返回 true
    accountMapper.unfreeze(id, amt);  // 结果：解冻恢复可用余额
    return true;
}
```

**三大坑**：空回滚（Try 超时未收到 → Cancel 先到）、悬挂（Cancel 先到 → Try 后到）、幂等（Confirm/Cancel 可能重复调用）。

## 二、Saga（长事务编排）

```text
正向：T1 → T2 → T3（每步本地提交 + 发布事件）
补偿：若 T3 失败 → C2 → C1（逆序执行已步骤的补偿动作）
```

```java
// 目的：Saga 状态机定义（JSON/注解方式）
@SagaService
public class OrderSaga {
    @SagaCompensable(compensationMethod = "cancelOrder")   // 目的：绑定补偿方法，失败时逆序执行
    public void createOrder(SagaContext ctx) {
        orderRepo.save(ctx.get(OrderDTO.class));  // 结果：本地 INSERT
    }
    public void cancelOrder(SagaContext ctx) {
        orderRepo.delete(ctx.getOrderId());       // 输出：补偿删除
    }
}
// 错误用法：补偿方法不是幂等 → Saga 引擎重试补偿 → 数据多删
```

**特点**：无全局锁、每步立即提交（最终一致）、适合跨多服务长流程。

## 三、XA（强一致 2PC）

```text
XA：利用数据库原生 2PC（prepare/commit），全局强一致
代价：prepare 后锁资源直到全局 commit → 吞吐低
```

```java
// 目的：@GlobalTransactional + Seata XA 模式数据源
spring:
  datasource:
    seata:
      enable: true
      client:
        support-datasource-type: xa  # 结果：使用 XADataSource 而非普通 DataSource
# 说明：TM 发起 → RM 用 xa_start → 业务 SQL → xa_end → TC 统一 xa_commit/xa_rollback
```

适用：对一致性要求极高且并发量可控（如日终清算）。

## 四、四模式对比

| 维度 | AT | TCC | Saga | XA |
|------|----|----|------|----|
| 一致性 | 最终 | 最终 | 最终 | 强 |
| 侵入 | 无 | 高 | 中 | 无 |
| 性能 | 中（全局锁） | 高（无全局锁） | 高（异步） | 低（2PC） |
| 回滚 | 自动 | 手写 Cancel | 手写补偿 | 自动 |
| 场景 | 内部 CRUD | 资金/资源预留 | 跨服务长流程 | 金融强一致 |

## 五、选型决策

1. **表少 + 并发中 + 快速接入** → AT。
2. **资金冻结/库存预留** → TCC（资源预留语义天然）。
3. **跨 10+ 服务 + 允许分钟级延迟** → Saga。
4. **同库多表 + 合规要求强一致** → XA。

## 六、关联技术

- TCC 与 AT 可在同一全局事务中混合。
- Saga 与 MQ 事件驱动互补（每步发布领域事件）。
- XA 在 MySQL 中依赖 InnoDB prepare（crash recovery 靠 binlog）。
