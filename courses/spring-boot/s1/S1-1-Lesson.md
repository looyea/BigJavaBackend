# Spring Boot 是什么，它解决了什么问题

> 本节难度 ★☆☆☆☆ · 重要性 ★★★★★
> 学习产出：能独立从零搭建并跑通一个 Spring Boot 4.1 工程，说清 Boot 的定位与边界。

## 一、这门技术是干什么的

Spring Boot 是 **Spring 生态的装配与启动层**。它不提供新的业务功能，Web 层仍然是 Spring MVC，数据访问仍然是 Spring Data JPA 或 MyBatis，事务仍然是 Spring TX。Boot 做的事情只有一件：

**把"要用哪些 Bean、它们怎么连起来、服务怎么起来"这套繁琐的工程装配工作自动化掉。**

一个直观对比：2013 年前后搭一个能对外提供 HTTP 接口的 Spring 应用，你需要准备 `web.xml`、`applicationContext.xml`、单独安装并配置 Tomcat、手动引入十几个 `pom` 依赖并解决版本冲突。而今天用 Boot，一个 `@SpringBootApplication` 类 + 一个 `main` 方法 + 内嵌 Tomcat 就是一次可执行 `jar`。

```java
@SpringBootApplication
public class HelloApplication {
    public static void main(String[] args) {
        SpringApplication.run(HelloApplication.class, args);
    }
}
```

## 二、它解决了什么问题

Boot 解决的从来不是"写业务代码"的问题，而是 **工程复杂度** 的问题，具体拆成四点：

1. **依赖版本地狱**：`spring-boot-dependencies` 这份 BOM 为上百个第三方库锁定了彼此兼容的版本号，你只需声明"我要 web"，不必关心 `jackson` 与 `spring-web` 哪个版本能配。
2. **重复样板配置**：`@EnableAutoConfiguration` 根据 classpath 里存在哪些类，自动装配对应的 Bean（看到 `spring-webmvc` 就装 DispatcherServlet，看到 HikariCP 就装 DataSource）。
3. **容器与部署形态**：内嵌 Servlet 容器使交付物从"war 包 + 外部环境"退化为"一个自包含的可执行 jar"，天然适配 Docker 与 K8s。
4. **运行时不可观测**：Actuator 直接提供健康检查、指标、环境信息等生产端点，不必自己写探活接口。

> 换个角度记：**Spring 框架解决"对象如何协作"，Spring Boot 解决"工程如何起步与交付"。**

## 三、优缺点与适用规模

| 维度 | 说明 |
| --- | --- |
| 优点 | 起步极快、约定优于配置、依赖版本自洽、部署产物自包含、云原生友好、生态最全 |
| 缺点 | 自动装配是"黑盒"，出问题时排查链路长；依赖被隐式引入使 jar 体积偏大；启动需反射扫描大量类，冷启动比原生应用慢 |
| 不适合 | 极重度的 GUI 富客户端、对启动时间毫秒级敏感的场景（此时转向 GraalVM 原生镜像或 Quarkus） |
| 适用规模 | 小型：单个 jar 快速交付；中型：多模块 + 配置中心；大型：作为微服务的标准运行时底座 |

需要特别注意的一点：**Boot 的便利性建立在"约定"之上**。一旦团队开始大量覆盖默认配置（自定义 `WebServerFactory`、手写 `spring.factories` 排除项），你就在支付"约定失效"的代价——这时它的复杂度会反超手写 XML 的时代。架构师评估要不要用 Boot，通常不是问"能不能用"，而是问"我们是否愿意遵守它的约定"。

## 四、动手：从 Hello World 到可执行 jar

按顺序完成，每一步都要看到结果再继续。

### 步骤 1：生成工程

访问 `https://start.spring.io`（Boot 4.1 默认主线），选择：

- Project: Maven，Language: Java，Version: 21 或更高
- Packaging: **Jar**，Java: 21
- Dependencies: `Spring Web`

点 Generate 下载解压。注意生成的 `pom.xml` 里父 POM 是 `spring-boot-starter-parent`，这就是版本自洽的来源。

### 步骤 2：写第一个接口

```java
@RestController
class HelloController {
    @GetMapping("/hello")
    public Map<String, Object> hello() {
        return Map.of("msg", "Hello, Big Java Backend", "ts", System.currentTimeMillis());
    }
}
```

### 步骤 3：本地运行

```bash
mvn spring-boot:run
```

看到类似输出即成功：

```
Tomcat started on port 8080 (http) with context path '/'
Started HelloApplication in 1.843 seconds (process running for 2.104)
```

浏览器访问 `http://localhost:8080/hello`。

### 步骤 4：打成可执行 jar 并运行

```bash
mvn clean package -DskipTests
java -jar target/hello-0.0.1-SNAPSHOT.jar --server.port=9090
```

命令行参数 `--server.port=9090` 已经是一次配置覆盖——这就是 Boot 的配置注入方式之一。

### 步骤 5：暴露健康端点

加入依赖 `spring-boot-starter-actuator`，无需任何代码，访问 `http://localhost:9090/actuator/health` 得到 `{"status":"UP"}`。

## 五、自动装配的最小原理（为下一节铺垫）

`@SpringBootApplication` 是三个注解的组合，理解这三个就理解了 Boot 的骨架：

- `@SpringBootConfiguration`：本质是 `@Configuration`，声明这个类是 Bean 定义来源。
- `@ComponentScan`：扫描该类的 **同包及子包**。这就是为什么启动类必须放在根包下——放错位置会导致你的 Controller 扫不到，这是新手最高频的坑。
- `@EnableAutoConfiguration`：通过 `AutoConfigurationImportSelector` 读取候选配置清单（Boot 3.x 起位于 jar 内的 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`），再用条件注解过滤，最终只把满足条件的配置类注册进容器。

条件注解是自动装配的"开关"，常见的有：

| 注解 | 含义 |
| --- | --- |
| `@ConditionalOnClass` | classpath 存在某类才装配 |
| `@ConditionalOnMissingBean` | 用户没定义时才装配（把优先权让给你的配置） |
| `@ConditionalOnProperty` | 配置项满足条件才装配 |
| `@ConditionalOnWebApplication` | 是 Web 应用才装配 |

`@ConditionalOnMissingBean` 是整套机制里最关键的约定：**自动配置永远排在用户配置之后**。

## 六、特别注意点

1. **启动类包位置**：`@ComponentScan` 默认只向下扫描，包结构即扫描边界。
2. **依赖即配置**：多引一个 starter 就多一批自动配置，可能带来意外行为（比如引入了 `security` 后所有接口突然要认证）。排查思路是看启动日志的 `ConditionEvaluationReport`。
3. **配置文件优先级**：命令行 > 环境变量 > `application-{profile}.yml` > `application.yml` > 默认值。搞错顺序会造成"改了配置不生效"的经典事故。
4. **Boot 3/4 与 2.x 的分水岭**：包名 `javax.*` → `jakarta.*`、要求 JDK 17+、Actuator 端点安全策略更严。老项目升级时这是最大成本项。

## 七、关联技术栈

本小节只列出关联项，后续课程包会逐个展开：

- **语言层**：Java 17+（record、sealed、模式匹配）、注解与反射、SPI 机制
- **构建层**：Maven（BOM / 父 POM 依赖管理）、Gradle、`spring-boot-maven-plugin`
- **框架层**：Spring Framework（IoC/AOP）、Spring MVC、Spring Security、Spring Data
- **容器层**：内嵌 Tomcat / Jetty / Undertow、可执行 jar 的 `Loader` 结构
- **数据层**：HikariCP、MyBatis-Plus、Redis（Lettuce / Redisson）
- **可观测层**：Micrometer、Actuator、Prometheus、Grafana
- **云原生层**：Docker、Kubernetes 探针、GraalVM 原生镜像、虚拟线程
- **测试层**：`@SpringBootTest`、JUnit 5、Testcontainers

## 八、本节小结

Spring Boot = **Starter 依赖聚合 + 自动配置 + 内嵌容器 + Actuator**，本质是消除工程起步与交付的重复劳动。它把"配置"变成"约定 + 少量覆盖"，让 Java 应用以自包含产物形态进入云原生环境。

下一节我们把 `SpringApplication.run()` 拆开，逐阶段看它到底做了什么。
