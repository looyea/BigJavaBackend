# 实际面试题 · AOP 与动态代理

## 题 1：Spring AOP 的实现原理？和 AspectJ 有何不同？

**考察层次**：初级答"动态代理"；中级能讲 JDK/CGLIB 选择与拦截器链；高级能对比织入时机与能力边界。

**参考答法**：

1. Spring AOP 本质是代理模式：容器返回目标 Bean 的代理，方法调用先过拦截器链（事务、日志等 around），再到目标方法；是**运行期织入**，只增强 Spring 管理的 Bean、只支持方法级 joinpoint。
2. 代理两种：目标有接口默认 JDK 动态代理（`Proxy`+`InvocationHandler`），Boot 实际默认 `proxyTargetClass=true` 用 CGLIB 生成子类。
3. AspectJ 是编译期/类加载期**字节码织入**，能增强字段、构造器、静态方法、非托管对象，能力强但要额外工具链。
4. 选型：一般企业应用 Spring AOP 足够；需要极致织入能力才上 AspectJ。

**追问**：CGLIB 和 JDK 代理注入时有何差异？→ JDK 代理只能按接口类型注入；CGLIB 是子类，可按实现类注入。

## 题 2：同一个类里 A 方法调 B 方法，B 的 @Transactional 为什么不生效？

**答题要点**：增强长在代理对象上，内部 `this.B()` 调的是目标对象自身、绕过了代理，所以事务/缓存等通知不触发。解法：① 拆到另一个 Bean；② 注入自身代理 `@Lazy self`；③ `AopContext.currentProxy()`（开 exposeProxy）；④ 换 AspectJ。首选拆类，既解决失效又改善职责划分。

## 题 3：多个切面的执行顺序怎么定？

**答题要点**：洋葱模型——进入时按 `@Order`/`Ordered` 值从小到大，退出时相反；值越小越外层。同一切面内不同通知有固定序（Around-before→方法→Around-after/Around 内含）。事务切面顺序很关键，自定义切面包在事务内外语义不同，需显式 `@Order` 约定，避免"缓存写在事务提交前读到旧数据"这类问题。

## 题 4：`@Around` 里要注意什么？

**答题要点**：

- 必须调用 `proceed()`（可带参）才会执行目标；不调用＝拦截掉业务逻辑。
- 别吞异常：`try/catch` 后不 rethrow 会破坏事务回滚（事务靠异常触发 rollback）。
- 慎改返回值/参数；proceed 前后逻辑放对位置（如计时、结果脱敏）。
- 条件 `proceed`（重试、降级）是合法高级用法，但要清楚它对下游通知的影响。

## 高频追问速答

1. 静态代理 vs 动态代理？→ 静态代理手写包装类、编译期确定；动态代理运行期生成（JDK/CGLIB），一套代理逻辑服务大量类。
2. 为什么 final 方法不能被增强？→ CGLIB 靠方法覆盖（继承），final 无法 override；JDK 代理是接口方法，不涉及。
3. `@Transactional` 是哪种通知？→ `@Around` 型的事务拦截器（`TransactionInterceptor`），据异常决定 commit/rollback。
4. AOP 代理是在 Bean 生命周期哪一步生成的？→ `BeanPostProcessor.postProcessAfterInitialization`（`AutoProxyCreator`），呼应三级缓存提前暴露。
5. 一个 Bean 上多个切面 + 事务，会不会生成多层代理？→ 通常同一个代理对象串起一条拦截器链，不是层层嵌套多个对象。
