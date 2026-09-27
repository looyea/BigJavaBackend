# 作业题 · AOP 与动态代理

## 作业 1：眼见为实——确认拿到的是代理（必做）

对一个加了任意 `@Transactional`（或自定义切面）的 Service：

- 在启动完成后 ` applicationContext.getBean(...).getClass().getName()` 打印
- 分别在全默认（CGLIB）与 `@EnableAspectJAutoProxy(proxyTargetClass=false)`（JDK 代理）下观察类名（`$$SpringCGLIB$$0` vs `$Proxy`）

**产出**：说明两种代理下"按接口注入"和"按实现类注入"分别会不会成功。

## 作业 2：复现并修复自调用失效（必做，本节核心）

写 `OrderService.create()` 内部 `this.pay()`，`pay()` 上加 `@Transactional` 且抛运行时异常：

1. 从外部调 `create()`，验证 `pay()` 的回滚**不生效**（数据没回滚）
2. 依次用三种方案修复并各自验证回滚生效：① 拆到 `PayService` 注入调用；② `@Lazy` 注入 self；③ `AopContext.currentProxy()`（开 exposeProxy）
3. 写结论：为什么"经代理进来"才有增强

**验收标准**：修复前后数据库状态对比截图/日志各一份。

## 作业 3：切面执行顺序（洋葱模型）实验（必做）

写两个 `@Aspect`，都含 `@Around`，各在进入/退出打 `A-in/A-out`、`B-in/B-out` 日志：

- 默认顺序下观察输出嵌套关系
- 用 `@Order` 交换顺序，确认 `@Order` 值小者在外层
- 再叠加事务切面，讨论如何保证自定义切面在事务"内层/外层"的语义

## 作业 4：final 与私有方法的代理边界（选做，架构师向）

构造三种目标：`final` 类、含 `final` 方法、`private` 方法，分别加 `@Transactional`/自定义切面，记录哪些被增强、哪些静默失效，据此给团队制定"可被 AOP 增强的方法书写规范"。

## 作业 5：AOP 还是 AspectJ？（选做，架构师向）

为一个"需要对大量非 Spring 管理对象/构造后自调用也要织入"的领域模型，评估 Spring AOP（代理）与 AspectJ（编译/加载期织入）的成本收益，给出选型建议与迁移风险，并说明为什么不轻易为绕自调用就全面上 AspectJ。
