# AOP 与动态代理

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：说得清 JDK 动态代理与 CGLIB 的选择规则；能画出一次切面增强的执行顺序；讲透"自调用导致切面失效"的根源与四种解法。这是事务、缓存、鉴权等一切注解增强的底层。

## 一、AOP 到底解决什么：把横切关注点从业务里抽出来

日志、事务、权限、重试、监控——这些"每个方法都要、但和业务逻辑无关"的代码叫**横切关注点**。若写进每个方法，就是重复、易漏、难改。AOP 让你在**不改动目标类**的前提下，把这些逻辑"织入"到方法执行的前后。

几个必须内化的名词（用"下单方法加事务"举例）：

- **Joinpoint 连接点**：可被增强的点，Spring AOP 只支持**方法执行**。
- **Pointcut 切点**：匹配"哪些 joinpoint 要增强"的表达式（`execution(...)`、注解 `@annotation`）。
- **Advice 通知**：增强的动作（Before/After/Around/AfterReturning/AfterThrowing）。
- **Aspect 切面**：切点 + 通知 的封装类（`@Aspect`）。
- **Weaving 织入**：把通知应用到目标对象生成**代理**的过程；Spring AOP 是**运行期织入**（靠代理），AspectJ 是编译期/类加载期织入。

## 二、Spring AOP 的本质就是"代理模式"

关键认知：**Spring AOP 不是改字节码，而是给你一个代理对象**。容器里 `getBean("orderService")` 返回的往往不是你的 `OrderServiceImpl`，而是包了增强逻辑的代理。调用链：

```flow
client → 代理对象（proxy）→ 拦截器链（事务/日志/... 依次 around）→ 目标对象真实方法
                                    ↑ 返回时逆向再穿过一遍拦截器链
```

- **拦截器链执行顺序**：进入时按注册顺序 `@Order` 从小到大，退出时相反（洋葱模型）。多个通知叠加时，`@Around` 里对 `proceed()` 的调用位置决定了前后逻辑。
- **切面 order**：`@Order(n)` 或 `Ordered` 值越小越"外层"。事务通常要有确定顺序，别和自定义切面打架。

## 三、JDK 代理 vs CGLIB：怎么选

| 维度 | JDK 动态代理 | CGLIB |
| --- | --- | --- |
| 原理 | 实现接口，`Proxy` + `InvocationHandler` | 生成目标类的**子类**覆盖方法 |
| 要求 | 目标必须实现接口 | 目标类/方法不能是 `final` |
| Spring Boot 默认 | — | **默认用 CGLIB**（`spring.aop.proxy-target-class=true`） |
| 坑 | 只能按接口类型注入 | final 类/私有方法无法代理；自调用绕过 |

Boot 默认 CGLIB 是有意为之：让你既能按接口也能按实现类注入，避免"必须依赖接口类型"的限制。若你强制 `proxyTargetClass=false`，则回到 JDK 代理、只能注入接口。

## 四、最痛的坑：自调用（this 调用）绕过代理

因为增强长在**代理对象**上，只有"从外部经代理进来"的调用才会被拦截。类内部 `this.otherMethod()` 走的是**目标对象自身**，绕过了代理，切面全部失效：

```java
// 例子目的：复现"自调用绕过代理→切面失效"，并给出正确的破局写法
@Service
public class OrderService {
    @Lazy @Autowired OrderService self;   // 正确用法：注入自身代理，走它才能被拦截
    public void create() {
        this.pay();                       // ❌ 错误用法：自调用走目标对象自身，pay() 上的 @Transactional/@Cacheable 全失效
        self.pay();                       // ✅ 正确用法：经代理调用，增强才生效
    }
    @Transactional public void pay() { ... } // 只有从外部经代理进来才会开启事务
}
// 正确使用结果：self.pay() 抛异常能回滚；this.pay() 不能回滚（增强根本没跑）
// 错误用法：类或方法标 final → CGLIB 不能生成子类覆盖→ 无法增强（静默失效）
```

**四种解法**：

1. **拆类**：把被增强方法移到另一个 Bean，注入它再调用（最干净，符合 SRP）。
2. **注入自身代理**：`@Lazy OrderService self;` 然后 `self.pay()`——走代理。
3. `AopContext.currentProxy()`：需 `@EnableAspectJAutoProxy(exposeProxy = true)`，拿到当前代理再调。
4. 改用 AspectJ 织入（编译期，不依赖代理），代价是引入 AspectJ 工具链——一般不为这个坑上它。

## 五、通知类型与异常对增强的影响

- `@Around` 最强大也最危险：忘了 `proceed()` 目标方法就不执行；吞异常会破坏事务回滚语义。
- `@After` 类似 finally 一定执行；`@AfterReturning` 仅在正常返回后；`@AfterThrowing` 仅异常时。
- 事务的回滚靠 `@Around` 型的事务拦截器捕获异常决定 commit/rollback——理解这点才能理解下节"事务失效场景"。

## 六、动手验证

1. `getBean` 打印 `getClass()`，观察拿到的是 `...$$SpringCGLIB$$0` 或 `$Proxy`——直观确认"容器给的是代理"。
2. 复现自调用失效：`create()` 里 `this.pay()`，pay 加 `@Transactional` 并抛异常，观察**不回滚**；改注入自身代理后回滚正常。
3. 两个 `@Aspect` 各打 enter/exit 日志，用 `@Order` 调整，验证洋葱式执行顺序。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| `@Transactional`/`@Cacheable` 时灵时不灵 | 自调用绕过代理；或方法非 public/final |
| 按实现类注入报 `BeanNotOfRequiredTypeException` | 用了 JDK 代理（proxyTargetClass=false）却按类注入 |
| 目标类是 final 无法增强 | CGLIB 不能继承 final 类 |
| 异常被 `@Around` 吞了导致不回滚 | around 通知没正确 rethrow |

## 八、关联技术栈

- **底层**：JDK `Proxy`/`InvocationHandler`、CGLIB/ASM 子类生成
- **Spring 层**：`@Aspect`、`@EnableAspectJAutoProxy`、`AopContext`、拦截器链
- **应用层**：`@Transactional`（s2-2）、`@Cacheable`、`@Async` 全部构建在此机制上
- **对比**：AspectJ 编译期/类加载期织入（突破代理局限）
- **容器交叉**：代理在 Bean 生命周期 `postProcessAfterInitialization` 生成（spring-boot s1-3、s1-2 三级缓存）
