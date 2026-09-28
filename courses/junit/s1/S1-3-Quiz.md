# 扩展模型与条件执行 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. JUnit 5 为 Mockito/Spring/Testcontainers 提供接入能力的统一机制是？（6分）

- A. Runner 与 RunListener
- B. Extension API（一组可选回调接口）
- C. Java Agent
- D. AOP 切面
> 答案：B
> 解析：Jupiter 把横切能力收敛为 Extension 标记接口 + BeforeEach/ParameterResolver 等回调 SPI；RunListener/Rule 是 JUnit 4 的旧机制。

### 2. 想让测试方法声明 `@RandomPort int port` 自动获得注入值，应实现哪个扩展接口？（6分）

- A. InvocationInterceptor
- B. TestExecutionListener
- C. ParameterResolver
- D. BeforeEachCallback
> 答案：C
> 解析：ParameterResolver 的 supportsParameter 判定命中后，resolveParameter 的返回值即注入该参数；@TempDir、Mockito 的 @Mock 都走这条路。

### 3. @ExtendWith 与 @RegisterExtension 的关键差别是？（6分）

- A. 前者性能更好
- B. @RegisterExtension 以字段注册，可传构造参数做配置、可控顺序
- C. 后者只能用于 static 字段
- D. 二者完全等价
> 答案：B
> 解析：@ExtendWith 只接收 Class 由框架无参实例化；字段注册能 builder 配置（镜像、开关）、声明顺序，还能条件装配。

### 4. 多个扩展的 After 回调执行顺序是？（6分）

- A. 与 Before 相同
- B. 随机
- C. 与 Before 逆序（栈式收口）
- D. 按类名字典序
> 答案：C
> 解析：先初始化最后清理，保证依赖关系正确（如先关连接池再停容器）；需要显式干预顺序时用 ExtensionAPI.after/before 或 @Order。

### 5. 扩展要在多个回调之间保存状态，正确的做法是？（6分）

- A. 扩展实例的裸字段
- B. ExtensionContext 的 Store + Namespace
- C. ThreadLocal 静态变量
- D. 系统属性
> 答案：B
> 解析：Store 按 ENGINE/CLASS/METHOD 层级隔离，并行执行安全；裸字段在 PER_CLASS 与并行下会串数据，是经典反例。

### 6. "本地未配置 db.url 时该集成测试跳过而非报错"，应使用？（6分）

- A. @Disabled
- B. @EnabledIfSystemProperty(named = "db.url", matches = ".+")
- C. @Tag("integration")
- D. assumeTrue 写在 @BeforeEach
> 答案：B
> 解析：条件注解表达"环境不满足→跳过"；@Disabled 是无条件禁掉，Tag 是构建阶段过滤，D 的 assume 也能但语义埋在代码里不如声明式清晰。

### 7. @Tag 与条件执行注解的分工是？（6分）

- A. 没有分工，二选一
- B. Tag 决定"这类测试在哪个阶段/分组跑"，条件注解决定"当前环境能不能跑"
- C. Tag 只能打一个
- D. 条件注解只能打在方法上
> 答案：B
> 解析：surefire 的 groups/excludedGroups 按 Tag 选集；@EnabledOnOs 等在执行时评估环境前提；两者正交、常叠加使用。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）下列关于扩展回调与注册的说法正确的有？（9分）

- A. @RegisterExtension 的 static 字段扩展在类级只初始化一次
- B. InvocationInterceptor 可以包裹 @Test 方法调用实现重试/计时
- C. TestExecutionListener 属于 platform 层，可经 ServiceLoader 自动注册
- D. 实例字段注册的扩展在 PER_METHOD 下整个类只创建一次
> 答案：ABC
> 解析：D 错——PER_METHOD 每个用例新建测试类实例，其实例字段扩展也随之重建；要类级复用请用 static 字段或 PER_CLASS。

### 9. （多选）一个自定义 ParameterResolver 的 supportsParameter 写得过宽（如只判断类型 int），会导致？（9分）

- A. 所有含 int 参数的测试方法都被它注入
- B. 与 @ParameterizedTest 等其它参数来源冲突、行为难预期
- C. 编译错误
- D. 排错困难——注入值来自"看不见的扩展"
> 答案：ABD
> 解析：supports 判定应以自定义注解精确圈定；过宽不会编译错误，但会在运行期悄悄劫持参数，是典型"扩展污染"反例。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 设计一个"每个集成测试用例自动清库"的扩展：说明实现的接口、注册方式、状态存放与并行注意点。（40分）

> 参考答案：
- 要点1：实现 BeforeEachCallback（或 TestWatcher 记录后统计），在 beforeEach 里对注入的数据源执行 truncate/delete 白名单表；
- 要点2：注册用 @RegisterExtension static 字段 + builder 传入表清单/开关——@ExtendWith 无法携带配置；
- 要点3：清库耗时打点放 AfterEachCallback，用例结束后写 Store（METHOD 层 Namespace）供 TestExecutionListener 汇总上报；
- 要点4：跨回调传递状态一律走 ExtensionContext.Store，不用裸字段，避免 PER_CLASS/并行下互相覆盖；
- 要点5：并行注意——清库是全局资源操作，并发用例互相踩数据；该类应标 @Execution(SAME_THREAD) 或按分库键隔离；
- 要点6：失败保护：清理异常不应掩盖用例本身的失败，AfterEach 里异常要降级为日志（截断策略可配）。
