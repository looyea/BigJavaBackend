# Spring Boot 切片测试（关联 JUnit）

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：掌握 `@WebMvcTest`/`@DataJpaTest` 等切片注解"只装一类 Bean"的机制与 `@MockitoBean` 顶替协作者的用法，会用 MockMvc/WebTestClient/TestRestTemplate 三档入口，并给出切片与 `@SpringBootTest` 的升级判据。

## 一、切片的核心卖点：上下文只装该装的那一小撮

全量 `@SpringBootTest` 起 IoC 全家桶（数据源、MQ、定时任务…），分钟级且配置一点没对齐就红。切片用 TypeExcludeFilter 只加载某一层的自动配置与组件：`@WebMvcTest` 装 Controller/Converter/Jackson + MockMvc，Service 一律要你给替身；`@DataJpaTest` 装 Entity/Repository + 内嵌式事务回滚。Spring Boot 3.4 起顶替 Bean 用 `@MockitoBean`（类/接口级，替代已废弃的 `@MockBean/@SpyBean`）：

```java
@WebMvcTest(OrderController.class)                 // 目的：只装这个 Controller 及 Web 层设施，秒级起上下文
class OrderControllerTest {
    @Autowired MockMvc mvc;                        // 说明：不占真端口，直接喂 MockHttpServletRequest
    @MockitoBean OrderService service;             // 结果：Controller 依赖的 Service 被 Mockito 顶替注入

    @Test
    void rejectsNegativeAmount() throws Exception {
        mvc.perform(post("/orders").contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\": -1}"))                      // 反例数据：绕过 Controller 手测校验器会漏掉这条链路
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.code").value("ORDER_AMOUNT_INVALID"));
    }
}
```

这条用例真正验证的是：JSON 绑定 → `@Valid` 触发 → 异常处理器 → 响应体契约，四层粘合全在 Mockito 单测的盲区里。

## 二、@DataJpaTest 的两只手

默认**事务回滚**（每个用例后回滚，用例互不脏）+ 自动内嵌数据库替换。两个高频操作：测"唯一索引冲突"这种必须真提交的场景用 `@Rollback(false)` 或 `TestTransaction`；MySQL 方言/迁移脚本场景把内嵌库换成 [Testcontainers](../../test-containers/s1/S1-1-Lesson.md)：

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)     // 目的：不替换数据源，吃 @DynamicPropertySource 注入的真 MySQL
class OrderRepoIT { /* 配 @Testcontainers + MySQLContainer，验证 JSON 列与 ON DUPLICATE KEY */ }
```

## 三、三档调用入口的强度梯度

MockMvc（切片内，无端口，验 MVC 契约）→ `@SpringBootTest(webEnvironment=RANDOM_PORT)` + TestRestTemplate/WebTestClient（真 HTTP 栈，验过滤器/序列化端到端）→ 真容器集成。别在 MockMvc 上测过滤器链（`@AutoConfigureMockMvc(addFilters=false)` 有人为了快关掉安全过滤——测出来的绿和生产不是一回事）。

## 四、切片的漏网之鱼与升级判据

切片不装：AOP 切面、跨层事件监听、Cache 配置、`@Async`、真实连接池行为。判据一句话：**用例失败时如果把替身换成真 Bean 就不会红，说明它本该是集成测试**；反之 Service 单测（纯 Mockito，不起上下文）永远该保持毫秒级——切片是"装配层"的测试，别把业务矩阵搬进来。

## 五、关联技术

`@MockitoBean` 背后的 Mock 语义在 [Mock/Spy/Stub 与 when/verify](S1-1-Lesson.md)；与 JUnit 扩展的挂接在 [扩展模型与条件执行](../../junit/s1/S1-3-Lesson.md)；真依赖升级路线在 [与 Mockito/Testcontainers/Spring Boot Test 协同（关联）](../../junit/s1/S1-4-Lesson.md)。
