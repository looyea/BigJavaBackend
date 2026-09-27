# BeanFactory 与 ApplicationContext

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：分得清 `BeanFactory` 与 `ApplicationContext` 的层次与能力差异；知道"容器启动"到底在做什么（定义→注册→实例化）；能解释为什么几乎所有场景都该用 ApplicationContext 而非裸 BeanFactory。
> 与 spring-boot 包的分工：Boot 包讲"自动装配把容器怎么填好"；本节回到 Spring 本体，讲容器本身的抽象层次与元数据模型。

## 一、容器的两层抽象：Bean 的"图纸"与"成品"

理解 Spring 容器的第一性原理，是分清两样东西：

- **BeanDefinition（图纸）**：一个 Bean 的元数据——类名、作用域、懒加载、构造参数、属性、init/destroy 方法、依赖来源。容器启动早期处理的全是图纸。
- **Bean 实例（成品）**：按图纸造出来、装配好、初始化好的对象，单例的被放进缓存池。

`BeanFactory` 是**最底层的容器契约**：负责持有定义、按需产出实例。`ApplicationContext` 在它之上，是**面向企业应用的全功能容器**。

```flow
BeanDefinitionRegistry（注册图纸）
→ BeanFactory（按图纸产出/管理实例，getBean 时才可能实例化）
→ ListableBeanFactory（可枚举全部 Bean）
→ ApplicationContext = 组合以上 + MessageSource(国际化) + ApplicationEventPublisher(事件) + ResourceLoader(资源) + EnvironmentAware(环境)
```

## 二、BeanFactory：极简、延迟

`BeanFactory`（典型实现 `DefaultListableBeanFactory`）本身不提供注解扫描、事件、国际化。它的最纯粹用法：

```java
// 例子目的：展示最裸的 BeanFactory 用法——只注册图纸、getBean 时才实例化
DefaultListableBeanFactory bf = new DefaultListableBeanFactory();
XmlBeanDefinitionReader reader = new XmlBeanDefinitionReader(bf);
reader.loadBeanDefinitions("beans.xml");   // 只注册 BeanDefinition（此时尚未造对象）
Object svc = bf.getBean("orderService");   // 此时才真正实例化+装配
// 正确使用结果：日志可见——loadBeanDefinitions 后单例未创建，直到 getBean 那一行才被 new 出来
// 错误用法：配置里写错依赖却用裸 BeanFactory→ 启动不报错，直到首次 getBean 才抛 NoSuchBeanDefinitionException（失去启动期校验）
```

关键特性：**默认延迟实例化**——`getBean` 时才造。这对内存敏感、启动要极快的场景友好，但缺点也明显：配置错误要到第一次用到才暴露，失去了启动期校验能力。

## 三、ApplicationContext：几乎总是该用它

`ApplicationContext`（`AnnotationConfigApplicationContext`、`ClassPathXmlApplicationContext` 等）在 BeanFactory 之上做了两件大事：

1. **启动即预实例化所有单例（非懒加载）**：`refresh()` 的 `preInstantiateSingletons()` 阶段把单例都造出来——好处是**启动期就暴露装配错误**，坏处是启动更重。
2. **提供企业级附加能力**：
   - `MessageSource`：国际化
   - `ApplicationEventPublisher`：事件解耦
   - `ResourceLoader`：统一资源加载（classpath/file/url）
   - `Environment`：属性与 profile
   - 自动注册 `BeanFactoryPostProcessor` / `BeanPostProcessor`

| 维度 | BeanFactory | ApplicationContext |
| --- | --- | --- |
| 单例实例化时机 | 延迟（getBean 时） | 启动即预实例化 |
| 注解/组件扫描 | 不内置 | 支持（配置类/扫描） |
| 事件、i18n、资源、环境 | 无 | 有 |
| BPP/BFPP 自动应用 | 需手动接线 | 自动 |
| 典型用途 | 极端省内存/框架内部 | 几乎所有应用 |

## 四、`refresh()`：容器启动的心脏

`AbstractApplicationContext.refresh()` 是 13 步模板方法，抓住主干即可（面试高频）：

1. `prepareRefresh` / `obtainEnvironment`：初始化环境、校验必要属性。
2. `prepareBeanFactory`：装好 BeanFactory、注册基础 Bean 与后置处理器。
3. `invokeBeanFactoryPostProcessors`：**所有 `BeanFactoryPostProcessor`（含配置类解析成 BeanDefinition 的 `ConfigurationClassPostProcessor`）在此运行**——图纸在这一步基本成形。
4. `registerBeanPostProcessors`：注册 BPP（AOP、Autowired 注解处理等），只注册不执行。
5. `initMessageSource` / `initApplicationEventMulticaster`。
6. `onRefresh`：模板钩子（Web 场景在这建内部组件）。
7. `registerListeners`、**`finishBeanFactoryInitialization`（预实例化所有单例，Bean 真正被造出来）**、`finishRefresh`（发布 `ContextRefreshedEvent`）。

> 记住一条主线：**先"解析/注册图纸"（步骤 3），再"注册加工器"（步骤 4），最后"批量造单例"（步骤 7）**。搞混这三步顺序，就无法理解"为什么 `BeanFactoryPostProcessor` 能看到但未实例化的定义、`BeanPostProcessor` 能加工成品"。

## 五、动手验证

1. 用裸 `DefaultListableBeanFactory` + `@Lazy` 风格的延迟语义，打日志验证：注册完定义后单例尚未创建，`getBean` 时才创建。
2. 换 `AnnotationConfigApplicationContext`，构造一个依赖缺失的配置，验证它在 `refresh()`（启动）就抛异常，而非首次使用才抛——体会"预实例化=启动期校验"。
3. 自定义一个 `BeanFactoryPostProcessor` 修改某 BeanDefinition 的 scope，和一个 `BeanPostProcessor` 给成品打标签，分别打印时机，确认前者早于实例化、后者包裹初始化。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 配置错误运行很久才暴露 | 用了裸 BeanFactory 延迟实例化，没用 ApplicationContext |
| 启动很慢 | 大量非懒加载单例在 `refresh()` 预实例化 |
| `@Value`/自定义 BFPP 改动没生效 | 时机理解错：BFPP 改的是图纸，改了个已被读走的值 |
| 事件发布收不到 | 发布器 `ApplicationEventMulticaster` 在 refresh 后才就绪，过早发布丢失 |

## 七、关联技术栈

- **容器内核**：`DefaultListableBeanFactory`、`BeanDefinition`、`AbstractApplicationContext.refresh()`
- **扩展点**：`BeanFactoryPostProcessor`、`BeanPostProcessor`（下节 s1-2 循环依赖、spring-boot s1-3 生命周期）
- **注解驱动**：`ConfigurationClassPostProcessor`、`AnnotationConfigApplicationContext`
- **Boot 层**：Spring Boot 的 `ApplicationContext` 由 `SpringApplication` 创建并 `refresh`（见 spring-boot 包）
