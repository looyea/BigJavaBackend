# 事务传播与失效场景

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：能用一句话说清七种传播行为的差别并给出各自适用场景；背熟但更理解 `@Transactional` 失效的八大典型场景及其与 AOP 代理机制的因果；会设计"嵌套事务 vs 新事务 vs 提交后回调"的正确姿势。

## 一、回滚规则：先搞清楚"什么异常会回滚"

Spring 声明式事务默认**只对 `RuntimeException`/`Error`（unchecked）回滚**，对**受检异常（checked Exception）不回滚**！这是无数线上"该回滚没回滚"的根源。

```java
@Transactional(rollbackFor = Exception.class)      // 推荐：显式扩大回滚范围
@Transactional(noRollbackFor = BizWarnException.class) // 特定异常不回滚
```

**工程准则**：团队默认给业务方法 `@Transactional(rollbackFor = Exception.class)`，别赌"反正我抛的是运行时异常"。

## 二、七种传播行为（Propagation）

传播行为回答一个问题：**当一个事务方法被另一个事务方法调用时，它该如何加入事务？** 以"外层已有事务"和"外层无事务"两列理解最清晰：

| 传播类型 | 外层有事务时 | 外层无事务时 | 典型用途 |
| --- | --- | --- | --- |
| REQUIRED（默认） | 加入外层事务 | 新建 | 绝大多数业务方法 |
| REQUIRES_NEW | **挂起外层，新开独立事务** | 新建 | 审计日志、操作流水（不受主业务回滚影响） |
| NESTED | 在外层里建**保存点**嵌套 | 新建（同 REQUIRED） | 批量中单条失败可回滚到保存点而不整批回退 |
| SUPPORTS | 加入外层 | 非事务执行 | 可有可无的读 |
| NOT_SUPPORTED | 挂起外层，非事务执行 | 非事务 | 耗时不需事务的操作（别占连接） |
| MANDATORY | 加入外层 | **抛异常** | 强制必须在事务中调用 |
| NEVER | **抛异常** | 非事务 | 绝不允许在事务里调用 |

**三兄弟辨析（高频）**：REQUIRED（同一事务，一荣俱荣一损俱损）、REQUIRES_NEW（独立事务，内外层互不影响提交/回滚）、NESTED（外层可回滚整批，内层失败可只回退到保存点让外层继续）。

```flow
外层 REQUIRED ──调用──> 内层
   REQUIRED      → 合并进同一个事务
   REQUIRES_NEW  → 挂起外层，开新事务（内层独立提交，外层回滚不影响已提交的内层）
   NESTED        → 外层事务内设 savepoint（内层失败回滚到 savepoint，外层可选择继续或整体回滚）
```

## 三、`@Transactional` 失效的八大场景

绝大多数失效其实都是上一条（AOP 代理）机制的直接推论——**增强没被触发**：

1. **方法不是 public**：CGLIB/JDK 只代理 public，注解在非 public 上静默失效。
2. **自调用**：同类 `this.method()` 绕过代理（最常见）。
3. **异常被 try/catch 吞掉**没抛出：事务拦截器看不到异常，照常提交。
4. **抛的是 checked 异常且未配 rollbackFor**：默认不回滚。
5. **Bean 没被 Spring 管理**：new 出来的对象、没 `@Service`/`@Component`，无代理。
6. **数据源/事务管理器没配或配错**：多数据源时 `@Transactional("orderTxManager")` 指错，操作与事务不在同一连接。
7. **引擎不支持事务**：如 MySQL MyISAM 表无事务；或跨库却用的是本地事务（需分布式事务）。
8. **传播行为用错**：如误用 `NOT_SUPPORTED`/`NEVER` 导致以非事务运行。

## 四、事务边界与"提交后才做的事"

经典需求：下单成功后发消息/写缓存/调风控——但这些**必须在事务真正提交之后**才做，否则事务回滚了消息却已发出（脏副作用）。

正确姿势不是把 MQ 调用塞进事务方法，而是：

```java
TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
    @Override public void afterCommit() { mq.send(orderCreatedEvent); } // 提交后回调
});
```

或用 `@TransactionalEventListener(phase = AFTER_COMMIT)` 监听领域事件。REQUIRES_NEW 记录审计日志则保证"主业务回滚，审计仍落库"。

## 五、动手验证

1. 复现 checked 异常不回滚：方法抛 `IOException`（不加 rollbackFor）→ 数据提交；加 `rollbackFor=Exception.class` → 回滚。
2. 复现自调用失效（呼应 s2-1）+ 用注入自身代理修复。
3. 用 `REQUIRES_NEW` 写审计：主业务最终回滚，但审计表记录仍在——直观理解"独立事务"。
4. 把 `afterCommit` 回调里发消息与"事务内直接发"对比：制造回滚，验证前者不发出、后者发出脏消息。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 出异常了数据却没回滚 | checked 异常未 rollbackFor，或异常被吞 |
| 偶发部分方法事务失效 | 自调用 / 非 public / 对象非托管 |
| 主回滚了下游消息却发了 | 副作用没放在 afterCommit |
| 审计日志随主业务一起消失 | 审计没用 REQUIRES_NEW |
| 多数据源下事务"没管住" | 事务管理器与实际操作数据源不匹配 |
| 长事务拖垮连接池 | 事务方法里做 RPC/耗时操作，连接被长期占用 |

## 七、关联技术栈

- **抽象层**：`PlatformTransactionManager`、`TransactionStatus`、`@EnableTransactionManagement`
- **底层依赖**：AOP 代理（s2-1）、`ThreadLocal` 绑定连接（`TransactionSynchronizationManager`）
- **进阶**：`@TransactionalEventListener`、`REQUIRES_NEW`、NESTED 保存点
- **边界外**：跨库/跨服务需分布式事务（Seata、本地消息表、Saga——见分布式系统分区）
- **性能**：事务内不做 RPC/IO，避免长事务占用连接
