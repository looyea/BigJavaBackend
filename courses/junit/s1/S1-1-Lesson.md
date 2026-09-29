# JUnit 5 架构、生命周期与断言

> 本节难度：★★☆☆☆
> 重要程度：★★★★☆
> 学习产出：分清 JUnit 5 三大模块与注解生命周期，能正确使用 `@BeforeEach`/`@AfterAll`/`@TestInstance` 管理资源，用 Assertions 的多值断言与 `assertThrows` 写出精准、可读的单元测试。

## 一、三个模块各司其职

JUnit 5 = 三个协作的库，别混为一谈：

| 模块 | 职责 | 你直接接触吗 |
|------|------|-------------|
| junit-jupiter-api | 写测试用的注解与断言（@Test、Assertions） | 是 |
| junit-jupiter-engine | 运行期发现并执行测试 | 由构建工具调 |
| junit-platform | 对接 IDE/Gradle/Maven 的运行与发现层 | 间接 |

旧 JUnit 4 把 API 与实现耦合在一个 jar；5 拆开后可插拔（自定义 TestEngine，如 [Mockito](../../mockito/s1/S1-1-Lesson.md)/Spring 都以 Extension 而非引擎接入）。

## 二、生命周期与实例模型（最易踩坑）

JUnit 5 默认**每个 @Test 方法 new 一个测试类实例**（Lifecycle = PER_METHOD）。由此引出几个高频错误：

```java
class OrderServiceTest {

    static Database db;                 // 反例：想跨方法共享却写成实例字段 + PER_METHOD → 每方法重置

    @BeforeAll
    static void initAll() { db = Database.start(); }   // @BeforeAll 默认必须 static，因为要跑在任何实例之前

    @BeforeEach
    void setUp() { /* 每个用例前重置到干净状态 */ }

    @Test void create() { /*...*/ }
    @Test void cancel() { /*...*/ }

    @AfterAll
    static void closeAll() { db.stop(); }              // 全部跑完关一次，适合释放容器/连接等昂贵资源
}
```

想让 `@BeforeAll` 非 static 并共享实例状态，把类改成单例模型：

```java
@TestInstance(TestInstance.Lifecycle.PER_CLASS)   // 结果：整类一个实例，@BeforeAll/@AfterAll 可非 static
class HeavyIT {
    Testcontainers container;                      // 说明：配合 s1 的容器复用，昂贵资源建一次
    @BeforeAll void setup() { container = startMysql(); }
}
```

`PER_METHOD` 保证用例隔离（无状态污染）、可并行；`PER_CLASS` 换来共享昂贵资源的便利，但要自己防用例间状态泄漏。

## 三、断言：从"能过"到"精准可读"

```java
// 目的：断言要精确指向失败原因，而不是笼统 assertTrue
@Test
void calc() {
    int r = service.sum(2, 3);
    assertEquals(5, r);                       // 失败：expected<5> but was<...>，定位清晰
    // 反例：assertTrue(r == 5) —— 失败只告诉你 false，不给实际值，排查两眼一抹黑

    assertAll("订单校验",                     // 结果：聚合多个断言，一次报全部不满足项而非首个即停
        () -> assertEquals("PAID", order.getStatus()),
        () -> assertEquals(new BigDecimal("100.00"), order.getAmount()),
        () -> assertNotNull(order.getItems()));

    // 异常断言：验证抛的是不是预期类型，还能拿回异常继续断言消息
    var ex = assertThrows(IllegalArgumentException.class, () -> service.sum(-1, 2));
    assertTrue(ex.getMessage().contains("negative"));
}
```

- `assertEquals` 对浮点/金额要用带 delta 或 `compareTo` 的重载，别用 `equals` 卡 scale（`100.0` vs `100.00` 的 BigDecimal equals 为 false，是经典坑）；
- `assertThrows` 优于 `@Test(expected=...)`（JUnit 4 遗留写法）：后者连"哪一行抛的、消息对不对"都无法校验。

## 四、辅助断言与失败信息

`Assertions` 之外的常用武器：`assertFalse`/`assertNull`/`assertLinesMatch`（比对多行文本，如生成的报告）、`assertTimeout`（断言代码块在给定时间内完成，防意外阻塞）。失败信息用**Supplier 形式**（`assertEquals(exp, act, () -> "详情：" + ctx)`）——只在失败时才拼字符串，成功路径零开销。

## 五、命名与结构约定

- 测试方法名描述行为与预期：`shouldRejectNegativeAmount`，配合 `@DisplayName("金额为负应拒绝")` 让报告可读；
- 结构用 Given-When-Then 三段（可用 `// ARRANGE / ACT / ASSERT` 注释或 `assertAll` 分组体现）；
- 一个用例一个被测行为：往一个 `@Test` 里塞多个不相关断言，会让失败归因变难、`assertAll` 也救不回设计问题。

## 六、关联技术

参数化与动态测试在 [参数化、动态与重复测试](S1-2-Lesson.md)；扩展模型（`@RegisterExtension`/条件执行）在 [扩展模型与条件执行](S1-3-Lesson.md)；与 [Mockito 桩协作](S1-4-Lesson.md)、[Testcontainers 真依赖](../../test-containers/s1/S1-1-Lesson.md) 构成分层测试体系。
