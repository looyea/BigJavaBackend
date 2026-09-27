# 小测验 · Spring Boot 是什么，它解决了什么问题

共 8 题，单选为主，满分 100 分，≥ 60 分通过。

### 1. Spring Boot 的核心定位是什么？

- A. 提供新的 Web MVC 编程模型
- B. 自动化 Spring 工程的依赖装配与应用启动
- C. 替代 Spring Framework 的 IoC 容器
- D. 一种新的 JVM 运行时

> 解析：Boot 不提供新的业务功能，Web 层仍是 Spring MVC，容器仍是 Spring 的 IoC，它做的是装配与启动的自动化。

### 2. 一个 Boot 应用对外提供 HTTP 接口时，实际处理请求的组件是？

- A. Spring Boot 自带的 DispatcherHandler
- B. Tomcat 的 Catalina Handler
- C. Spring MVC 的 DispatcherServlet
- D. Netty ChannelPipeline

> 解析：内嵌 Tomcat 只负责接收连接与 Servlet 规范实现，请求分发处理仍由 Spring MVC 的 DispatcherServlet 完成。

### 3. 依赖版本自洽主要依靠什么机制？

- A. `spring-boot-starter-parent` / `spring-boot-dependencies` 这份 BOM
- B. Maven 的最近优先原则
- C. `@AutoWire` 注解
- D. classpath 扫描顺序

> 解析：BOM 里集中声明了各第三方库互相兼容的版本号，子工程引依赖不必写 version。

### 4. 启动类必须放在项目根包下，原因是？

- A. Java 语言规范要求
- B. `@ComponentScan` 默认只扫描该类所在包及其子包
- C. Maven 打包只会包含根包
- D. 反射无法访问子包中的类

> 解析：包结构就是扫描边界，放在子包外的类不会被扫到，这是新手最高频的坑。

### 5.（多选）`@SpringBootApplication` 由以下哪些注解组合而成？

- A. `@SpringBootConfiguration`
- B. `@ComponentScan`
- C. `@EnableAutoConfiguration`
- D. `@EnableWebMvc`
- E. `@ConfigurationProperties`

> 解析：D 是 Spring MVC 手动开启注解，Boot 自动装配已包含；E 是绑定配置用的，与启动类无关。

### 6. `@ConditionalOnMissingBean` 的作用是？

- A. 只要有该 Bean 就装配
- B. 用户未定义该 Bean 时才装配自动配置的 Bean
- C. 缺失该类时抛异常
- D. 强制覆盖用户配置

> 解析：它保证自动配置永远排在用户配置之后，把优先权让给开发者显式定义的 Bean。

### 7. Boot 3.x 相比 2.x 的重大变化，以下哪项正确？

- A. 包命名空间由 `jakarta.*` 改回 `javax.*`
- B. 最低要求 JDK 8
- C. Java EE 包名由 `javax.*` 迁移到 `jakarta.*`，且要求 JDK 17+
- D. 不再支持 Maven

> 解析：这是升级最大成本项，所有依赖 `javax.servlet` 等的代码与第三方库都需替换。

### 8. 以下哪个场景最不适合直接使用默认配置的 Spring Boot？

- A. 需要对外提供 REST 接口的中型业务系统
- B. 对冷启动时间要求为毫秒级的 Serverless 函数
- C. 微服务集群中的标准运行时
- D. 内部管理后台

> 解析：Boot 启动需反射扫描大量类，冷启动偏慢，毫秒级要求应考虑 GraalVM 原生镜像等方案。

## 答案

1. B
2. C
3. A
4. B
5. ABC
6. B
7. C
8. B
