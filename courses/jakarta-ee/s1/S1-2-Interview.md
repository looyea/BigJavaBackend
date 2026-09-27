# 实际面试题 · CDI 依赖注入标准

## 题 1：CDI 和 Spring IoC 有什么区别？

**考察层次**：初级说"都是依赖注入"；中级能列注解/作用域差异；高级能讲默认作用域陷阱与循环依赖处理机理。

**参考答法**：

1. 定位：CDI 是 **Jakarta 规范**（实现 Weld/OpenWebBeans），Spring IoC 是**框架**；概念几乎同构。
2. 注解：CDI 用 `@Inject`（标准），Spring 用 `@Autowired`（专有）；`@Named`≈`@Component("name")`，`@Produces`≈`@Bean`，`@Observes`≈`@EventListener`。
3. **默认作用域不同**：CDI 默认 `@Dependent`（多例、随宿主），Spring 默认 singleton——这是迁移第一大坑。
4. 循环依赖：CDI 常靠注入客户端代理懒解析天然化解；Spring 靠三级缓存，只覆盖单例 setter 场景（见 spring-core s1-2）。

**追问**：为什么企业要么全 CDI 要么全 Spring，不混用注入注解？→ 语义/默认作用域不同，混用极易踩"以为单例实为多例"的隐蔽 bug。

## 题 2：同类型有多个实现，CDI 怎么决定注入哪一个？

**答题要点**：单靠类型会 `Ambiguous resolution`。用**限定符**（自定义 `@Qualifier` 注解）在类型+限定符双维度精确匹配；内置 `@Default`（无限定符时的默认，类似 Spring `@Primary` 的角色）、`@Any`（拿到全部实例，配 `Instance<>` 运行期动态选）。这套等价 Spring 的 `@Qualifier`+`@Primary`。

## 题 3：`@Dependent` 到底特殊在哪？举一个真实事故。

**答题要点**：`@Dependent` 是 CDI 默认作用域——Bean 实例生命周期绑定到注入它的宿主，不做全局缓存，每次需要新实例。事故：开发者按 Spring 习惯写了个带 `ConcurrentHashMap` 本地缓存的 Bean，忘了标 `@ApplicationScoped`，结果每个注入点各拿一个新实例、缓存互不可见、命中率暴跌，还以为是缓存逻辑 bug。教训：想要单例在 CDI 里必须显式 `@ApplicationScoped`。

## 题 4：CDI 里怎么做 AOP / 横切逻辑？

**结构化回答**：

1. **拦截器 Interceptor**：绑定注解（`@InterceptorBinding`）+ `@Interceptor` + `@AroundInvoke`，用 `@Priority` 定序，对应 Spring AOP 环绕通知。
2. **装饰器 Decorator**：`@Decorator` 针对单个 Bean 接口增强行为。
3. **事件 `@Observes`**：把副作用解耦成订阅者（准 AOP 关注点分离）。
4. 共同坑：`this` 自调用绕过代理导致拦截不生效（和 Spring 一样，见 spring-core s2-1）。

## 题 5：只有 `beans.xml` 老配置和注解，CDI 现在推荐哪种装配？

**答题要点**：EE 起 CDI 逐步走向"注解 + 隐式发现（implicit discovery）"，新规范里 `beans.xml` 已非强制、趋向 bean 注解直接用；显式 `beans.xml` 主要用于控制发现模式或遗留工程。但架构上仍推荐**构造器注入 + 不可变 + 明确作用域注解**，和 Spring 的最佳实践一致，便于单测与排查。

## 高频追问速答

1. `@Named` 能代替作用域注解吗？→ 不能，它主要给 EL/按名解析用，不改变作用域，Bean 仍需作用域或 `@Dependent`。
2. CDI 能读 `@Value` 风格配置吗？→ 无内置，靠 MicroProfile `@ConfigProperty`（呼应 s1-1 生态）。
3. 拦截器不触发怎么查？→ 绑定注解是否带 `@InterceptorBinding`、是否被自调用绕过代理、是否 `@Priority` 顺序问题。
4. `@Any` 有什么用？→ 拿到某接口的所有实现做动态选择/聚合，等价 Spring 注入 `List<Interface>` 或用 `ObjectProvider`。
5. CDI 有 prototype 吗？→ 语义靠 `@Dependent`；要"每次新对象+按名"多用 `@New` 限定符或 `Instance<>`。
