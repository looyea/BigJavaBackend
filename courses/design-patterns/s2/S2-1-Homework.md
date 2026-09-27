# 框架里的设计模式 · 作业题

> 本节作业 3 题：手写一次迷你 AOP、拆一次 MyBatis 插件栈、实现一个真正的扩展点。

## 作业 1：手写代理工厂并复现自调用失效（动手）

不用 Spring，仅用 JDK 动态代理：

1. 定义 `OrderService` 接口与实现，`create()` 内部 `this.audit()`；实现 `TxHandler implements InvocationHandler`，对带 `@MyTx` 注解的方法打印 begin/commit；
2. 通过代理调用 `create()`：观察到 audit 没有独立事务日志（因为 `this.audit()` 目标是裸对象）——失效现场成立；
3. 三种修法各改一遍并对比：把 audit 挪到第二个 bean、给 service 注入 `self` 代理字段、invoke 里把 target 方法调用改为经代理（体会"框架为什么做不到全自动"）；
4. 输出结论：CGLIB 能救这种情况吗？（提示：子类代理同样管不了 this 直调——写进答案。）

**验收标准**：失效与三种修复的日志对照；一段 50 字的"代理型注解失效统一原理"总结（要能同时解释 @Async/@Cacheable）。

## 作业 2：给 MyBatis 写一个插件并观察装饰器栈（动手）

1. 实现一个 `Interceptor` 拦截 `StatementHandler#prepare`，打印 SQL 与执行耗时；`@Intercepts/@Signature` 四件套配齐并注册；
2. 在 `ExecutorType.CACHE` 环境下打断点/日志，记录一个查询实际经过的对象包装顺序（CachingExecutor → BaseExecutor → 你的插件代理层），画出"谁包谁"的栈图；
3. 再加第二个也拦截 `prepare` 的插件（模拟多方言改写），人为制造参数冲突，复现"后插件拿到被前插件改过的 args"现象，总结插件叠加的排查口诀；
4. 对照阅读 PageHelper 源码里 `page` 参数塞进 `MappedStatement` 的位置，验证"改签名"论断。

**验收标准**：栈图 + 冲突复现日志 + 三句排查口诀（按"注册顺序逆序看包装"这类可执行规则写）。

## 作业 3：用 BeanPostProcessor 实现一个字段脱敏扩展点（设计+动手）

需求：所有标了 `@Sensitive` 的 String 字段，日志打印对象时自动打码——做成组件级能力而非每个 toString 手写。

1. 方案 A：BPP 为含 `@Sensitive` 字段的 bean 生成代理，重写 `toString`；方案 B：注册一个 Jackson `BeanSerializerModifier`；方案 C：`@Aspect` 切所有 getter；
2. 三方案各实现或写出关键代码，从"侵入面/性能/与 final 类协作/维护成本"四维打分选一个落地；
3. 落地版要过两个坑：被代理 bean 同时是 AOP 代理时的双层包装顺序；配置类 bean（@Configuration）被额外代理导致的 CGLIB 冲突。

**交付物**：选型对比表 + 最终实现 + 两个坑的测试用例。

**提示**：这题真正的考点是"扩展点选型"——BPP 改变的是 bean 身份，序列化钩子改变的是输出表现，Aspect 改变的是调用路径；先想清楚要改哪一层。
