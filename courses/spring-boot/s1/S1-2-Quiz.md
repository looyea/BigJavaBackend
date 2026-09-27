# 小测验 · 自动配置与启动流程（混合题型示例）

> 本节小测按实际情况选择了多种题型：单选、多选、判断、填空、简答。分值显式标注，合计 100 分，≥ 60 分过关。
> 判分口径：客观题全对得分；填空题命中任一等价答案得分；简答题按参考答案要点的命中比例给分。

### 1. `SpringApplication.run()` 中，属性源（配置文件）的分层合并发生在哪个阶段？（10分）

- A. 创建 SpringApplication 对象时
- B. 准备 Environment 阶段（`prepareEnvironment`）
- C. `refresh()` 的 `finishBeanFactoryInitialization`
- D. Runner 执行阶段

> 答案：B
> 解析：ConfigDataEnvironmentPostProcessor 在准备 Environment 时把各属性源合并为一条有序链。

### 2. 自动配置候选类名的清单主要来自哪里？（10分）

- A. `web.xml`
- B. `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- C. 运行时全 classpath 反射扫描所有类
- D. `application.yml` 的 `spring.autoconfig` 节点

> 答案：B
> 解析：Boot 3.x 起用 imports 文件替代 spring.factories 中的自动配置条目，清单在打包期即确定。

### 3. 想替换某个自动配置产生的 Bean，正确做法是？（10分）

- A. `exclude` 掉整个自动配置类
- B. 定义一个同类型 Bean，让 `@ConditionalOnMissingBean` 条件不成立
- C. 反射修改 BeanDefinition
- D. 提高自己 Bean 的 `@Order`

> 答案：B
> 解析：exclude 粒度太粗会连带丢失该配置类里的其他 Bean；让条件失效才是精准替换。

### 4.（多选）启动日志停在 "Tomcat initialized with port 8080" 之后迟迟不出现 "Tomcat started"，可能的原因有？（15分）

- A. 某个 Bean 初始化时同步连接数据库且网络不通
- B. 自动配置的候选清单为空
- C. 大量非懒加载单例初始化耗时
- D. `@ComponentScan` 包路径写错

> 答案：AC
> 解析：Tomcat 已创建，说明容器就绪、问题集中在上下文 refresh 的 Bean 实例化阶段；B、D 属于更早或不同的环节。

### 5. `@ConditionalOnBean` 判定不稳定的根本原因是？（10分）

- A. 它只在测试环境生效
- B. 条件判断发生在 BeanDefinition 注册阶段，依赖配置类的解析顺序
- C. 它会触发 Bean 提前实例化
- D. 它只能用于 `@Component`

> 答案：B
> 解析：正因为如此 Boot 用 `@AutoConfigureAfter` 约束自动配置类之间的顺序。

### 6. 判断题：自动配置产生的 Bean 优先级高于用户在 `@Configuration` 中定义的同类 Bean。（5分）

- A. 正确
- B. 错误

> 答案：B
> 解析：恰恰相反，`@ConditionalOnMissingBean` 保证用户定义优先。

### 7. 填空题：启动 Spring Boot 时加入命令行参数 ____，可以在日志里打印自动配置的条件评估报告（匹配与未匹配的原因）。该报告对应的类名是 ____。（10分）

> 答案：--debug / debug
> 解析：命令行 `--debug`（等价于 `-Ddebug`）会触发 `ConditionEvaluationReportLoggingListener` 输出 DEBUG 级别的条件报告，报告对象为 `ConditionEvaluationReport`。两个空都答对方向即可得分，参考答案也可写 `ConditionEvaluationReport`。

### 8. 简答题：按顺序说出 `SpringApplication.run()` 的六个主要阶段。（15分）

> 参考答案：
> - 创建并配置 SpringApplication（推断应用类型、加载 Initializer 与 Listener）
> - 准备 Environment（配置分层与 profile 解析）
> - 创建 ApplicationContext
> - 刷新上下文 refresh（解析配置类、自动配置筛选、注册 BeanPostProcessor、实例化单例 Bean、启动内嵌容器）
> - 执行 Runner（ApplicationRunner / CommandLineRunner）
> - 发布 ApplicationReadyEvent 就绪事件

### 9. 简答题：线上应用启动需要 3 分钟，你的排查与优化步骤是什么？（15分）

> 参考答案：
> - 先定位再优化：启动期火焰图或 BeanPostProcessor 计时找出耗时 Top
> - 分类根因：外部依赖连接超时、非懒加载单例过多、扫描范围过大、初始化任务过重
> - 处理手段与副作用：懒加载需配套预热、异步初始化有风险、缩窄扫描范围、修网络与 DNS
> - 与基础设施协同：K8s 就绪探针与 startupProbe 参数匹配实测启动耗时
> - 固化：把启动时间纳入发布验收指标
