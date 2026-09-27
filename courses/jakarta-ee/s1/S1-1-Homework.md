# 作业题 · Jakarta EE 11 与 Web Profile

## 作业 1：规范/实现分离体检（必做）

选一款应用服务器（WildFly 或 Open Liberty），完成：

- 列出它实现了 Web Profile 的哪些规范，指出每个规范对应的 API jar 与实现 jar
- 找到"规范之外"的厂商私有扩展（管理控制台、专有部署描述符）
- **产出**：一张"规范 → API 包 → 实现包"的清单，标出哪些是标准、哪些是私货

## 作业 2：JAX-RS vs Spring MVC 并排实现（必做，本节核心）

同一个"订单查询 REST 接口"，分别用 JAX-RS（`@Path/@GET/@Produces`）和 Spring MVC（`@RestController/@GetMapping`）各实现一遍：

- 对比：路由声明、内容协商、参数绑定、异常处理（`ExceptionMapper` vs `@ControllerAdvice`）
- 说明 Boot 内嵌 Tomcat 时，Spring MVC 底下走的是哪套规范
- **验收标准**：一份"同一功能、两套注解"的并排对照表 + 迁移时最痛的 3 个点

## 作业 3：javax→jakarta 迁移评估（必做）

给定一个仍在 `javax.*` 命名空间的传统 EE 工程（可自建 demo）：

1. 清点所有 `javax.servlet`/`javax.persistence`/`javax.validation` 引用点
2. 用迁移工具（OpenRewrite / jakartaee-migration）做一次转换，记录仍需手工处理的部分（配置、SPI 注册、第三方不兼容库）
3. 给出"能否平滑迁到 EE 11"的风险清单
- **产出**：迁移可行性评估报告（≤1 页）

## 作业 4：选型论证（选做，架构师向）

为一笔"电力调度后端"新系统与一个"银行存量核心改造"分别做技术选型：在 Jakarta EE（Full/Web Profile + 应用服务器）与 Spring Boot 之间取舍。从团队技能、厂商支持、合规认证、生态活跃度、可移植性、锁定风险六个维度打分并给结论。

## 作业 5：API 还是 SPI？（选做）

翻一份 JPA 与 JAX-RS 规范文档，各找出 2 个"给应用用的 API"和 2 个"给容器/库实现方用的 SPI"，说明 Spring 中哪些机制（`*Resolver`、`TypeConverter`、`BeanPostProcessor`、`ServiceLoader`/`spring.factories`）与之对应，写一段 200 字的"消费者 vs 供货者"心智总结。
