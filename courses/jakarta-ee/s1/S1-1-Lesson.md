# Jakarta EE 11 与 Web Profile

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：说清 Jakarta EE 是什么、由谁治理、EE 11 相对 Java EE 的关键变化；分层记住 Core/Web/Full 三档 Profile 各含哪些规范；分清 API 与 SPI；建立"Jakarta 规范 ↔ Spring 技术"的映射表，并能在存量企业（金融/电力大机）与新建互联网系统之间做出选型与迁移判断。

## 一、Jakarta EE 到底是什么

Java EE 由 Sun 发起、Oracle 收购后于 2017 年捐给 **Eclipse Foundation**，因 Oracle 保留 `javax.*` 商标，改名为 **Jakarta EE** 并整体迁到 `jakarta.*` 命名空间。它不是某个产品，而是一组**规范（Specification）**的集合——规范只定义 API 与契约，由应用服务器/库提供**实现**（如 WildFly、WebLogic、Open Liberty、Tomcat+Hibernate 组合）。

```flow
规范 (Spec)  ──定义──▶  API 接口 + 行为契约
                              │  实现
                              ▼
      应用服务器 / 库 (WildFly · WebLogic · Tomcat+Hibernate · Open Liberty)
                              │  部署
                              ▼
                        你的 .war / .jar
```

**EE 11 关键坐标**：规范基线对齐 **Java SE 21**（虚拟线程、record、模式匹配可用）；延续 EE 9/10 的 `jakarta.*` 大迁移；进一步瘦身对遗留技术的强制要求、强化轻量与云原生取向（MicroProfile 与之互补）。

## 二、三档 Profile：规范不是铁板一块

Profile = 面向某类应用的一组规范的**子集**。选档决定你要实现的 API 面。

| Profile | 面向 | 代表规范 |
| --- | --- | --- |
| **Core** | 最小内核 | Servlet、CDI、Validation、JSON-P/B、Annotation、EL、Interceptor、DI |
| **Web Profile** | Web 应用（绝大多数） | Core + **JAX-RS**（REST）、**JPA**、**WebSocket**、Faces、Security |
| **Full Platform** | 大型一体化 | Web + **EJB**、**JTA** 事务、**JMS**、Batch、Concurrency、Connectors(JCA)、Mail、Auth |

> 记住：**Web Profile 是日常主战场**（Servlet + JAX-RS + JPA + CDI + Validation）；只有需要 EJB/JMS/JTA 全套容器能力才上 Full。

## 三、API 与 SPI：一面调用，一面扩展

- **API**（Application Programming Interface）：面向**应用代码**，你调用它完成业务。例：`jakarta.servlet.Servlet`、`jakarta.ws.rs.GET`、`@PersistenceContext`。
- **SPI**（Service Provider Interface）：面向**框架/容器实现方**，定义扩展点，容器反过来调用你或第三方提供的实现。例：JPA 的 `PersistenceProvider`、JAX-RS 的 `Provider`（自定义 `MessageBodyReader/Writer`）、Servlet 3.0 的 `ServletContainerInitializer`、以及通用的 `ServiceLoader`。

**心智**：同一段代码，用 API 是"消费者"，实现 SPI 是"供货者"。Spring 里大量 `*Resolver`、`*Converter`、`ApplicationContext` 的 `Aware`/后置处理器也对应这种双向关系（呼应 spring-core）。

## 四、Jakarta ↔ Spring 映射：规范与"事实标准"的分工

Spring 长期不在规范内，却是"事实标准"。二者概念高度对应：

| 能力 | Jakarta 规范 | Spring 对应 |
| --- | --- | --- |
| 依赖注入 | CDI（`@Inject`/`@Named`/`@Qualifier`） | Spring IoC（`@Autowired`/`@Component`） |
| Web/REST | Servlet、JAX-RS | Spring MVC / WebFlux |
| 持久化 | JPA（Hibernate 实现） | Spring Data JPA（套在 JPA 上） |
| 事务 | JTA / `@Transactional`(EE) | Spring `@Transactional` |
| 校验 | Bean Validation | 直接用同一套（Jakarta Validation） |
| 消息 | JMS | Spring for Kafka/RabbitMQ |
| 切面/拦截 | Interceptors | Spring AOP |

> **分工说明**：Boot 内嵌的 Tomcat/Jetty/Undertow 本质是 **Servlet 规范的实现**——你写 Spring MVC，底下仍是 Servlet 容器（详见 spring-mvc s1-1）。CDI 与 Spring IoC 的差异、拦截器细节留到 s1-2 展开。

## 五、例子：JAX-RS 资源（API）与 ServiceLoader SPI（正确用法与错误用法）

```java
// 例子目的：并排展示"用 API（JAX-RS 资源）"与"供 SPI（ServiceLoader 扩展点）"两面，并暴露 javax→jakarta 迁移坑
import jakarta.ws.rs.*; import jakarta.ws.rs.core.MediaType; // 正确用法：EE 9+ 必须用 jakarta.*（错误用法：仍 import javax.ws.rs.* → 新版服务器启动 NoClassDefFoundError）

@Path("/hello")                    // API：面向应用代码，容器回调它处理请求
@Produces(MediaType.TEXT_PLAIN)
public class HelloResource {
    @GET                           // 映射 HTTP GET
    public String hi(@QueryParam("name") String name) {
        return "hello " + name;    // 正确使用结果：GET /hello?name=Tom 返回纯文本 "hello Tom"
    }
    // 错误用法：忘加 @Produces 且返复杂对象又无 JSON Provider → 406 Not Acceptable
}

// SPI：面向扩展方，容器反向加载你的实现——与 API 的"消费"方到"供货"方
public interface GreetingProvider { String greet(String name); }

class Loader {
    void load() {
        var it = ServiceLoader.load(GreetingProvider.class).iterator(); // 从 META-INF/services 读实现（错误用法：忘配 services 文件 → 迭代器为空、扩展静默不生效）
        while (it.hasNext()) { System.out.println(it.next().greet("EE")); } // 正确使用结果：逐个调用已注册的 SPI 实现
    }
}
// 心智回扣：同一段代码，用 API 是"消费者"，实现 SPI 是"供货者"；Boot 内嵌的 Tomcat 本质就是 Servlet 规范的实现。
```

## 六、动手验证

1. 打开某 EE 应用服务器的 `lib` 或 `modules` 目录，找出 Servlet、JPA、CDI 各自的 API jar 与实现 jar，体会"规范/实现分离"。
2. 写一个 `@Path("/hello")` 的 JAX-RS 资源和一个 `@RestController` 的 Spring 端点，并排对比注解风格与启动方式。
3. 用 `ServiceLoader` 加载一个自定义 SPI，感受容器"反向调用供货方"的扩展模型。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 迁移后类全部 `ClassNotFoundException` | `javax.*`→`jakarta.*` 包名大迁移，依赖/配置未全量替换（EE 9 起断裂） |
| WAR 在新版 WildFly 启动报命名空间 | 仍引用旧 `javax` 命名空间的库，需用 Jakarta 版或转换器 |
| 以为"用了 JPA 就是 Spring 生态" | JPA 是规范、Hibernate 是实现、Spring Data 只是薄封装，排查要看底层 |
| Full 平台老系统迁到轻量运行时缺 EJB/JTA | Profile 选档判断失误，未清点依赖的规范 |

## 八、关联技术栈

- **容器实现**：WildFly、WebLogic、WebSphere、Open Liberty、Tomcat/Jetty（Servlet）
- **规范内核**：Servlet、JAX-RS、JPA、CDI、Bean Validation（见 s1-2）
- **对照 Spring**：spring-core（IoC/AOP）、spring-mvc（Servlet 链路）、spring-boot（内嵌容器与自动装配）
- **互补生态**：MicroProfile（云原生可观测/配置，呼应 spring-boot s2-3）
- **迁移工具**：`javax→jakarta` 转换器、OpenRewrite 规则
