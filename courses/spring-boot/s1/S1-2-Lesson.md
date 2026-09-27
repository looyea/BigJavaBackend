# 自动配置机制与 SpringApplication.run 启动流程

> 本节难度 ★★★★☆ · 重要性 ★★★★★
> 学习产出：能画出 Boot 启动的六个阶段，说清自动配置候选从哪来、被谁筛掉、Bean 何时就绪。

## 一、先看全景：一次启动经历了什么

```flow
SpringApplication.run() -> 1. 创建 Application（推断类型/加载 Initializer 与 Listener）
2. 准备环境 Environment -> 3. 创建 ApplicationContext -> 4. 刷新上下文 refresh()
（加载配置类 -> 自动配置筛选 -> BeanFactoryPostProcessor -> 实例化单例 Bean）
-> 5. 执行 Runner（ApplicationRunner / CommandLineRunner）-> 6. 发布就绪事件，服务可对外
```

对应到日志上，你会看到熟悉的三行：

```
The following 1 profile is active: "dev"
Tomcat initialized with port 8080 (http)
Tomcat started on port 8080 (http) with context path '/'
Started HelloApplication in 1.843 seconds (process running for 2.104)
```

**读日志的能力就是排障的能力**：卡在 "Tomcat initialized" 之后，说明问题在 Bean 初始化阶段（比如连不上数据库）；到了 "Tomcat started" 但接口 404，说明 Web 层映射或扫描范围有问题。

## 二、阶段 1：应用类型推断与 SPI 加载

`new SpringApplication(mainClass)` 内部做三件事：

1. **推断应用类型**：根据 classpath 判断 `SERVLET` / `REACTIVE` / `NONE`。这也是国内面试常问点——同一个工程引入 `spring-boot-starter-web` 与 `-webflux` 时，默认走 Servlet 栈。
2. **加载 ApplicationContextInitializer**：通过 `SpringFactoriesLoader`（Boot 3.x 后为 `META-INF/spring/...Imports` 与 `spring.factories` 混合机制）读取，全部放入集合，稍后按 `@Order` 排序执行。**这是 Spring 生态最重要的扩展点之一**，你写的每一个 starter 都靠它注入。
3. **加载 EventListener 并绑定 `SpringApplicationRunListeners`**：启动过程的每个节点都会广播事件（`ApplicationStartingEvent`、`ApplicationEnvironmentPreparedEvent`、`ApplicationPreparedEvent`、`ApplicationReadyEvent`、`ApplicationFailedEvent`）。第三方组件（如 SkyWalking 探针、Nacos 客户端）就是靠监听这些事件在正确时机接入的。

## 三、阶段 2：Environment 准备——配置的分层在这里完成

`ConfigDataEnvironmentPostProcessor` 负责解析 `application.yml` / `application-{profile}.yml` / 配置中心导入项，构建 `PropertySource` 链。

关键点：

- **多源合并成一条有序链表**，取值时从头往下找，先命中者胜。这解释了"为什么命令行能覆盖 yml"。
- `spring.profiles.active` 本身也可以来自命令行/环境变量，因此**profile 的确定早于 profile 专属文件的加载**。
- Boot 2.4+ 引入 `spring.config.import`，配置中心（Nacos/Consul）从"特殊适配"变成"统一导入语法"。老项目里靠 `bootstrap.yml` 提前加载配置中心的做法在新版本已不推荐。

> 特别注意：如果你在 `EnvironmentPostProcessor` 里改配置，务必设置足够靠前的 `@Order`，否则你的修改会被后续的属性源加载覆盖，造成"代码明明执行了但配置没变"的诡异现象。

## 四、阶段 3-4：上下文创建与 refresh（真正的重头戏）

`refresh()` 是 Spring Framework 的方法，共 12 步，Boot 的价值体现在其中三步：

| 步骤 | 做什么 | 与 Boot 的关系 |
| --- | --- | --- |
| `invokeBeanFactoryPostProcessors` | 执行 `BeanDefinitionRegistryPostProcessor` | `ConfigurationClassPostProcessor` 在此解析所有 `@Configuration`，**自动配置类也是在这一步被"展开"成 BeanDefinition 的**；MyBatis 的 `@MapperScan` 代理注册同样发生在这里 |
| `registerBeanPostProcessors` | 注册后置处理器 | AOP 代理、`@Autowired` 注入、`@ConfigurationProperties` 绑定都依赖它们 |
| `finishBeanFactoryInitialization` | 实例化所有非懒加载单例 | 绝大多数"启动慢""启动报错"的真实发生地；循环依赖也在此暴露 |

### 自动配置的完整筛选链

```flow
读取 AutoConfiguration.imports 得到候选全类名 -> AutoConfigurationImportSelector
去重(exclude) -> @ConditionalOnClass 过滤 -> @ConditionalOnBean/OnMissingBean 过滤
-> @ConditionalOnProperty 过滤 -> 排序(AutoConfigureOrder / Before / After)
-> 生成 ConfigurationClass 并入解析 -> 注册 BeanDefinition
```

三个工程含义：

1. **`exclude` 只能排除顶层自动配置类**，不能排除其中的单个 `@Bean`；要替换某个 Bean，正确做法是自己定义同类型 Bean 让 `@ConditionalOnMissingBean` 失效。
2. **条件判断发生在 BeanDefinition 阶段，而非实例化阶段**，所以 `@ConditionalOnBean` 对"顺序"敏感——被依赖的 Bean 定义若还没注册，条件就不成立。Boot 用 `@AutoConfigureAfter` 解决这个先后问题，自己写 starter 时同理。
3. **候选清单在打包期就已确定**，这是 GraalVM 原生镜像能做 AOT 处理的前提：AOT 阶段直接把满足条件的配置类结果固化，跳过运行时反射扫描，这也是原生镜像启动毫秒级的原因。

## 五、阶段 5-6：Runner 与就绪

- `ApplicationRunner`（参数被解析成 `ApplicationArguments`）与 `CommandLineRunner`（裸 `String[]`）在所有单例初始化完成后、就绪事件之前执行。
- 多个 Runner 用 `@Order` 或 `Ordered` 控制顺序。
- **架构层面的判断**：Runner 适合"启动后一次性动作"（预热缓存、注册消费者、加载字典）。把重量级初始化塞进 Runner 会拖长就绪时间，K8s 就绪探针若配置了较短 `initialDelaySeconds` 会误判失败并反复重启。更合理的做法是懒加载 + 分批预热 + 探针参数匹配实测启动耗时。

## 六、关键类速记

| 类 | 职责 |
| --- | --- |
| `SpringApplication` | 启动流程编排者，持有类型、Initializer、Listener、跑完整个 run |
| `BootstrapRegistry` | 早期（上下文创建前）就能使用的对象容器，`SpringBootContextLoader` 用它传递 |
| `ConfigDataEnvironmentPostProcessor` | 配置分层与 profile 解析的执行者 |
| `AutoConfigurationImportSelector` | 自动配置候选加载与条件筛选的入口 |
| `ConfigurationClassPostProcessor` | 解析配置类、把 `@Bean` 变成 BeanDefinition |
| `ConditionEvaluationReport` | 记录每条条件的匹配结果，`--debug` 输出的就是它 |
| `SpringFactoriesLoader` | Spring 版 SPI，Boot 扩展机制的地基 |

## 七、动手验证（跟着做，别只看）

1. 在 `main` 第一行打断点，单步跟 `SpringApplication.run`，在 IDE 里确认前面图中的六个阶段分别停在哪一行。
2. 自定义一个 `ApplicationListener<ApplicationReadyEvent>`，打印启动总耗时与 Bean 总数，理解"就绪"的准确时点。
3. 用 `--debug` 启动，在条件报告中定位 `RedisAutoConfiguration` 的匹配情况；然后排除它（`@SpringBootApplication(exclude = RedisAutoConfiguration.class)`），再对比报告变化。
4. 写一个 `BeanPostProcessor` 打印任意一个 Bean 的初始化前后耗时，观察它如何介入实例化流程——这是 APM 探针埋点的原理雏形。

## 八、常见线上问题与对应本节知识点

| 现象 | 根因方向 |
| --- | --- |
| 启动卡住无报错，最后连接超时 | 阶段 4 的 Bean 初始化里同步连外部依赖（DB/Redis/MQ），网络不通 |
| 启动变慢但一直能起来 | 大量非懒加载单例 + 反射扫描；考虑 `spring.main.lazy-initialization`（仅测试环境） |
| 循环依赖报错在 Boot 3 出现而 Boot 2 没有 | Boot 3 默认关闭 `spring.main.allow-circular-references`，本节阶段 4 的实例化顺序相关 |
| 配置中心里的值没生效 | 阶段 2 的属性源顺序，或导入时机晚于使用时机 |
| 自己 starter 的 Bean 没被创建 | `@AutoConfigureAfter` 缺失导致 `@ConditionalOnBean` 判定失败 |

## 九、关联技术栈

- **框架层**：Spring Framework（`refresh()` 12 步、`BeanPostProcessor`）、Spring Boot Actuator（`/actuator/conditions`）
- **构建层**：Maven 依赖的 scope 与 `provided`（影响 classpath 判定，进而影响条件装配）
- **云原生层**：GraalVM Native Image AOT、K8s 就绪探针
- **诊断层**：Arthas `stack`/`watch` 观察 `refresh` 内部、Async-Profiler 的启动期火焰图
- **中间件层**：Nacos 配置导入、MyBatis `@MapperScan`、Redisson 客户端初始化
