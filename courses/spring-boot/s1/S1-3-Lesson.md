# IoC 容器与 Bean 生命周期

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：能画出 Boot 下一个 Bean 从"定义"到"就绪"到"销毁"的完整时间线，说清每一环可插入的扩展点，并据此定位"注入为 null""初始化没跑""关闭丢数据"三类线上事故。
>
> 说明：Bean 的底层机制（BeanFactory 层次、三级缓存、AOP、事务）在 **spring-core** 包深挖；本节聚焦 **Boot 语境下**这些环节何时发生、被哪些自动配置介入、以及工程上怎么用。

## 一、一条 Bean 的生命周期主线

```flow
BeanDefinition 注册（扫描/@Bean/自动配置）-> BeanFactoryPostProcessor 加工定义
-> 实例化（构造器注入）-> 属性填充（@Autowired/@Value）-> Aware 回调
-> BeanPostProcessor.postProcessBeforeInitialization -> 初始化（@PostConstruct → InitializingBean.afterPropertiesSet → init-method）
-> BeanPostProcessor.postProcessAfterInitialization（AOP 代理在此生成）-> 就绪，进单例池
-> 使用 -> 销毁（@PreDestroy → DisposableBean.destroy → destroy-method）
```

记忆口诀：**"定→加→实→填→Aw→BP前→初→BP后→用→销"**。面试能把这条线讲顺、并指出"代理在 BP 后"，就已经赢过一半人。

## 二、Boot 把"定义"这一环变得无处不在

在纯 Spring 里你要写 XML 或 `@Configuration`；Boot 的自动配置本质就是**在 refresh 的 `invokeBeanFactoryPostProcessors` 阶段，把成百上千个 `@Bean` 方法展开成 BeanDefinition**。所以你项目里绝大多数 Bean 不是你自己定义的，而是 starter 定义的。

三类定义来源，排查"这个 Bean 从哪来"按此找：

| 来源 | 注册者 | 典型例子 |
| --- | --- | --- |
| 组件扫描 | `ClassPathBeanDefinitionScanner` | `@Component/@Service/@RestController` |
| 显式 `@Bean` | `ConfigurationClassPostProcessor` | 你自己的 `@Configuration` |
| 自动配置 | `AutoConfigurationImportSelector` + 条件筛选 | `DataSource`、`ObjectMapper`、`RedisTemplate` |

> 特别注意：`@Configuration` 默认 `proxyBeanMethods = true`，容器会用 CGLIB 增强配置类，保证同一个 `@Bean` 方法被其它 `@Bean` 方法调用时返回**单例**而非新建。若在超大配置类里为省内存关掉代理，务必确认没有跨方法调用 `@Bean`，否则拿到的是新对象——这是隐蔽的"对象没走单例"事故源。

## 三、`BeanFactoryPostProcessor`：改"图纸"，不是改"成品"

它在实例化之前运行，能读改 `BeanDefinition`。Boot 里最典型的是 `PropertySourcesPlaceholderConfigurer`（把 `${...}` 占位符解析进定义）和 MyBatis 的 `MapperScannerConfigurer`/`@MapperScan`（把所有 Mapper 接口注册成代理 BeanDefinition）。

工程含义：**你想批量改一类 Bean 的元数据（如统一设 lazy、改 scope），应在这里做**，而不是 `BeanPostProcessor`——那时对象已经造出来了。

## 四、扩展点：`BeanPostProcessor` 才是 AOP/注入/校验的家

`postProcessBeforeInitialization` 与 `postProcessAfterInitialization` 两个钩子，夹住"初始化"这一步。几个你天天用却容易忽略的实现：

- `AutowiredAnnotationBeanPostProcessor`：处理 `@Autowired`/`@Value`（属性填充阶段）。
- `ApplicationContextAwareProcessor`：注入 `*Aware` 系列。
- `ConfigurationPropertiesBindingPostProcessor`：把 `@ConfigurationProperties` 绑到 Bean 上。
- `AnnotationAwareAspectJAutoProxyCreator`：**AOP 代理在 postProcessAfter 里生成**——所以 `@PostConstruct` 里拿到的还是原始对象，代理还没套上。

## 五、初始化的三种写法，和它们的执行顺序

同一个 Bean 若三种都写了，顺序固定为：

1. `@PostConstruct`（`CommonAnnotationBeanPostProcessor` 在 BP-before 里回调）
2. `InitializingBean.afterPropertiesSet()`
3. `@Bean(initMethod = "xxx")` 或 XML `init-method`

**架构师视角的取舍**：优先用 `@PostConstruct`（语义清晰、不耦合 Spring 接口）；`InitializingBean` 把框架侵入到业务类里，除非你需要它和 `DisposableBean` 成对，否则不用。初始化逻辑重（建连、预热、加载字典）要考虑是否拖慢就绪——参见启动流程一节的 Runner 讨论。

## 六、销毁：优雅停机不是自动的

容器关闭（`context.close()` / JVM shutdown hook）按**依赖逆序**回调销毁钩子：`@PreDestroy` → `DisposableBean.destroy` → `destroy-method`。Boot 里要让正在处理的请求跑完，必须开优雅停机：

```yaml
# 例子目的：一行配置开启优雅停机，给在途请求一个 drain 窗口
server:
  shutdown: graceful          # 不再接新请求，等已接收请求处理完再关
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s   # 每个关闭阶段最多等 30s
# 正确使用结果：SIGTERM 后 @PreDestroy 有机会执行，在途请求跑完才退出
# 错误用法：K8s terminationGracePeriodSeconds 小于上面 30s → 未到 drain 完就被 SIGKILL，@PreDestroy 根本不执行（在途订单丢失）
```

配合 K8s：`preStop` 钩子 + `terminationGracePeriodSeconds` 要大于上面的超时，否则 Pod 被 SIGKILL，`@PreDestroy` 根本不执行——表现为"发布时在途订单丢失""MQ 消费者没反注册"。这是电商/金融场景的高频事故。

## 七、作用域：Boot 里真正常用的只有两个

| 作用域 | 行为 | 注意 |
| --- | --- | --- |
| singleton（默认） | 全容器一个 | 有状态 Bean 是并发灾难；成员变量别存请求态 |
| prototype | 每次获取都新建 | **容器不管它的销毁回调**；被单例注入时只会创建一次，需 `ObjectProvider`/`@Lookup` 每次取新的 |

`request`/`session` 等作用域在 Web 场景用，且被单例注入时需要 scoped proxy。

## 八、例子：Bean 生命周期与注入为 null 事故（正确用法与错误用法）

```java
// 例子目的：一个 Bean 同时写三种初始化钩子，验证执行顺序；并复现"手动 new 导致注入为 null"
import jakarta.annotation.*; import org.springframework.beans.factory.*;
@Component
class LifeCycleBean implements InitializingBean, DisposableBean {
    @Autowired Dep dep;                       // 属性填充阶段注入（由 AutowiredAnnotationBeanPostProcessor 完成）
    public LifeCycleBean() { /* dep 此处还是 null，构造早于注入 */ }
    @PostConstruct void c1() { System.out.println("3 @PostConstruct"); } // BP-before 回调，最早
    public void afterPropertiesSet() { System.out.println("4 InitializingBean"); } // 其次
    @PreDestroy void cleanup() { /* 关闭时释放资源 */ }                  // 销毁阶段回调
    public void destroy() { /* DisposableBean 销毁钩子 */ }
    // 正确使用结果：控制台依次打印 3 → 4（销毁时在容器关闭才触发）
}
// 错误用法：在策略/工厂里 new LifeCycleBean() 再调方法→ dep 为 null（不走容器，@Autowired 失效）→ NullPointerException
// 错误用法：在 @PostConstruct 里 this.txMethod() 自调用→ 此时 AOP 代理尚未生成（代理在 postProcessAfter）→ 事务/@Async 注解静默失效
```

## 九、动手验证（跟着做）

1. 写一个 Bean 同时实现三种初始化写法 + `@PreDestroy`，打印顺序，验证第五、六节结论。
2. 自定义一个 `BeanPostProcessor`，在 post-after 里给实现了某接口的 Bean 打日志，观察它与 `@PostConstruct` 的先后。
3. 用 `@Autowired private ObjectProvider<Foo> foo;` 每次 `getObject()`，验证 prototype 每次新建、被单例字段注入时只新建一次的差异。
4. 开启 `graceful shutdown`，压测下线的同时 kill 进程，对比有无 `preStop` 时在途请求数。

## 十、常见线上问题与对应知识点

| 现象 | 根因方向 |
| --- | --- |
| `@Autowired` 字段为 null | 该对象是 `new` 出来的，不在容器管理范围（尤其策略/工厂里手动 new 的 Bean） |
| 代理失效（AOP/事务不生效） | 在 `@PostConstruct` 里 `this.method()` 自调用，绕过了 post-after 生成的代理 |
| 关闭时在途任务丢失 | 未开 graceful shutdown，或 K8s 宽限期小于超时被 SIGKILL |
| prototype 里的状态"共享"了 | prototype 被单例注入只创建一次，实为单例语义 |
| 循环依赖报错 | Boot 2.6+ 默认禁止；参见 spring-core 的三级缓存一节 |

## 十一、关联技术栈

- **框架层**：Spring Framework（`AbstractAutowireCapableBeanFactory` 的 doCreateBean）、**spring-core** 包的三级缓存与 AOP 代理选择
- **持久层**：MyBatis `MapperScannerConfigurer`（BFPP 注册代理）、HikariCP 的 `initializationFailTimeout`
- **可观测层**：Actuator `/beans`、`/conditions`
- **云原生层**：K8s 优雅停机（preStop / terminationGracePeriodSeconds）、lifecycle 超时
- **诊断层**：Arthas `watch` 观察 postProcess、启动期 Bean 计时
