# 小测验 · CDI 依赖注入标准

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. CDI 与 Spring IoC 最容易被踩的默认作用域差异是？（25分）

- A. 两者默认都是单例，没区别
- B. CDI 默认 `@Dependent`（多例、随宿主），Spring `@Component` 默认单例
- C. CDI 默认单例，Spring 默认多例
- D. CDI 没有作用域概念

> 答案：B
> 解析：这是跨生态第一坑——从 Spring 过来忘了标 `@ApplicationScoped`，"以为单例实为多例"，缓存/状态丢失。

### 2. 同类型有多个实现、注入报 `Ambiguous resolution`，CDI 用什么消歧？（20分）

- A. 只能删掉多余实现
- B. 用自定义限定符 `@Qualifier` 在"类型 + 限定符"双维度精确匹配，配合内置 `@Default`/`@Any`
- C. 改用 `@Named` 就自动解决
- D. CDI 不支持多实现

> 答案：B
> 解析：限定符是 CDI 选实现的标准手段，等价 Spring 的 `@Qualifier`+`@Primary`。

### 3.（多选）关于 CDI 的注解与机制，下列对应正确的有？（25分）

- A. `@Produces` 方法 ≈ Spring `@Bean` 工厂方法，用于装配第三方类
- B. `@Observes` 事件 ≈ Spring `ApplicationEvent`/`@EventListener`
- C. `@Interceptor` + `@AroundInvoke` ≈ Spring AOP 环绕通知
- D. `@Autowired` 是 CDI 标准注解，与 `@Inject` 完全等价通用

> 答案：ABC
> 解析：D 错，`@Autowired` 是 Spring 专有，CDI 认 `@Inject`；迁移时注解不通用。

### 4. 填空题：CDI 中一个 Bean 想成为全局单例应标注 @________ 作用域；构造器注入用的是 @________ 注解。（15分）

> 答案：ApplicationScoped / Inject
> 解析：`@ApplicationScoped` 对应 Spring singleton，`@Inject` 是标准注入注解。

### 5. 简答题：说出 CDI 的五种作用域，并解释它处理循环依赖为何常比 Spring"更自然"。（15分）

> 参考答案：
> - `@Dependent`（默认多例）、`@RequestScoped`、`@SessionScoped`、`@ApplicationScoped`、`@ConversationScoped`
> - CDI 对正常注入的 Bean 常注入的是客户端代理（懒解析到实际作用域实例），循环引用在代理下多能天然化解
> - 而 Spring 单例靠三级缓存提前暴露半成品对象，且仅覆盖 setter 场景，构造器循环依赖仍会失败
