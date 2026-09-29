# 依赖注入与循环依赖

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：讲清构造器注入 vs setter/字段注入的取舍；把单例循环依赖的三级缓存机制讲到每一层缓存"为什么存在"；说得清三级缓存解决不了哪些循环依赖（构造器注入、prototype）。

## 一、三种注入方式：优先构造器

| 方式 | 写法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| 构造器注入 | `class A{ private final B b; A(B b){this.b=b;} }` | 依赖不可变、可空校验、便于单测、保证对象创建即完整 | 依赖多时参数长；循环依赖时**无解**（见下） |
| Setter 注入 | `setB(B b)` | 可选依赖、可重配置 | 对象可能处于"半初始化" |
| 字段注入 | `@Autowired private B b;` | 最省事 | 无法 final、难单测、掩盖依赖膨胀，**不推荐** |

**架构师准则**：必需依赖一律构造器注入（配合 `final`）；这也天然逼迫你正视循环依赖——因为构造器循环依赖会**直接启动失败**，暴露设计问题。字段注入却能把循环依赖"藏起来"靠三级缓存化解。

## 二、什么是循环依赖，分几种

A→B→A 就是循环依赖，但关键要分三类，能力边界完全不同：

1. **单例 + setter/字段注入的循环依赖**：Spring 能自动解决（三级缓存）。
2. **单例 + 构造器注入的循环依赖**：**无法解决**——造 A 要先有 B，造 B 要先有 A，死锁在实例化之前。只能改设计或至少一侧改 setter/`@Lazy`。
3. **prototype 作用域的循环依赖**：**无法解决**——原型每次都新建、没有缓存池可提前暴露半成品，直接抛 `BeanCurrentlyInCreationException`。

## 三、三级缓存：每一层到底在存什么

`DefaultSingletonBeanRegistry` 里三个 Map（这是本节硬核）：

```flow
singletonObjects（一级）：完整的成品单例
earlySingletonObjects（二级）：提前暴露的"半成品"（已实例化未装配，可能已被提前代理）
singletonFactories（三级）：ObjectFactory，一个能"产出早期引用（含按需代理）"的 lambda
```

`getBean("A")` 化解 A↔B 循环的过程：

1. 实例化 A（构造完成，尚未填属性），把 A 的 `ObjectFactory` 放进**三级**缓存。
2. 填充 A 的属性需要 B → `getBean("B")`。
3. 实例化 B，B 的 factory 进三级；填充 B 需要 A → `getBean("A")`。
4. 一级无、二级无 → 查三级，命中 A 的 factory，调用它得到 A 的**早期引用**（若 A 需 AOP 代理，此处提前生成代理），放入**二级**、从三级移除。
5. B 拿到 A 早期引用，完成装配、初始化，成为成品进**一级**。
6. 回到 A，拿到成品 B，A 完成装配初始化，进**一级**；A 的早期代理若已生成则复用，不重复造。

## 四、为什么是三级而不是两级？

这是最高频追问。答案在于 **AOP 代理**：

- 如果不需要代理，两级（成品 + 早期引用）就够。
- 第三级存的是 `ObjectFactory` 而非直接存早期对象，是为了**把"是否/何时生成代理"的决定延迟到"确实发生循环依赖、被别人要引用时"才做**——`getEarlyBeanReference` 会回调 `SmartInstantiationAwareBeanPostProcessor`（即 AOP 的 `AnnotationAwareAspectJAutoProxyCreator`）。
- 这样保证：**没有循环依赖的 Bean，代理仍在正常的 `postProcessAfterInitialization` 生成**；只有真发生循环引用时才"提前"生成代理并从三级升到二级。既解决循环、又不破坏 AOP 的正常代理时机。

> 若把三级砍成两级直接存原始早期对象，就会出现"注入进去的是原始对象、但最终成品是代理对象"的不一致——同一个 Bean 两种身份，错乱。

## 五、Boot 2.6+ 为什么默认关掉循环依赖

`spring.main.allow-circular-references` 默认 false。因为三级缓存只解决"单例 + 非构造器"这一种循环，掩盖的是**本不该有的耦合设计**。默认禁止是逼你重划边界。真正该做的：

- 拆出第三个 Bean（把公共逻辑下沉）
- 用事件（`ApplicationEventPublisher`）解耦双向依赖
- 引入接口/抽象打破具体类互引
- 过渡期实在要放，`@Lazy` 注入某一条边，并挂治理工单

## 六、例子：构造器注入与循环依赖的能解/不能解（正确用法与错误用法）

```java
// 例子目的：对比可解的 setter 循环与不可解的构造器循环，并展示首选的构造器注入
import org.springframework.beans.factory.annotation.*;
@Service class OrderService {
    private final PriceService price;                  // 正确用法：必需依赖用 final + 构造器注入
    OrderService(PriceService price) { this.price = price; } // 创建即完整、可单测、依赖不可变
}
@Service class A {
    @Autowired B b;                                    // 单例 + 字段注入的循环：可被三级缓存自动化解
}
@Service class B {
    @Autowired A a;                                    // A↔B 字段互引，默认能启动（允许循环时）
}
@Service class CtorA { private final CtorB b; CtorA(CtorB b){this.b=b;} } // 错误用法：构造器循环 CtorA↔CtorB
@Service class CtorB { private final CtorA a; CtorB(CtorA a){this.a=a;} } // 造 A 先要 B、造 B 先要 A→死锁在实例化前
// 正确使用结果：A↔B 字段注入（allow-circular=true）能启动；而 CtorA/CtorB 构造器循环启动即抛 BeanCurrentlyInCreationException
// 错误用法：Boot 2.6+ 默认 allow-circular-references=false → 连 A↔B 字段循环也报错（应拆 Bean/用事件解耦，而非盲开开关）
// 正确用法：过渡期用 @Lazy 注一条边打破：new CtorA(@Lazy CtorB b)，注入的是懒代理，首次调用才解引用
```

## 七、动手验证

1. A、B 字段注入互引，正常启动；把 A 依赖 B 改成构造器注入，复现启动失败（`BeanCurrentlyInCreationException`），体会构造器循环无解。
2. 给 A 加一个 `@Aspect` 会让它被代理，在三级→二级提升处（`getEarlyBeanReference`）打断点，验证提前暴露的其实是代理对象。
3. 设 `spring.main.allow-circular-references=false`（默认），复现字段注入循环也报错，再用 `@Lazy` 打破一条边启动成功。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 启动抛 `BeanCurrentlyInCreationException` | 构造器循环依赖，或 Boot 默认禁了循环 |
| 注入进来的对象没有 AOP 增强（事务/缓存失效） | 循环依赖 + 代理时机叠加的边角；优先消环而非调缓存 |
| prototype 互引启动即失败 | 原型无提前暴露机制，本就不支持 |
| 升级 Boot 2.6+ 后原来能启动的现在不能 | 循环依赖默认被关闭，需消环而非盲目 reopen |

## 九、关联技术栈

- **容器内核**：`DefaultSingletonBeanRegistry` 三级缓存、`getEarlyBeanReference`
- **AOP 交叉**：`SmartInstantiationAwareBeanPostProcessor`、代理提前生成（见 s2-1）
- **Boot 层**：`spring.main.allow-circular-references`、`@Lazy`
- **设计层**：依赖倒置、事件解耦、单一职责（循环依赖往往是设计异味）
