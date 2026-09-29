# 参数化、动态与重复测试

> 本节难度：★★☆☆☆
> 重要程度：★★★★☆
> 学习产出：能用 `@ParameterizedTest` 的五种数据源与 `@MethodSource` 写类型安全的用例表，用 `@DynamicTest` 处理运行期才确定的数据，并说清参数化相比"for 循环塞进一个 @Test"在失败定位与报告上的本质优势。

## 一、为什么不用 for 循环：参数化的本质收益

把 20 组边界值写进一个 @Test 的 for 循环，只要第 17 组失败，整个方法红掉且报告只有一个方法名。参数化让**每组数据是一个独立用例**：

```java
@ParameterizedTest(name = "[{index}] 输入 {0} → 期望 {1}")   // 报告里逐条展示，失败精确定位到第几组
@CsvSource({
    "1, 2, 3", "0, 0, 0", "-1, -1, -2",                      // 目的：每组三列——加数A、加数B、期望和
    "100, 200, 300", "2147483647, 1, FAIL"                   // 反例预埋：溢出行为单独一条用例验证
})
// 说明：数据行数 = 用例数，每行按列自动转成方法参数类型；报告里 [{index}] 直接对上需求矩阵行号
// 反例：把 expected 设计成字符串再用 if-else 解析业务语义，是"该升级 @MethodSource"的信号——类型信息早该在数据源里保留
void sum(int a, int b, String expected) {                    // CsvSource 的列自动完成字符串→目标类型转换
    if ("FAIL".equals(expected)) {
        assertThrows(ArithmeticException.class, () -> Math.addExact(a, b));
    } else {
        assertEquals(Integer.parseInt(expected), Math.addExact(a, b));
    }
}
```

三个收益：失败即定位到具体数据行；单组失败不影响其余组执行；报告数据本身就是需求矩阵的映射。

## 二、五种数据源怎么选

| 数据源 | 形态 | 适用 |
|--------|------|------|
| @ValueSource(ints/strings/…) | 单参数列表 | 一列边界值 |
| @CsvSource | 内联多列 | 少量用例、类型简单 |
| @CsvFileSource | 外部 csv 文件 | 用例表大、非程序员可维护 |
| @MethodSource | 同类静态方法返回 Stream/Collection | **首选**：类型安全、可造复杂对象 |
| @EnumSource | 枚举全集/子集 | 对每个枚举值跑同一断言 |

`@CsvSource` 的隐藏坑：引号/逗号转义、null 字面量要用 `nullValues = "NULL"` 显式声明；多列复杂对象别硬塞 CSV，直接升级 @MethodSource：

```java
static Stream<Arguments> orderProvider() {          // 目的：方法源天然类型安全，能返回任意构造好的对象
    return Stream.of(
        Arguments.of(new Order("PAID", new BigDecimal("100.00")), true),
        Arguments.of(new Order("REFUNDED", new BigDecimal("10.00")), false),
        Arguments.of(null, false)                    // 异常/空输入分支也能表达，CSV 里只能靠约定字符串
        // 说明：方法源默认要求同测试类的静态方法；跨类复用写全限定名 @MethodSource("com.xx.CaseProvider#orders")
    );
}

@ParameterizedTest
@MethodSource("orderProvider")
void canCancel(Order order, boolean expected) {
    // 结果："可取消"的需求表与这段代码同构——新增分支就是新增一行 Arguments，评审即验收
    assertEquals(expected, service.canCancel(order));
}
```

## 三、聚合执行与重复测试

- 数据量大且想减少每条参数的 setup/teardown 开销时，JUnit 5.10+ 的 `@ParameterizedTest` 提供聚合执行（`aggregationMode` 属性），把整套参数收进一个类级生命周期，配合 @BeforeAll 只建一次昂贵资源；
- `@RepeatedTest(value = 100)` 用同一输入重复执行——测幂等、随机分支、并发下的偶发 bug，方法参数可注入 `RepetitionInfo` 拿当前轮次；它不接收不同数据，别和数据驱动混用。

## 四、@DynamicTest：运行期决定用例

数据要连数据库/读目录才知道有几条时，静态注解无法提前声明，用动态测试：

```java
@TestFactory
Stream<DynamicTest> eachConfigFileIsValid() {       // 目的：用例名与数量在运行期生成
    return Files.list(Paths.get("conf")).map(p ->
        DynamicTest.dynamicTest("配置可解析: " + p.getFileName(),
            () -> assertDoesNotThrow(() -> parser.parse(p))));
    // 反例：在 lambda 外做断言不生效；DynamicTest 不能用 @Disabled/Tag 单独过滤，
    // 需要跳过某条时在工厂流里 filter 掉——注解作用于整个工厂方法
    // 说明：@TestFactory 方法不能同时标 @Test（语义冲突直接报错）；返回 List/DynamicNode 皆可，Stream 最省内存
}
```

要点：动态用例执行时共用一个测试实例（相当于都在同一个 @Test 的"体内"），@BeforeEach 只跑一次，**别指望每条动态用例有独立生命周期**。

## 五、参数转换与展示名

基本类型、枚举、`Duration`（"PT5S"）、临时日期等 JUnit 内置自动转换；复杂类型用 `@ConvertWith(XxxConverter.class)` 或干脆 @MethodSource 直接给对象。展示名模板 `{argumentIndex}`、`{0}`、`{argumentsWithNames}` 控制报告可读性——参数化报告的标题就是评审时的需求追溯表。

## 六、关联技术

断言本体在 [JUnit 5 架构、生命周期与断言](S1-1-Lesson.md)；按条件跳过某组参数、用扩展注入参数在 [扩展模型与条件执行](S1-3-Lesson.md)；配合 [Mockito 的参数匹配器](../../mockito/s1/S1-1-Lesson.md) 注意别把"给 mock 打桩的入参"和"参数化用例的入参"混在一个循环里——那是可读性灾难。
