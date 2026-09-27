# 框架里的设计模式 · 小测验

> 全卷 100 分：单选 5×10 + 多选 2×10 + 判断 1×5 + 简答 15+10。达到 60 分解锁下一节。

### 1. Spring AOP 代理对象的创建发生在 bean 生命周期的哪一站？（10分）

- A. 实例化（createBeanInstance）时
- B. 初始化后处理（postProcessAfterInitialization，由 AutoProxyCreator 这个 BeanPostProcessor 完成）
- C. 属性填充时
- D. 第一次被调用时

> 答案：B
> 解析：目标 bean 先完整初始化，再由 BPP 判断是否命中切面并返回代理替身——所以容器里流出的一直是代理。

### 2. `@Transactional` 自调用失效的根本原因是（10分）

- A. 事务传播配置错误
- B. this.other() 直接调目标对象方法, 绕过了代理对象这层拦截
- C. Spring 不支持同类事务
- D. 数据库隔离级别限制

> 答案：B
> 解析：注解靠代理生效；自调用没有经过代理。修法：拆 bean / 注入自身代理 / AopContext.currentProxy()。

### 3. MyBatis 插件（Interceptor）能做到的、普通装饰器通常不做的是（10分）

- A. 记录 SQL 耗时
- B. 通过反射代理修改被拦截方法的参数甚至返回值（如给 query 偷加 LIMIT）
- C. 缓存查询结果
- D. 关闭连接池

> 答案：B
> 解析：Executor/StatementHandler/ParameterHandler/ResultHandler 四对象被 InterceptorChain 逐层套壳，Invocation.proceed 前可任意改写 args——这是分页插件的原理也是冲突源。

### 4. Spring 解决循环依赖用三级缓存，第三级（singletonFactories）存 ObjectFactory 的目的是（10分）

- A. 提高反射速度
- B. 延迟决定"提前暴露的是原始对象还是代理对象", 避免循环依赖场景下 AOP 代理被提前创建
- C. 支持原型 bean 的循环依赖
- D. 存储工厂方法的返回值

> 答案：B
> 解析：若直接放 earlySingletonObjects，则任何循环依赖都会逼着把代理提前造出来；ObjectFactory 让 getEarlyBeanReference 只在真被引用时才产代理。

### 5. SpringMVC 的 HandlerAdapter 体现的模式与动机是（10分）

- A. 适配器——把形态各异的 Controller 风格统一成 `ModelAndView handle(...)`，DispatcherServlet 只依赖抽象
- B. 装饰器——给 Controller 加缓冲
- C. 享元——复用处理器实例
- D. 建造者——分步构建 ModelAndView

> 答案：A
> 解析：目标接口（各类老式 Controller）客户端用不了 → 翻译层统一出口；新增处理器风格只加适配器，调度核心零改动（框架级 OCP）。

### 6. 以下属于 Spring 框架真实使用的模式对应，正确的有（多选）（10分）

- A. `JdbcTemplate`——模板方法（骨架+回调钩子混用）
- B. `ApplicationEvent`——观察者
- C. `@Async`——装饰器
- D. `HandlerMapping` 组合嵌套——组合模式

> 答案：A、B、D
> 解析：C 混淆——@Async 靠代理（Executor 提交是后续动作），装饰器要求"调用方主动叠加且接口不变"，这里拦截对调用方透明，属代理语义。

### 7. 关于代理模式在框架中的表现，正确的有（多选）（10分）

- A. CGLIB 通过继承生成子类实现代理, 因此 final 类与方法无法被代理
- B. JDK 动态代理要求目标实现接口, InvocationHandler 是唯一拦截入口
- C. Feign 接口没有实现类也能注入, 因为容器为接口生成了动态代理
- D. 只要目标是 public 方法, Spring 就一定能代理它

> 答案：A、B、C
> 解析：D 错在"方法 public ≠ 被代理"——类本身没进代理流程（非 bean、内部类 new 出来、final 类 CGLIB 跳过）照样裸奔。

### 8. 判断："Spring 的 BeanFactory 是工厂方法模式，因此一个 XxxFactory 类写进业务代码就一定合理。"（5分）

- A. 正确
- B. 错误

> 答案：B
> 解析：框架有工厂是因为它在管理"未知的类图"；业务类创建若容器能力已覆盖（@Bean/构造注入），再写工厂类就是给编译器加戏。

### 9. 简答题：完整讲一遍带 @Transactional 的 Service bean 从定义到能被调用的生命周期，并标出每一站背后的设计模式。（15分）

> 参考答案：
> - BeanDefinition 注册（注册表+原型图纸）→ getBean 入口（工厂方法/模板方法骨架）
> - 实例化（策略: 构造器/工厂方法选择）→ 属性填充（DI, 依赖倒置容器化）→ Aware 回调与 BPP 前后置（模板方法钩子+责任链）
> - 初始化后 AutoProxyCreator 判断切面命中 → 生成 CGLIB/JDK 代理（代理模式）
> - 入单例池（注册表+享元）；运行期每次调用: 代理拦截 → 切面责任链(事务 begin/commit) → 目标方法
> - 加分点: 提到循环依赖时提前暴露走 ObjectFactory 以延迟代理创建

### 10. 简答题：为什么"责任链"在 Java 生态里几乎每个框架都重新发明一遍？它满足了框架设计的哪些诉求？（10分）

> 参考答案：
> - 扩展点诉求: 链上插一格即扩展, 框架核心不需预知所有横切能力(OCP)
> - 顺序即策略: 安全/编码/限流的先后是业务决策, 运行期配置链序比代码硬编码灵活
> - 自主截断: 每节点决定放行与否, 表达"拦截类"语义天然(鉴权失败即止)
> - 结构统一: 节点可独立测试/复用, 故障可定位到单节点
> - 代价意识: 链越长 debug 越难(洋葱时序), 所以 Netty 用双向链显式化方向, 是同一诉求的改良
