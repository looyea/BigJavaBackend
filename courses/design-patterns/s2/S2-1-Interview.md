# 框架里的设计模式 · 实际面试题

## 题 1：Spring AOP 的代理是怎么创建的？为什么自调用会让 @Transactional 失效？

**考察点**：Spring 第一高频题，考的是链路完整度。

**参考答案**：bean 完成初始化后，`AnnotationAwareAspectJAutoProxyCreator`（一个 BPP）在 `postProcessAfterInitialization` 判断它是否命中切面/注解，命中则生成代理：有接口默认 JDK Proxy（`InvocationHandler.invoke` 统一入口），`proxyTargetClass=true`（Boot 默认）走 CGLIB 生成子类覆写非 final 方法。失效原因：事务逻辑织入在**代理对象**的拦截链里，而 `this.other()` 的 this 指向原始目标对象，根本不经过代理——不是"事务传播问题"，是压根没进拦截链。修法按干净度：拆两个 bean（设计正解）> 注入自身代理 `@Lazy self` > `AopContext.currentProxy()`（开 exposeProxy，代码染上框架味）。

**追问**：
- CGLIB 能解决自调用吗？——不能，子类代理同样拦不到父类内部的 this 直调；AspectJ 编译期/加载期织入可以（改写的是目标类字节码本身），这也是 `@Transactional` 少数需要 LTW 的场景。
- 代理对象存在哪个缓存？——就是单例池里的那个 bean，原始对象只活在代理的 target 字段里。

**加分点**：能主动统一解释 @Async/@Cacheable/@Retryable 同根失效，并给出团队 lint 规则（"public 方法互调且带代理注解"扫描）。

## 题 2：为什么需要三级缓存？两级（把代理提前放入 earlySingleton）不行吗？

**考察点**：区分"背流程"与"懂延迟创建"。

**参考答案**：循环依赖 A↔B 时，B 需要的若是 A 的代理，就必须在 A 尚未完成初始化决策前拿到"代理还是原始"的答案。三级缓存存的是 `ObjectFactory`（`() -> getEarlyBeanReference(beanName, mbd, bean)`）——**把"是否提前造代理"的决定推迟到真有人引用它的那一刻**。两级方案要么每次实例化后无条件提前 AOP（没循环依赖的 bean 也被代理提前创建，破坏生命周期语义与性能），要么造出"原始对象进了 B 字段、A 最终却是代理"的身份分裂（单例契约被破坏，事务静默丢）。无代理的简单循环两级确实够，第三级专为 AOP 而存在。

**追问**：
- 构造器循环依赖为什么救不了？——提前暴露发生在实例化**之后**，构造器注入要求对象在构造参数阶段就完整存在，时序上无解——这是语言级限制，改 @Lazy 注入或重新设计（指向 S2-2 的"循环依赖是拆分信号"）。
- `@Async` 的提前暴露为什么直接报错？——Async 处理器无法在 `getEarlyBeanReference` 里安全代理（拦截器链还没就绪），Spring 选择 fail-fast。

**加分点**：能讲出 Boot 2.6+ 默认 `spring.main.allow-circular-references=false` 的立场——框架在用配置表态：循环依赖通常是设计缺陷不是求救命针。

## 题 3：Filter、Interceptor、Aspect 三层都能做鉴权，你怎么决定放哪层？

**考察点**：责任链在真实架构里的选型判断，不是背定义。

**参考答案**：看三件事——需要多粗的信息、需要多细的信息、要复用在哪：Filter 在 Servlet 容器层，能看到原始报文与 Session，适合全局性"业务无关"横切（CORS、编码、黑白名单 IP、认证票据粗筛）；Interceptor 在 MVC 层，能拿到 handlerMethod 与即将渲染的模型，适合"与接口绑定"的鉴权/幂等/审计（`handler.getClass()+method` 直接映射权限点）；Aspect 在方法层，切点是任意 Spring bean 方法，适合业务动作级（数据权限、敏感方法、@Within 自定义注解语义）。判据口诀：跨框架复用→Filter/Interceptor，与接口元数据相关→Interceptor，与业务语义相关→Aspect；同一能力只写一次，下层做上层做不了的细活。

**追问**：
- 网关鉴权都做了，应用内还要 Interceptor 吗？——要：网关是"边界防御"（token 合法性），应用内是"资源语义防御"（这个用户对这个 orderId 有没有权限），职责不同层；只信网关=内网任意服务可伪造越权。

**加分点**：说出 Netty pipeline 与虚拟线程时代对三层模型的影响，或 WebFlux 下 Filter→WebFilter 的映射关系，展示知识面。

## 题 4：MyBatis 插件为什么能改 SQL？写分页插件要注意什么？

**考察点**：是否读过框架源码的"接缝处"。

**参考答案**：`Executor.newExecutor` 末尾会走 `interceptorChain.pluginAll(executor)`——每个插件用 JDK 代理把目标包一层，`Interceptor.intercept(Invocation)` 里可以在 `invocation.proceed()` 前后任意改写 args（`Object[]` 反射数组，SQL、RowBounds、MappedStatement 全在手里）甚至换返回值。写分页插件的三个注意：① count 与 data 两条 SQL 的生成要在改写前拿原始 BoundSql，别被别的插件改过再解析；② 拦截点选择——拦 `Executor#query` 通用但拿不到 Statement 级信息，拦 `StatementHandler#prepare` 能改 SQL 字符串但要自己处理参数映射；③ 多插件叠加顺序=配置逆序包装，调试时先画栈图。

**追问**：
- PageHelper 的 ThreadLocal 分页参数为什么容易"忘清"？——`startPage` 只对紧随其后的第一条查询生效，靠 `page.setOverFlag` 与 finally 清理；中间插了别的查询就错位——这正是"改签名的代理"的脆弱性。

**加分点**：能对比 Hibernate Interceptor/StatementInspector 的同类接缝，说明 ORM 都预留了插件点、差别只在暴露粒度。

## 题 5：你们业务代码里需要写工厂/单例/代理这类模式类吗？框架都做了的话？

**考察点**：反向思考——模式素养的最终形态是"知道什么时候不写"。

**参考答案**：框架消化掉的是"通用样板"：工厂→容器 bean 定义、单例→singleton 作用域、代理→AOP/Feign、模板方法→JdbcTemplate/RestTemplate 家族。业务仍要亲手写的只剩三类：① 框架边界之外的创建收口（第三方 SDK 客户端的缓存工厂、跨多参数的复杂构造）；② 领域内的模式——状态机迁移表、策略注册表这种带业务语义的（框架不知道你的"状态"是什么意思）；③ 性能/正确性关键路径的显式结构（享元池、对象复用），交给框架等于交出不确定性。我的红线：凡容器/AOP 已覆盖的能力，业务代码再写一遍就是"双轨制"，评审直接拦——模式写两遍比不写更糟，因为两份真相必然漂移。

**追问**：怎么判断"框架覆盖不了"？——举证：需要跨 bean 生命周期之外的上下文（非容器管理的对象）、需要编译期类型约束（sealed 层次）、或性能上不接受反射代理的开销（热点路径手写装饰）。

**加分点**：引一句"框架消灭了模式样板，但放大了模式选择错误"——业务策略注册表设计错了，容器只会帮你把错误装配得更稳。
