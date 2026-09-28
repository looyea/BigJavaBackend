# 与 Mockito/Testcontainers/Spring Boot Test 协同（关联）

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：能画出"JUnit 为骨架、三大件各管一层"的测试技术地图，说清 Jupiter Extension 为何是协同枢纽，并给出一套单元→切片→集成三层测试的组合配方与常见互踩坑。

## 一、一张图看清分工

JUnit 5 自己不做替身、不起容器、不装依赖注入——它是**运行框架与断言语法**，其余三位都以 Extension 身份挂到它的生命周期上：

| 组件 | 解决的问题 | 接入方式 | 挂在哪 |
|------|-----------|----------|--------|
| Mockito | 隔离被测类的协作者 | MockitoExtension | ParameterResolver（注入 @Mock） |
| Spring Boot Test | 组装真实 IoC/Web/JPA 环境 | SpringExtension | BeforeAll/Each +  TestInstancePostProcessor |
| Testcontainers | 提供真数据库/中间件 | @Testcontainers 或静态字段 | BeforeAll 级资源管理 + Ryuk 回收 |

协同的本质 = 这些扩展在同一个生命周期时间线上按注册顺序各干各的活。

## 二、三层测试的组合配方

```java
@Testcontainers
@SpringBootTest                      // 结果：Meta 注解里含 @ExtendWith(SpringExtension)，起精简上下文
@ActiveProfiles("test")
class OrderIT {
    @Container                       // 目的：真 MySQL 归 Testcontainers 管，别用 H2 假装 MySQL
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0");

    @DynamicPropertySource           // 说明：容器随机映射端口回填给 Spring 的 datasource.url
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", mysql::getJdbcUrl);
    }

    @MockitoSpyBean PaymentClient pay;   // 真依赖进容器，唯一切到外部网关的协作者用 Spy 打桩
    // 反例：把整个上下文里所有 Bean 都换 Mock——那就退化成 Spring 装配的单元测试，集成验证归零
}
```

配方按层拆：**纯单元**（JUnit+Mockito，毫秒级，跑业务分支矩阵）→ **Web 切片**（@WebMvcTest + @MockitoBean，验序列化/校验/状态码）→ **数据切片/集成**（@DataJpaTest 或上面这种 @SpringBootTest+容器，验 SQL、事务、迁移脚本）。

## 三、协同时的四个互踩坑

1. **strictness vs 生命周期**：MockitoExtension 默认 STRICT_STUBS，PER_METHOD 下每用例新建 mock 集；有人为"省内存"把 mock 提为 static——跨用例残留打桩触发 UnnecessaryStubbingException，正解是让 @MockitoSettings 调策略而不是共享实例。
2. **上下文缓存与容器复用**：@SpringBootTest 按配置指纹缓存上下文，容器若是实例字段会导致"上下文缓存了、容器却跟着旧实例死了"；静态单例容器 + `@DynamicPropertySource` 才与缓存语义对齐（详见 [Testcontainers](../../test-containers/s1/S1-1-Lesson.md)）。
3. **@Nested 与外层扩展**：内嵌类的 @Mock 注入依赖外层实例状态时用 PER_CLASS，否则每层各 new 实例、字段注入看不见外层初始化。
4. **Tag/条件注解错层**：给"纯 Mockito 单元"打上 integration Tag，它会被 PR 流水线排除——本该秒级反馈的用例反而不在主干门禁里跑；分层标记要与耗时/依赖真实对应。

## 四、选型判断：真依赖还是替身？

判据一句话：**被测逻辑与依赖的"契约交互"是否需要被验证**。只关心"我拿到返回值后怎么算"→ Mock 给个假值即可；关心"SQL 真的建得出表、跑得出计划、JSON 列能存能取"→ 必须真容器。MySQL 方言函数、Flyway 迁移、事务传播都是 H2/Mock 联拦不住的经典漏网鱼。

## 五、关联技术

Mock 本体与 strictness 在 [Mock/Spy/Stub 与 when/verify](../../mockito/s1/S1-1-Lesson.md) 与 [静态/final Mock、strictness 与过度 Mock](../../mockito/s1/S1-3-Lesson.md)；切片注解详解在 [Spring Boot 切片测试（关联 JUnit）](../../mockito/s1/S1-4-Lesson.md)；容器生命周期在 [Testcontainers 与集成测试](../../test-containers/s1/S1-1-Lesson.md)；扩展机制本身在 [扩展模型与条件执行](S1-3-Lesson.md)。
