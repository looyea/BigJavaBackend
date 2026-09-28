# JUnit 5 架构、生命周期与断言 · 面试题

## 题 1：JUnit 5 和 JUnit 4 的本质区别是什么？

- 架构上拆成三层：platform（发现/运行、对接 IDE 与构建工具）、jupiter-api（编写面注解与断言）、jupiter-engine（执行引擎），可插拔多引擎，vintage 引擎负责兼容跑旧 4 测试；
- 能力上：@TestInstance 实例模型、@Nested 嵌套、扩展模型从 RunListener/Rule 换成统一的 Extension API、断言聚合 assertAll、参数化成为一等公民（内置在 jupiter-params）；
- 加分：能说出"迁移 JUnit 5 只需换依赖坐标与注解包名，测试逻辑基本不动"，以及 Maven surefire 需 2.22+ 才原生支持 platform。

## 题 2：@BeforeAll 为什么默认必须是 static？怎么解除这个限制？

- 默认实例模型是 PER_METHOD——每个测试方法创建一个新的测试类实例，而 @BeforeAll 要在所有方法之前执行，此刻还没有任何实例可挂载方法，所以只能属于类本身（static）；
- 解除方式：类上 @TestInstance(PER_CLASS)，整类共享一个实例，@BeforeAll/@AfterAll 即可非 static，还能访问实例字段；
- 加分：指出 PER_CLASS 的代价——用例间共享状态需自己清理（常见泄漏：上一步用例改了字段，下一步断言基于脏数据），且该类不能再安全开并行。

## 题 3：assertEquals(new BigDecimal("100.0"), new BigDecimal("100.00")) 结果如何？为什么？

- 失败。BigDecimal.equals 同时比较数值与 scale（精度位数），100.0 与 100.00 scale 不同故不等，尽管 compareTo 结果为 0；
- 正确写法：金额比较用 `assertEquals(0, expected.compareTo(actual))`，或统一规范 scale 后再比；浮点则用带 delta 的重载；
- 加分：这题考察"断言要表达业务相等语义而非对象 equals 语义"，JSON/序列化里 scale 常被保留，坑会在 CI 里偶发。

## 题 4：assertAll 和顺序写多个断言的区别与使用时机？

- 顺序断言第一个失败立刻抛出，后面的检查不再执行；assertAll 把多个可执行断言聚合，一次报告全部失败项（内部是 MultipleFailuresError）；
- 时机：验证同一个对象的多个属性（状态、金额、条目数）时用 assertAll，一轮就能看到所有不符合项，减少"改一个跑一次"的往返；
- 加分：指出边界——assertAll 救不了"一个方法测多个不相关行为"的设计问题，那是拆用例的信号；且有依赖关系的前置条件不能放 assertAll（后续断言可能 NPE）。

## 题 5：@Test(expected=...) 与 assertThrows，面试官问"哪个更好"时怎么答？

- assertThrows 更好：expected 只声明"这个测试里会抛这种异常"，测试末尾任何一行意外抛同类型异常都会假通过，且拿不到异常对象；
- assertThrows 精确圈定抛出代码块，并返回异常实例可继续断言消息与错误码，异常-业务分支的测试可读性也更强；
- 加分：进一步说"assertDoesNotThrow 反向断言 + 异常消息里带业务码"能覆盖契约测试场景；JUnit 5 已直接不提供 expected 属性，只有 @Test 语义。

## 题 6：一个集成测试要启动 Testcontainers 数据库并在全部用例后销毁，你怎么组织生命周期？

- 朴素写法：@BeforeAll static 起容器 + @AfterAll static 销毁，PER_METHOD 下可行但容器与测试类绑定；
- 更优：@TestInstance(PER_CLASS) 让 @Container 字段/初始化非 static 化，或直接用 Testcontainers 的 @Testcontainers + 静态单例容器模式跨测试类复用（配合 Ryuk 兜底回收）；
- 加分：提到 spring.testcontainers.dynamic-property 注入、以及"昂贵资源建一次、用例只清数据不重建容器"的分层思路——这是单元测试与集成测试速度差异的关键。
