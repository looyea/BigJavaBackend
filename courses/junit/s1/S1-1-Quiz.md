# JUnit 5 架构、生命周期与断言 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. JUnit 5 三个模块中，写测试时直接依赖注解与断言 API 的是？（6分）

- A. junit-platform-launcher
- B. junit-jupiter-engine
- C. junit-jupiter-api
- D. junit-vintage-engine
> 答案：C
> 解析：api 提供 @Test/Assertions 等编写面；engine 负责运行期发现执行；platform 对接构建工具；vintage 是跑 JUnit 4 旧测试的兼容引擎。

### 2. JUnit 5 默认的测试实例模型（Lifecycle）是？（6分）

- A. PER_CLASS，整个测试类共享一个实例
- B. PER_METHOD，每个 @Test 方法 new 一个新实例
- C. SINGLETON，全 JVM 一个实例
- D. 由 @SingletonTest 指定
> 答案：B
> 解析：默认 PER_METHOD 保证用例隔离、可并行；这也是 @BeforeAll 必须 static 的原因——它要跑在任何实例创建之前。

### 3. 想让 @BeforeAll/@AfterAll 写为非 static 方法并共享实例字段，正确做法是？（6分）

- A. 给方法加 public 修饰
- B. 类上加 @TestInstance(PER_CLASS)
- C. 把字段声明为 final
- D. 改用 @BeforeEach 代替
> 答案：B
> 解析：PER_CLASS 下整类一个实例，@BeforeAll 不再需要 static；代价是要自己防用例间状态泄漏。

### 4. 断言 `assertEquals(new BigDecimal("100.0"), order.getAmount())` 中 amount 实际为 `new BigDecimal("100.00")`，结果是？（6分）

- A. 通过，数值相等即可
- B. 失败，BigDecimal.equals 同时比较值与 scale
- C. 编译错误
- D. 抛 NullPointerException
> 答案：B
> 解析：BigDecimal 的 equals 把 scale 也计入（100.0 ≠ 100.00），是经典坑；金额比较应用 `assertEquals(0, expected.compareTo(actual))`。

### 5. 要一次执行多个断言并收集全部失败（而不是第一个失败就中止），应使用？（6分）

- A. assertAll
- B. assertTrue 连续写多行
- C. assumeTrue
- D. @RepeatedTest
> 答案：A
> 解析：assertAll 聚合执行所有可执行断言，一次报出全部不满足项；连续多行 assertTrue 首个失败即抛，后面不再检查。

### 6. 相比 JUnit 4 的 `@Test(expected = XxxException.class)`，assertThrows 的优势是？（6分）

- A. 写法更短
- B. 能精确校验"哪段代码抛的"并拿回异常对象继续断言消息
- C. 性能更高
- D. 没有优势，二者等价
> 答案：B
> 解析：expected 属性无法限定抛出位置——后面任何一行意外抛同类型异常都会"假通过"；assertThrows 返回异常供继续断言。

### 7. 失败信息拼接开销大（如序列化大对象）时，应使用哪种形式的消息参数？（6分）

- A. 直接拼好字符串传入
- B. Supplier<String> 形式，仅失败时才求值
- C. String.format 预格式化
- D. 不写失败信息
> 答案：B
> 解析：`assertEquals(exp, act, () -> "详情：" + buildHugeContext())` 的成功路径零开销，消息只在断言失败时构建。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于 JUnit 5 生命周期与实例模型，说法正确的有？（9分）

- A. @BeforeEach 每个测试方法前执行，@BeforeAll 整类只执行一次
- B. PER_METHOD 下实例字段在每个测试方法间自动重置为初始值
- C. @AfterAll 在 PER_CLASS 下可以是非 static 方法
- D. @BeforeAll 默认要求 static，因为执行时尚无测试类实例
> 答案：ABCD
> 解析：四条都对；B 正是 PER_METHOD 提供用例隔离的机制——每个方法新实例，字段回到声明时的初值。

### 9. （多选）下列断言使用属于反模式或不推荐的有？（9分）

- A. 用 assertTrue(x == y) 替代 assertEquals(x, y)
- B. 用 assertThrows 验证异常类型并断言异常消息
- C. 在一个 @Test 里塞多个互不相关的被测行为
- D. 用 assertTimeout 防止被测代码意外阻塞
> 答案：AC
> 解析：A 失败只报 false 不给实际值，定位困难；C 让失败归因变难，一个用例应只测一个行为。B/D 是推荐用法。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 描述 JUnit 5 三模块的职责划分，并说明 PER_METHOD 与 PER_CLASS 两种实例模型的取舍，各给出一个适用场景。（40分）

> 参考答案：
- 要点1：jupiter-api 提供编写面（注解+Assertions），jupiter-engine 运行期发现执行，platform 对接 IDE/Maven/Gradle 并可插拔多引擎（vintage 跑 JUnit 4）；
- 要点2：拆层的意义——Spring/Mockito 以 Extension 而非自定义引擎接入，IDE 与构建工具只依赖 platform 层；
- 要点3：默认 PER_METHOD——每个 @Test 新实例，天然隔离、可安全并行，但 @BeforeAll 必须 static、无法用实例字段跨方法共享；
- 要点4：PER_CLASS——整类单例，@BeforeAll/@AfterAll 可非 static，能共享昂贵资源建一次；风险是用例间状态泄漏需自防；
- 要点5：PER_CLASS 适用场景：Testcontainers 起真数据库、重量级 IT 基类（容器整个类复用）；
- 要点6：PER_METHOD 适用场景：普通纯逻辑单元测试，零共享状态，享受隔离与并行红利。
