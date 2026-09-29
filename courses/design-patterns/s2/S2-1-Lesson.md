# 框架里的设计模式

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能按"BeanDefinition→实例→填充→引用→初始化→代理"讲通 Spring bean 生命周期里每一站背后的模式（工厂/原型注册表/模板方法/后置处理责任链/代理）；说清 `@Transactional` 自调用为什么失效及三条修法；拆解 MyBatis 插件为什么是"能改方法签名的装饰器套娃"；在面试里用 Filter/拦截器/Netty pipeline/SPI 四个例子证明"责任链是横切架构的通用语法"。

```flow
例子目的：一个带事务的 Service bean 在容器里的诞生之旅——每一站都站着一个设计模式在干活
BeanDefinition(注册表: 图纸不是成品, 原型模式) -> BeanFactory.getBean(工厂方法/模板方法: 创建骨架固定)
-> 属性填充(DI: 依赖倒置的容器化) -> initializeBean(模板方法: Aware→BPP前置→Init→BPP后置, 钩子开放)
-> 需要AOP? PostProcessor 产出代理(CGLIB/JDK 代理模式) -> 单例池(注册表+享元: 全容器唯一)
出师后每次调用: 代理拦下 → 责任链(事务/安全/日志切面依次织入) → 目标方法
```

## 一、Spring：模式的集中陈列馆

**模板方法的工业化**：`AbstractApplicationContext.refresh()` 固定 12 步骨架，`obtainFreshBeanFactory/finishRefresh` 等是留给子类的钩子——Web 版与 CLI 版差异全在覆写几个钩子，骨架十年不变。`BeanPostProcessor` 链则是"模板方法 + 责任链"的组合拳：`initializeBean` 的骨架里硬编码了"遍历所有 BPP 前后置回调"，AOP、`@Autowired`、异步代理全靠往里插节点。

```java
// 目的：看懂 AOP 代理的创建位置——它发生在初始化后处理的"最后一棒"
public class AnnotationAwareAspectJAutoProxyCreator extends AbstractAdvisorAutoProxyCreator {
    // postProcessAfterInitialization: 目标 bean 完整初始化之后, 若命中切面表达式 → 返回代理替身
    // 结果: 容器里流出的是 Proxy, 原始对象只作为代理的 target 字段存在
}
// 错误用法: 依赖"构造器注入后再取原始对象"做绕过——你拿到的一直是代理, 想绕只能 this 直调, 而 that 正是失效事故
// 说明: BPP 实现类的代理创建时机有"提前实例化"连锁坑(它若依赖普通 bean 会触发过早初始化警告), 扩展点要用 ObjectProvider 延迟
```

**代理的两条实现线**：JDK `Proxy.newProxyInstance`（接口 + `InvocationHandler.invoke`，反射驱动）与 CGLIB（生成目标类子类，`MethodProxy` 直调，快但有 final 死刑）。Spring Boot 2.x 起 `proxyTargetClass=true` 默认 CGLIB——因为按接口注入在真实项目里造成的 ClassCastException 远多于省下的内存。自调用失效的根因一以贯之：`this.other()` 不走代理对象。三条修法按侵入度排：拆分到两个 bean（最干净）、注入自身代理 `@Lazy Service self`、`AopContext.currentProxy()`（要开 `exposeProxy`，代码里留框架味，下策）。

```java
// 目的：手写一次"代理的最小结构", 看懂所有框架代理都只是它的加强版
class TxProxy implements InvocationHandler {
    private final Object target;
    TxProxy(Object target) { this.target = target; }
    Object newProxy() {
        return Proxy.newProxyInstance(target.getClass().getClassLoader(),   // 结果: 代理类编译期不存在, 运行时生成, 实现相同接口
                target.getClass().getInterfaces(), this);
    }
    @Override public Object invoke(Object p, Method m, Object[] args) throws Throwable {
        tx.begin();                                                          // 前置: 框架"织入"的就是这几行
        try { Object r = m.invoke(target, args); tx.commit(); return r; }    // 反例: m.invoke(p,...) 会代理调代理无限递归
        catch (Throwable e) { tx.rollback(); throw e; }
    }
}
// 错误用法: 以为"加了 @Transactional 就生效"——注解只是元数据, 生效靠上面这套拦截; 类没被代理(内部类/非 public/自调用)一切免谈
```

**观察者与适配器的日常露脸**：`ApplicationEvent` 家族是观察者（还演化出 `@TransactionalEventListener` 的时机控制）；SpringMVC 的 `HandlerAdapter` 是适配器——`HttpRequestHandler/Controller/ControllerMethod` 三种毫不相干的处理器类型，被统一适配成 `ModelAndView handle(...)` 一个接口，DispatcherServlet 因此永远只面对抽象（OCP 的框架级示范）。

## 二、MyBatis：装饰器套娃 + 微内核责任链

```java
// 目的：拆 MyBatis 的 Executor 构造链——装饰器栈, 每层只加一种能力
Executor executor = new CachingExecutor(                 // 二级缓存层(可关)
        new ReusingExecutor(                             // 语句复用层
                new SimpleExecutor(tx, factory)));       // 核心层: 真正发 JDBC——MyBatis 的"微内核"
// 结果: 开关二级缓存 = 抽掉最外一层皮, 内核零改动; 这就是"对扩展开放"在 ORM 里的实物
// 说明: 与 JDK IO 流栈同一配方(new Buffered(new DataInputStream(...))), 区别在 MyBatis 装饰器构造多传 MappedStatement 等上下文
```

插件机制比装饰器再进一步：`Interceptor.plugin(target)` 用 JDK 代理对 `Executor/StatementHandler/ParameterHandler/ResultHandler` 四对象按需套壳，`InterceptorChain.pluginAll` 是责任链——且这层代理能**改方法签名**（反射拿到参数数组随便换），所以分页插件 PageHelper 能往 `query(sql, rowBounds)` 里偷加 LIMIT。代价是：多个插件对同一签名互相破坏时排查极难——插件越少越好，写插件先画"被谁包、包了谁"的栈图。

## 三、责任链是横切架构的通用语法

四个生态位同一个结构（共同接口 + 持有 next + 自主决定是否放行）：Servlet Filter（容器级）、SpringMVC 拦截器（MVC 级）、Spring Security `FilterChainProxy`（把链本身做成一个 Filter 套娃）、Netty `ChannelPipeline`（双向链：入站正序出站逆序）。加上 Java SPI 与 Spring FactoriesLoader 构成的"可插拔发现机制"——框架设计者反复用同一招：**把扩展点定义成链上的一格，把策略选择权留在运行期配置**。

## 四、常见线上问题

- `@Transactional` 标在 private/final 方法或内部类上：静默无代理，事务从未存在——上线才发现脏数据；
- 自调用链：外层有事务、内层"新开"的 `REQUIRES_NEW` 实际加入同一事务，业务以为的回滚隔离不存在；
- BPP 里做重逻辑：它在每个 bean 创建路径上被执行 N×M 次，一处慢查询全应用启动慢三分钟；
- MyBatis 多插件冲突：两个拦截器都改了同一个方法签名，后套壳的拿到面目全非的参数——现象是"奇怪的 ClassCastException in plugin"。

## 五、小结与过关要点

框架不是模式的标本柜，而是模式的**流水线**：同一个代理模式在 Spring 里管事务、在 MyBatis 里管插件、在 Feign 里管远程——变化的只是拦截后干什么。过关自测：任选一个你天天用的注解（`@Async/@Transactional/@Cacheable`），说出它靠哪种代理、在哪一站被织入、什么情况下会失效——三问全对，框架模式这关就过了。
