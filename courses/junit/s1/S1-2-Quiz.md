# 参数化、动态与重复测试 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. 把 20 组数据写进一个 @Test 的 for 循环，与 @ParameterizedTest 相比，最大的损失是？（6分）

- A. 执行速度
- B. 失败时只能整方法红，报告无法定位到具体数据组
- C. 内存占用
- D. 无法使用断言
> 答案：B
> 解析：参数化让每组数据成为独立用例，失败精确到行、单组失败不阻断其余组；for 循环第一个失败即抛出且报告只有一个方法名。

### 2. 需要一个参数为"构造好的复杂 Order 对象（含 BigDecimal 与 null 分支）"的参数化测试，首选数据源是？（6分）

- A. @ValueSource
- B. @CsvSource
- C. @MethodSource
- D. @EnumSource
> 答案：C
> 解析：@MethodSource 返回 Stream\<Arguments\>，类型安全且能直接给任意对象；CSV 只能表达字符串再靠转换，null/引号需额外约定。

### 3. @CsvSource 中想表达 null 参数，正确做法是？（6分）

- A. 直接写空字符串，自动是 null
- B. 通过 nullValues 属性声明哪个字面量代表 null
- C. 写 "null" 永远自动生效
- D. CSV 不支持 null
> 答案：B
> 解析：默认空串即 null，但语义模糊；规范做法是 `@CsvSource(nullValues = "NULL", ...)` 显式声明占位符，避免与真实空串混淆。

### 4. @RepeatedTest(100) 的典型用途是？（6分）

- A. 100 组不同输入的数据驱动
- B. 同一输入重复执行，暴露幂等/随机/并发偶发问题
- C. 提升覆盖率数字
- D. 替代参数化转换器
> 答案：B
> 解析：重复测试不接收不同数据（那是参数化的职责），价值在抓"只在某些轮次出现"的偶发缺陷，可注入 RepetitionInfo 拿轮次。

### 5. @TestFactory 生成的 @DynamicTest，其生命周期特点是？（6分）

- A. 每条动态用例都跑一次 @BeforeEach
- B. 所有动态用例共用一次外层生命周期，@BeforeEach 只跑一次
- C. 动态用例不能被报告展示
- D. 动态用例必须 static
> 答案：B
> 解析：动态用例相当于都长在同一个"宿主"执行体内，没有独立的实例级回调；需要隔离时应改用参数化或拆工厂。

### 6. 要单独禁用某一条动态用例，可行的方式是？（6分）

- A. 给它加 @Disabled
- B. 在工厂流里 filter 掉该数据
- C. 加 @Tag("skip")
- D. 在它上面写 @Test
> 答案：B
> 解析：@Disabled/@Tag 等注解无法作用于运行期生成的 DynamicTest，注解只影响整个工厂方法；跳过逻辑要写进数据流。

### 7. 参数为 Duration、枚举、基本类型的 CSV 值能直接注入，是因为？（6分）

- A. 反射强制转换
- B. JUnit 内置参数转换器（ImplicitArgumentConverter 体系）自动完成
- C. Jackson 反序列化
- D. 需要手写 Converter 才行
> 答案：B
> 解析：常见类型开箱即转；复杂类型才用 @ConvertWith 自定义转换器，或直接换 @MethodSource 给对象。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于参数化测试的说法正确的有？（9分）

- A. name 模板（如 `[{index}] {0}`）决定报告中每条用例的展示名
- B. @EnumSource 可用 modes 取枚举的补集/子集
- C. 参数化方法的每个参数必须都是同一种类型
- D. 聚合执行（aggregationMode）可减少每条参数的生命周期开销
> 答案：ABD
> 解析：C 错——Arguments.of 可混合类型，方法形参各声明各的；其余三项均为参数化的真实能力。

### 9. （多选）以下哪些场景适合 @DynamicTest 而不是 @ParameterizedTest？（9分）

- A. 用例数据来自运行期扫描的配置目录文件
- B. 用例数据要连数据库查询后才确定条数
- C. 固定 10 组边界值表
- D. 希望每条用例都能被 @Tag 独立过滤
> 答案：AB
> 解析：数据运行期才知道才用动态测试；C 用参数化即可且能被 IDE/Tag 静态发现；D 恰恰是动态测试做不到的。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 对比 @ParameterizedTest、@RepeatedTest、@DynamicTest 三者的定位与选型依据，并各给一个业务场景。（40分）

> 参考答案：
- 要点1：@ParameterizedTest——编译期已知的数据矩阵，每组一个独立用例，失败定位到数据行；场景：订单状态机各迁移合法性表；
- 要点2：数据源谱系——ValueSource 单列、CsvSource 内联多列、CsvFileSource 外置表、MethodSource 类型安全首选、EnumSource 枚举全覆盖；
- 要点3：@RepeatedTest——同输入多轮执行，抓幂等/随机/并发偶发问题，不承载不同数据；场景：库存扣减接口重复调用 100 次验证幂等键；
- 要点4：@DynamicTest（@TestFactory）——用例名与条数运行期生成，共用一次生命周期、无法被 Tag 单独过滤；场景：扫描 conf 目录逐个验证配置文件可解析；
- 要点5：选型主线：数据编译期已知→参数化；未知/依赖环境→动态；数据固定只想重跑→重复；
- 要点6：三者可组合：TestFactory 内部照样能循环构建，但注意别把"for 循环断言"伪装成动态测试失去独立性的同时又不产生真实用例名。
