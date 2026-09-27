# 小测验 · Jakarta EE 11 与 Web Profile

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. Jakarta EE 的本质是什么？（20分）

- A. 一款 Oracle 出品的应用服务器产品
- B. 一组由 Eclipse Foundation 治理的规范（Spec）集合，只定义 API 与契约，实现由应用服务器/库提供
- C. Spring Boot 的别名
- D. Java 的另一个 JDK 发行版

> 答案：B
> 解析：Jakarta EE 是规范集合，WildFly/WebLogic/Tomcat+Hibernate 等提供实现，这是"规范/实现分离"的核心。

### 2. 关于三档 Profile，下列归属正确的是？（20分）

- A. EJB、JTA、JMS 属于 Web Profile
- B. JAX-RS、JPA、WebSocket 属于 Web Profile；EJB/JMS/JTA 属于 Full Platform
- C. Servlet 只在 Full Platform 才有
- D. Core Profile 已包含 JPA

> 答案：B
> 解析：Web Profile = Core + JAX-RS + JPA + WebSocket + Faces + Security；EJB/JMS/JTA 等重型规范才在 Full。

### 3.（多选）关于 API 与 SPI，下列说法正确的有？（25分）

- A. API 面向应用代码，由你调用完成业务
- B. SPI 面向框架/容器实现方，是容器反向调用的扩展点
- C. JAX-RS 的自定义 `MessageBodyReader/Writer`、通用 `ServiceLoader` 属于 SPI 思想
- D. API 和 SPI 是两套互不相关的概念，一个类不可能既是 API 又是 SPI

> 答案：ABC
> 解析：D 错，同一段代码站不同视角既可能是消费者也可能是供货方，二者是相对角色而非绝对隔离。

### 4. 填空题：Java EE 捐给 Eclipse 后因 Oracle 保留 `javax.*` 商标，整体迁移到 ____.* 命名空间；Spring Boot 内嵌的 Tomcat/Jetty 本质是 ____ 规范的实现。（15分）

> 答案：jakarta / Servlet
> 解析：EE 9 起发生 `javax→jakarta` 包名大迁移；Boot 的 Web 底座仍是 Servlet 容器。

### 5. 简答题：建一张"Jakarta 规范 ↔ Spring 技术"的映射（至少 4 项），并说明什么场景仍该选 Jakarta EE 而非 Spring。（20分）

> 参考答案：
> - 映射：CDI↔Spring IoC、Servlet/JAX-RS↔Spring MVC、JPA(Hibernate)↔Spring Data JPA、JTA/`@Transactional`↔Spring 事务、Bean Validation 共用
> - 选 Jakarta 的场景：金融/电力/电信存量大机（WebLogic/WebSphere/JBoss EAP）、需认证合规、强绑定厂商支持、Full 平台一体化事务/消息
> - 新建互联网/微服务一般 Spring 生态更活跃；迁移注意 javax→jakarta 断裂
