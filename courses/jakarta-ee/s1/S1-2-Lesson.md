# CDI 依赖注入标准

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：掌握 Jakarta CDI 的 Bean 定义与注入方式、五种作用域（尤其默认 `@Dependent` 的陷阱）、用限定符解决同类型多实现、用拦截器做横切逻辑；并能清晰说出 CDI 与 Spring IoC 在默认作用域、配置风格、循环依赖处理上的关键差异，避免跨生态踩坑。

## 一、CDI 是什么，解决什么

CDI（**Contexts and Dependency Injection**）是 Jakarta EE 的依赖注入与上下文管理**规范**（实现如 Weld、OpenWebBeans）。它把"对象生命周期 + 按依赖装配 + 上下文作用域 + 事件 + 拦截"标准化，思路和 Spring IoC 高度一致（呼应 spring-core s1-1/s1-2），但它是**规范**、Spring 是**框架实现**。

```flow
容器启动扫描 → 发现 Bean(有作用域注解 / @Named / beans.xml)
       → 构建依赖图 → 按注入点解析(类型 + 限定符)
       → 按作用域管理实例 → 注入到构造器/字段/方法
       → 运行期: 拦截器环绕 / 事件发布订阅
```

## 二、Bean 定义与注入

**被管起来（成为 Bean）的方式**：有加作用域注解（`@ApplicationScoped` 等）、`@Named`、或在启用了 `beans.xml` 的归档里被发现。

**注入方式**（和 Spring 几乎同构）：

```java
// 例子目的：用构造器注入把 Bean 管起来，展示 @ApplicationScoped 单例语义
@ApplicationScoped                 // 全局单例（错误用法：去掉此行 → 退回默认 @Dependent 多例，实例内缓存/状态每次新建会丢）
public class OrderService {
    private final PaymentGateway pay; // final 字段→构造器注入后可保持不可变

    @Inject                       // 构造器注入（推荐，便于不可变与测试；错误用法：误用 Spring 的 @Autowired → CDI 不识别、注入不生效）
    public OrderService(PaymentGateway pay) { this.pay = pay; } // 容器按类型+限定符解析依赖后传入
}
```

字段注入 `@Inject private Xxx x;`、setter/初始化方法注入同样支持。**注意 `@Inject` 是 Jakarta 标准注解，`@Autowired` 是 Spring 专有**——迁移时要换。

## 三、五种作用域，以及最大的坑

| CDI 作用域 | 含义 | Spring 近似 |
| --- | --- | --- |
| `@Dependent`（**默认**） | 跟随注入它的宿主，每次使用新实例 | ≈ prototype（但语义更细） |
| `@RequestScoped` | 一个 HTTP 请求一个实例 | request |
| `@SessionScoped` | 一个会话一个实例 | session |
| `@ApplicationScoped` | 全局单例 | singleton（Spring 默认） |
| `@ConversationScoped` | 一段跨请求的对话 | 无直接对应 |

> ⚠️ **最易踩的差异**：**Spring `@Component` 默认是单例，CDI 默认是 `@Dependent`（多例、随宿主）**。把 Spring 习惯带过来、忘了标 `@ApplicationScoped`，会以为"注入的是同一个对象"实则每次新建，缓存/状态全丢。这是跨生态第一坑。

## 四、限定符 Qualifiers：同类型多实现怎么挑

按类型注入遇到多个实现会歧义（`Ambiguous resolution`）。CDI 用**限定符**（一种自定义注解 `@Qualifier`）在"类型 + 限定符"双维度上精确匹配：

```java
// 例子目的：自定义 Qualifier 在"类型+限定符"双维度消除同类型多实现的歧义
@Qualifier @Retention(RUNTIME) @Target({FIELD,TYPE,METHOD}) // 限定符本质是一个带 @Qualifier 的自定义注解
public @interface Ali {}

@ApplicationScoped @Ali            // 实现类打上限定符标记（错误用法：实现类忘标 @Ali → 注入点 @Inject @Ali 找不到候选抛 UnsatisfiedResolutionException）
public class AliPay implements PaymentGateway { ... }

@Inject @Ali PaymentGateway pay;   // 明确选支付宝实现；正确使用结果：多实现时不再抛 Ambiguous resolution
```

内置 `@Default`（无限定符时的默认）、`@Any`（拿全部实例，配合 `Instance<>` 动态选）。对照 Spring：等价于 `@Qualifier("ali")` + `@Primary`（选默认）。

## 五、拦截器 Interceptors：标准化的 AOP

CDI 拦截器 = 通过**绑定注解**触发的环绕逻辑，概念等同 Spring AOP（呼应 spring-core s2-1）：

```java
// 例子目的：用绑定注解 @Logged 触发环绕拦截，演示标准化 AOP（概念等同 Spring AOP）
@Interceptor @Logged              // @Logged 是绑定注解（错误用法：@Logged 缺 @InterceptorBinding 元注解 → 拦截器根本不触发）
@Priority(1)                       // 多个拦截器时按 @Priority 定序
public class LoggingInterceptor {
    @AroundInvoke                 // 环绕通知入口
    public Object log(InvocationContext ctx) throws Exception {
        long t = System.nanoTime();                     // 记录起始时刻
        try { return ctx.proceed(); }                   // 放行目标方法（错误用法：忘调 proceed() → 业务方法被吞、永不执行）
        finally { System.out.println(ctx.getMethod() + " " + (System.nanoTime()-t)); } // 正确使用结果：无论成败都打印耗时
    }
}
```

还有 `@Decorator`（装饰器，改单个 Bean 行为）、`@Observes` 事件（发布/订阅，对应 Spring `ApplicationEvent`/`@EventListener`）、`@Produces` 生产者方法（对应 Spring `@Bean` 工厂方法，用于装配第三方类）。

## 六、CDI vs Spring IoC：关键差异一览

| 维度 | CDI（规范） | Spring（框架） |
| --- | --- | --- |
| 注入注解 | `@Inject` | `@Autowired`/`@Resource`/`@Inject` |
| 默认作用域 | **`@Dependent`（多例）** | **singleton（单例）** |
| 多实现消歧 | Qualifier + `@Default`/`@Any` | `@Qualifier` + `@Primary` |
| 装配第三方类 | `@Produces` 方法 | `@Configuration`+`@Bean` |
| 横切 | Interceptor/Decorator | AOP（JDK/CGLIB 代理） |
| 循环依赖 | 多数作用域靠**客户端代理**天然化解 | 三级缓存，仅单例 setter 场景 |
| 生态 | 应用服务器内置 | Boot 自动装配/starter 便利层 |

> **分工说明**：Spring 侧的容器内核、三级缓存、AOP 代理细节已在 spring-core s1-1/s1-2/s2-1 展开；本节聚焦 CDI 规范本身与两者的**对照差异**，不重复 Spring 内部机制。

## 七、动手验证

1. 写两个 `PaymentGateway` 实现，不加限定符观察 `Ambiguous resolution` 异常，再用自定义 `@Ali/@Wx` 修复。
2. 把一个 Bean 的 `@ApplicationScoped` 去掉，用计数器验证它变回 `@Dependent` 多例语义（状态不再共享）——亲手踩默认作用域坑。
3. 用 `@Observes` 实现"下单成功→发通知"的解耦事件流。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| "单例"Bean 里的 Map 缓存莫名丢失 | 忘了标 `@ApplicationScoped`，实际是默认 `@Dependent` 多例 |
| 注入报 `Ambiguous resolution` | 同类型多实现未加限定符消歧 |
| Spring 工程迁 CDI 后到处 `@Autowired` 不生效 | CDI 只认 `@Inject`，注解不通用 |
| 拦截器不触发 | 绑定注解缺 `@InterceptorBinding`，或被 `this` 自调用绕过代理 |

## 九、关联技术栈

- **对照 Spring**：spring-core s1-1（容器/Bean 定义）、s1-2（DI 与循环依赖）、s2-1（AOP）
- **Jakarta 全景**：Bean Validation、JPA、JAX-RS（见 s1-1）
- **实现**：Weld、OpenWebBeans；EE 8+ 起 CDI 已成平台"装配中枢"，EJB many 能力被 CDI 吸收
