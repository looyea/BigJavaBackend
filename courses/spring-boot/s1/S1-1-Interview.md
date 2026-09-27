# 实际面试题 · Spring Boot 定位与起步

> 收录于 2024—2026 年国内中大厂 Java 后端真实面试，含追问链。答题要点不是背结论，而是展示"你知道这套机制的边界在哪"。

## 题 1：为什么用 Spring Boot，它解决了什么核心问题？

**期望时长**：2 分钟

**答题要点**：

- 一句话定位：Spring 生态的装配与启动层，解决工程复杂度而非业务表达能力。
- 四条具体收益：BOM 依赖版本自洽、自动配置消除样板、内嵌容器带来自包含产物、Actuator 提供生产端点。
- 加分项：主动说明代价——装配过程黑盒化、冷启动偏慢、约定被破坏后排查成本反超。

**追问链**：

1. "自动配置"到底自动在哪？→ 从 `AutoConfiguration.imports` 加载候选 → `@Conditional` 系列过滤 → 注册 BeanDefinition。
2. 我怎么知道某个 Bean 是自动配置给我的还是我自己写的？→ `--debug` 看 `ConditionEvaluationReport`；`@Autowired` 处看 IDE 的 bean 来源；运行时 `getBeanDefinition` 的 `resource` 指向哪个 jar。

## 题 2：`@SpringBootApplication` 拆解一下？

**期望时长**：90 秒

**答题要点**：三个组合注解各自职责 + 启动类包位置决定扫描边界。

**追问链**：

1. 多模块项目里公共模块的 Bean 扫不到怎么办？→ `scanBasePackages` 显式指定 / 在公共模块提供 `AutoConfiguration.imports` 做成自己的 starter（**架构师答案**）。
2. 为什么"做 starter"比"改扫描路径"更好？→ 显式装配清单可版本化、可条件化、不依赖调用方的包结构。

## 题 3：Boot 的配置文件加载顺序，线上想临时改端口怎么做？

**答题要点**：命令行 > JVM 参数 > 环境变量 > profile 文件 > 主文件 > 默认值；线上临时改端口用启动参数 `--server.port=`，K8s 场景改 env 或 ConfigMap 后滚动。

**追问链**：

1. 配置不生效的排查顺序？→ 是否 profile 未激活 → 是否被更高优先级源覆盖 → key 是否拼写/缩进 → 是否 Binder 绑定的对象不是 Bean（`@ConfigurationProperties` 类必须被注册）。
2. 敏感配置如何管理？→ 配置中心加密 + 环境变量注入 + 绝不落库进 git；引出 Nacos / Vault。

## 题 4：Spring Boot 和 Spring Cloud 是什么关系？

**答题要点**：Boot 是单应用的装配与运行时底座，Cloud 是"多应用之间"的治理组件集合（注册发现、网关、熔断、配置、分布式事务）；Cloud 以 starter 形态构建在 Boot 之上，Boot 的 BOM 与 Cloud 的 BOM 存在版本对应表，混版是国内现场事故高发点。

**追问链**：Boot 3 / Cloud 2022 的分水岭是什么 → `jakarta` 命名空间迁移、网关从 Zuul 1 转向 SCG、Ribbon 被 LoadBalancer 取代。

## 题 5：你如何在遗留项目里推动升级到最新 Boot？

**开放题，考察工程判断力**

**答题要点（按此结构回答即高分）**：

1. 摸底：列出所有 `javax.*` 直接引用、二方包版本、隐式依赖容器行为的部分。
2. 拆解路径：先升 JDK（17 → 21），再升 Boot 大版本，最后清理历史 workaround，每步单独可回滚。
3. 保障：先补测试（尤其接口契约与序列化行为），灰度发布 + 双跑对账。
4. 度量：启动时间、RT P99、GC 停顿、错误率作为升级验收指标。
5. 决策边界：什么情况下判定"不升"——依赖的闭源中间件不支持 JDK 17+，且替换成本高于收益。

## 高频判断题（快速作答，对/错 + 一句理由）

1. Spring Boot 应用必须以可执行 jar 方式运行。
2. 加了 `spring-boot-starter-security` 后所有接口默认需要认证。
3. `@SpringBootTest` 只加载被 `@Configuration` 标记的类，不触发自动配置。
4. 自动配置的 Bean 优先级高于用户在 `@Configuration` 中定义的同类 Bean。
5. 内嵌 Tomcat 的线程数无法调整。

<details>
<summary>参考答案</summary>

1. ✘ 也可以 war 部署到外置容器（继承 `SpringBootServletInitializer`），只是不推荐。
2. ✔ 默认全部拦截，这是"依赖即配置"的典型体现。
3. ✘ `@SpringBootTest` 会启动完整应用上下文，包含自动配置（切片测试 `@WebMvcTest` 才是部分加载）。
4. ✘ 恰恰相反，`@ConditionalOnMissingBean` 保证用户定义优先。
5. ✘ 可通过 `server.tomcat.threads.max` 等配置调整，引出高并发下线程模型话题。

</details>
