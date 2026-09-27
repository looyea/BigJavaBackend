# 实际面试题 · BeanFactory 与 ApplicationContext

## 题 1：BeanFactory 和 ApplicationContext 有什么区别？

**考察层次**：初级背"一个功能多一个功能少"；中级能说实例化时机与附加能力；高级能讲 refresh 主干与背后的取舍。

**参考答法**：

1. 层次：`BeanFactory` 是最底层容器契约（持有定义、产出实例）；`ApplicationContext` 在其上组合了 `ListableBeanFactory`、`MessageSource`、`ApplicationEventPublisher`、`ResourceLoader`、`Environment`。
2. 单例时机：BeanFactory 默认延迟到 `getBean` 才实例化；ApplicationContext 在 `refresh()` 预实例化所有非懒加载单例——所以配置错误启动即暴露。
3. 注解/事件/国际化/资源/自动注册 BPP·BFPP，都是 ApplicationContext 才开箱提供。
4. 结论：除极端省内存场景，都用 ApplicationContext。

**追问**：预实例化的代价是什么？→ 启动更重更慢，需要时用 `@Lazy` 或全局懒加载 + 预热平衡。

## 题 2：说说 `refresh()` 都干了什么？

**答题要点（抓主干）**：准备环境与 BeanFactory → `invokeBeanFactoryPostProcessors`（BFPP 加工定义，配置类在这被解析成 BeanDefinition）→ `registerBeanPostProcessors`（只注册不跑）→ 初始化消息源/事件广播器 → `onRefresh`（Web 建内部组件）→ `finishBeanFactoryInitialization`（预实例化单例，Bean 真正被造）→ `finishRefresh`（发布 ContextRefreshedEvent）。一句话：**先成形图纸、再注册加工器、最后批量造实例**。

## 题 3：BeanFactoryPostProcessor 与 BeanPostProcessor 到底差在哪？

**答题要点**：

| 维度 | BeanFactoryPostProcessor | BeanPostProcessor |
| --- | --- | --- |
| 作用对象 | BeanDefinition（图纸） | Bean 实例（成品） |
| 时机 | 实例化之前 | 每个 Bean 初始化前后 |
| 典型 | `ConfigurationClassPostProcessor`、属性占位符 | AOP 代理、`AutowiredAnnotationBeanPostProcessor` |

**加分**：`@Autowired` 注入其实是 BPP 干的；`@Configuration` 解析成定义是 BFPP 干的——把注解魔法还原到扩展点上，是区分背过和懂过的分水岭。

## 题 4：为什么配置错误有时启动就炸、有时跑了很久才炸？

**结构化回答**：

1. 取决于容器类型与是否懒加载：ApplicationContext 预实例化 → 大部分装配错误启动即炸。
2. `@Lazy` Bean、原型 Bean、或用了裸 BeanFactory → 首次使用才实例化 → 运行期才暴露。
3. 治理：核心链路 Bean 不要懒加载，让问题在 CI 启动冒烟阶段就被抓；对确需懒加载的，配启动预热钩子主动触发一次。

## 高频追问速答

1. `getBean` 一个 prototype 会走完整生命周期吗？→ 实例化+装配+初始化回调会，但容器不托管其销毁，需调用方自理。
2. 容器里 Bean 的默认作用域？→ singleton（每容器一个实例），受预实例化管理。
3. `ApplicationContext` 能有父子吗？→ 能，`ParentApplicationContext`，查找 Bean 先本容器后向上，事件默认不向父传播。
4. 组件扫描在哪个阶段生效？→ BFPP 阶段的 `ConfigurationClassPostProcessor` 解析 `@ComponentScan` 注册定义。
5. refresh 能被调用多次吗？→ 活动期重复调用被拒；`ConfigurableApplicationContext.refresh()` 语义是"（重）启动"，已关闭的可刷新。
