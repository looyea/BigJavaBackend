# 小测验 · 事务传播与失效场景

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. `@Transactional` 默认对哪类异常回滚？（20分）

- A. 所有 Throwable
- B. 仅 RuntimeException 与 Error（unchecked），checked 异常默认不回滚
- C. 仅 checked 异常
- D. 都不回滚

> 答案：B
> 解析：默认只对 unchecked 回滚；要覆盖 checked 需显式 `rollbackFor = Exception.class`。

### 2. 希望"主业务回滚但审计日志仍保留"，审计方法应用什么传播行为？（20分）

- A. REQUIRED
- B. REQUIRES_NEW
- C. NESTED
- D. SUPPORTS

> 答案：B
> 解析：REQUIRES_NEW 挂起外层开独立事务，内层提交不受外层回滚影响。

### 3.（多选）下列哪些会导致 `@Transactional` 失效？（25分）

- A. 方法声明为 private/protected（非 public）
- B. 同类内部 `this.method()` 自调用
- C. 异常被 try/catch 吞掉未抛出
- D. 抛了 checked 异常且未配 rollbackFor

> 答案：ABCD
> 解析：四者都会——前三使增强未被触发或看不到异常，D 是默认回滚规则不含 checked。

### 4. REQUIRED 与 NESTED 的关键差别是？（15分）

- A. 没有差别
- B. REQUIRED 合并为同一事务整体回滚；NESTED 在外层事务内建保存点，内层失败可只回退到保存点
- C. NESTED 总是新开独立事务
- D. REQUIRED 会挂起外层

> 答案：B
> 解析：NESTED 靠 savepoint 支持"部分回滚后外层仍可选择继续"，REQUIRED 是一荣俱荣一损俱损。

### 5. 下单成功后发 MQ 消息，为避免"事务回滚但消息已发出"，正确做法是？（20分）

- A. 在事务方法里直接 send
- B. 用 `afterCommit` 回调或 `@TransactionalEventListener(AFTER_COMMIT)` 在提交后发
- C. 先发消息再开事务
- D. 用 NOT_SUPPORTED

> 答案：B
> 解析：副作用必须挂在事务提交之后触发，否则回滚会产生脏副作用。
