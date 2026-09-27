# 实际面试题 · IoC 容器与 Bean 生命周期

## 题 1：讲讲 Spring Bean 的生命周期

**考察层次**：初级背"实例化、初始化"；中级能分清 `BeanPostProcessor` 前后、 Aware、初始化三种写法的顺序；高级能指出代理生成点、循环依赖化解点，并关联到线上问题。

**参考答法（3 分钟内）**：定义注册 → BFPP 加工 → 实例化（构造器）→ 属性填充 → Aware 回调 → BP-before → 初始化（`@PostConstruct`→`afterPropertiesSet`→`initMethod`）→ BP-after（**AOP 代理在此**）→ 进单例池 → 使用 → 销毁（`@PreDestroy`→`destroy`）。循环依赖在实例化与填充之间由三级缓存处理，只覆盖单例 setter。

**追问**：为什么 `@PostConstruct` 里 `this.method()` 事务不生效？→ 代理还没套上，且自调用不走代理。

## 题 2：`BeanFactoryPostProcessor` 和 `BeanPostProcessor` 有什么区别？

**答题要点**：前者在实例化**之前**、操作 `BeanDefinition`（改"图纸"，如占位符解析、Mapper 扫描注册）；后者在**每个 Bean 创建过程中**、操作成品对象（注入、绑定、AOP 代理）。一个管类，一个管实例。

**加分**：`BeanDefinitionRegistryPostProcessor` 比 BFPP 更早，能动态注册新的 BeanDefinition（`@MapperScan`、`@Enable*` 家族常用）。

## 题 3：线上发布时偶尔丢几个请求，怀疑和生命周期有关，怎么查？

**结构化回答**：

1. 确认关闭路径：进程是优雅 `SIGTERM` 还是被 `SIGKILL`（K8s 宽限期不足会 SIGKILL，`@PreDestroy` 不执行）。
2. 看是否开 `server.shutdown=graceful` 且 `timeout-per-shutdown-phase` 合理。
3. 检查注册中心反注册时机：应先摘流量再停容器（preStop sleep + Nacos/Eureka 下线）。
4. 排查 `@PreDestroy` 里是否有阻塞/超时（如刷盘、MQ 关闭），拖过了宽限期。
5. 结合电商/金融场景强调：丢请求=丢单/丢账，必须闭环到发布验收。

## 高频追问速答

1. 构造器注入 vs 字段注入？→ 构造器注入保证不可变、便于单测、能在构造期暴露循环依赖，Boot 官方推荐。
2. 一个 Bean 能被多个 `BeanPostProcessor` 处理吗？→ 能，按 `Ordered`/`@Order` 串联成链，注意自定义处理器的顺序。
3. `@Bean` 方法参数怎么注入？→ 按类型从容器解析，`@Qualifier` 消歧；本质走的是依赖查找而非字段注入。
4. 懒加载 `spring.main.lazy-initialization` 能上生产吗？→ 只建议测试环境用（掩盖启动期问题、首请求变慢），生产要的是针对性懒加载 + 预热。
