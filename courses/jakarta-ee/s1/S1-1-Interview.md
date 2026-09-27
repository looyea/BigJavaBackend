# 实际面试题 · Jakarta EE 11 与 Web Profile

## 题 1：Jakarta EE 和 Java EE 什么关系？为什么要改名？

**考察层次**：初级只知"改了个名"；中级能说清命名空间与商标纠纷；高级能谈规范/实现分离与生态影响。

**参考答法**：

1. 同源：Java EE 由 Sun 发起、Oracle 收购后于 2017 捐给 Eclipse Foundation。
2. 改名原因：Oracle 保留 `javax.*` 商标，Eclipse 不能继续用，故更名 Jakarta EE 并把包名整体迁到 `jakarta.*`（EE 8→EE 9 是破坏性断裂）。
3. 本质：它是一组**规范**（Servlet/JAX-RS/JPA/CDI…），由 WildFly、WebLogic、Liberty 等做**实现**——规范/实现分离。
4. EE 11 对齐 Java SE 21，进一步轻量化、云原生化，与 MicroProfile 互补。

**追问**：`javax→jakarta` 迁移最疼在哪？→ 第三方库、SPI 注册文件、部署描述符里散落的旧包名，很多老库没有 Jakarta 版，要么等要么替换。

## 题 2：Web Profile 和 Full Platform 怎么选？

**答题要点**：Profile 是规范的子集。Web Profile 覆盖绝大多数 Web 应用（Servlet+JAX-RS+JPA+CDI+Validation+WebSocket+Security）；只有当你确实依赖 **EJB、JTA 分布式事务、JMS、Batch、JCA 连接器**这类重型企业能力才上 Full。选型前用"依赖了哪些规范"清单倒推，别默认上 Full 背着 EJB 的历史包袱。

## 题 3：说说 API 和 SPI 的区别，举两个例子。

**答题要点**：API 是给**应用开发者调用**的接口（`HttpServletRequest`、`@Path`）；SPI 是**容器反向调用实现方**的扩展点（JPA `PersistenceProvider`、JAX-RS `MessageBodyReader/Writer`、Servlet `ServletContainerInitializer`、通用 `ServiceLoader`）。同一概念站不同视角可兼作二者。Spring 的 `HandlerMethodArgumentResolver`、`TypeConverter`、`spring.factories`/`ServiceLoader` 自动装配就是典型 SPI。

## 题 4：Spring 生态和 Jakarta 规范是什么关系？会冲突吗？

**结构化回答**：

1. 概念对应：IoC↔CDI、Spring MVC↔Servlet/JAX-RS、Spring Data JPA↔JPA、`@Transactional`↔JTA、Bean Validation 共用。
2. 不冲突甚至叠加：Boot 内嵌的 Tomcat/Jetty 就是 Servlet 规范实现，Spring Data JPA 底层跑的就是 JPA/Hibernate。
3. 差异在"额外提供的抽象"：Spring 提供超出规范的便利层（自动装配、starter、统一异常），排查问题时要能穿透到规范底层。

## 题 5：什么企业场景你仍会选 Jakarta EE 而不是 Spring？

**答题要点**：① 银行/电力/电信的**存量大机**（WebLogic/WebSphere/JBoss EAP），历史投资与运维体系都在 EE；② 需要**厂商商业支持 + 合规认证**（金融监管、国产化替代里常有指定应用服务器）；③ 依赖 Full 平台的**分布式事务(JTA)、JCA 连接器对接遗留系统**；④ 团队就是 EE 背景。反之新建互联网/微服务优先 Spring 生态活跃度。

## 高频追问速答

1. EE 11 要求哪个 Java 版本？→ 基线对齐 Java SE 21。
2. MicroProfile 和 Jakarta EE 关系？→ 互补：Jakarta 偏标准内核与可移植，MicroProfile 偏云原生（配置、指标、容错、JWT），常一起用。
3. JPA、Hibernate、Spring Data 三者关系？→ JPA 规范、Hibernate 实现、Spring Data 是薄封装（Repository 抽象），排查看底层。
4. CDI 的 `@Inject` 和 Spring `@Autowired` 区别？→ 都是注入，CDI 是标准、Spring 是自家容器实现，细节差异见 s1-2。
5. 老 war 能在 Boot 里跑吗？→ 不能直接，命名空间与打包模型不同，需迁移或并存的适配层。
