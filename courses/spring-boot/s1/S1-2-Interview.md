# 实际面试题 · 自动配置与启动流程

## 题 1：说一下 Spring Boot 的启动流程

**考察层次**：初级答"run 一下就好了"；中级能说出六阶段；高级能把每阶段与线上问题对应起来。

**参考答法（控制在 3 分钟内）**：

1. 构造 `SpringApplication`：推断应用类型（Servlet/Reactive/None），通过 SPI 加载 Initializer 与 Listener。
2. `run(args)`：广播 starting 事件 → 准备 Environment（配置分层在这完成）→ 创建上下文 → 把主配置类和自动配置候选注册进上下文 → `refresh()`。
3. `refresh()` 是 Spring 的核心：解析配置类生成 BeanDefinition → 注册 BeanPostProcessor → 实例化非懒加载单例。
4. 内嵌容器在 `refresh()` 的 `onRefresh()` 阶段创建并启动端口监听。
5. 执行 Runner，广播 `ApplicationReadyEvent`，应用可对外服务；失败则广播 `ApplicationFailedEvent` 并退出。

**追问**：Bean 的创建时机是什么时候？→ 引申单例/懒加载/`@PostConstruct` 与 BeanPostProcessor 的顺序。

## 题 2：自动配置的原理，如果让你写一个 starter 怎么做？

**答题要点**：

- 原理：`@EnableAutoConfiguration` → `AutoConfigurationImportSelector` → 读取 `AutoConfiguration.imports` → `@Conditional` 系列筛选 → 注册 BeanDefinition。
- 自己写 starter 的四件套：`@ConfigurationProperties` 配置类 + 自动配置类 + `AutoConfiguration.imports` 注册 + `@ConditionalOnMissingBean` 保留用户覆盖权。
- 关键细节：条件判断在 BeanDefinition 阶段，需要 `@AutoConfigureAfter` 保证顺序；提供 `spring-configuration-metadata` 让 IDE 有提示。

**加分**：说明为什么"starter 不依赖调用方的包结构"是团队级组件复用的前提。

## 题 3：线上应用启动要 3 分钟，你怎么排查与优化？

**结构化回答（这题真正考的是方法论）**：

1. 先定位而非猜测：启动期火焰图（Async-Profiler）或 `BeanPostProcessor` 计时，找出耗时 Top 阶段。
2. 常见根因分类：外部依赖连接超时（DB/Redis/MQ 地址不通或 DNS 慢）、大量非懒加载单例、类扫描范围过大（`@ComponentScan` 扫了 jar 巨多的包）、安全组件初始化、`@PostConstruct` 里的预热任务。
3. 优化手段与副作用：懒加载（首请求变慢，需配套预热）、异步初始化非关键 Bean（依赖关系风险）、缩窄扫描范围、修网络与 DNS、升级客户端版本。
4. 与基础设施协同：K8s 就绪探针 `initialDelaySeconds` / `startupProbe` 必须匹配实测启动耗时，否则出现"永远起不来"的重启循环。
5. 度量与固化：把启动时间纳入发布验收，防止回潮。

## 题 4：`exclude` 一个自动配置类和覆盖它产生的 Bean，有何区别？

**答题要点**：exclude 是粗粒度关掉整个配置类（连带其中所有 `@Bean` 与它引入的其他配置），风险是误伤；覆盖 Bean 是利用 `@ConditionalOnMissingBean` 的让位约定做精准替换，是推荐做法。

**追问**：被 exclude 的配置类如果通过 `@Import` 被其他配置引用会怎样？→ 排除失效，因为 `@Import` 是显式引入，不走自动配置筛选链。

## 题 5：Boot 3 为什么默认禁止循环依赖？你觉得该开回来吗？

**答题要点**：

- 背景：Boot 2.6 起 `spring.main.allow-circular-references` 默认 false，因为三级缓存解决的只是**单例 setter 循环依赖**，且掩盖了设计问题（构造器循环依赖本就无解）。
- 危害：Bean 初始化顺序隐式化、AOP 代理与循环依赖叠加时行为难以预测、启动过程难以推理。
- 决策：不建议直接开回来。优先重划边界（拆出第三个 Bean、引入事件或接口解耦）；确需过渡期开放，应设为 TODO 并挂上治理工单——这是架构师该表现的态度。

## 高频追问速答

1. `@Order` 能控制自动配置类的加载顺序吗？→ 不能，用 `@AutoConfigureBefore/After`；`@Order` 影响的是拦截器、Runner、Listener 等。
2. Bean 的创建顺序能依赖吗？→ 不能，用 `@DependsOn` 只是应急，正解是显式构造注入表达依赖。
3. 启动期能拿到配置中心的值吗？→ 取决于阶段 2 的导入时机，`spring.config.import` 早于 Bean 创建，`bootstrap.yml` 老机制在 Boot 2.4+ 需显式开启。
4. 内嵌 Tomcat 何时开始监听端口？→ `refresh()` 中的 `onRefresh()` → `WebServerStartStopLifecycle`，注意此时 Runner 还没执行，所以"端口已开但预热未完成"是真实存在的窗口，正是就绪探针要解决的问题。
