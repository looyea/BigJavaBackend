# Spring Boot 切片测试（关联 JUnit） · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. @WebMvcTest 与 @SpringBootTest 的关键差别是？（6分）

- A. 前者不能注入 MockMvc
- B. 前者只加载 Web 层相关 Bean/自动配置，上下文小、起得快、失败归因聚焦
- C. 后者已废弃
- D. 前者必须连真数据库
> 答案：B
> 解析：切片经 TypeExcludeFilter 限定装配面——Controller/Converter/Jackson 进来，Service 等协作者必须给替身，全量装配才是 @SpringBootTest 的活。

### 2. Spring Boot 3.4 起在测试里顶替容器 Bean 的推荐注解是？（6分）

- A. @MockBean（仍为首选）
- B. @MockitoBean
- C. @Mock
- D. @TestMockBean
> 答案：B
> 解析：@MockBean/@SpyBean 已废弃，@MockitoBean（以及 @MockitoSpyBean）可标注类或字段；@Mock 纯 Mockito 不入容器，三者语义不同。

### 3. @DataJpaTest 默认的数据行为是？（6分）

- A. 每次回滚，用例间互不残留
- B. 每用例提交，需手动清表
- C. 用生产库
- D. 禁用事务
> 答案：A
> 解析：测试事务自动回滚保证隔离；要验证唯一索引/级联等"提交才暴露"的行为用 @Rollback(false) 或 TestTransaction 显式提交。

### 4. 验证"JSON 请求体绑定 → @Valid 校验失败 → 全局异常处理器输出错误码"应选？（6分）

- A. 纯 Mockito 单测 Service
- B. @WebMvcTest + MockMvc
- C. 手工 curl
- D. @DataJpaTest
> 答案：B
> 解析：这条链路横跨 Jackson/校验器/ControllerAdvice 三层装配，正是 Web 切片的靶心；单测 Service 根本不经这些组件。

### 5. 有人给切片加 `@AutoConfigureMockMvc(addFilters = false)`，风险是？（6分）

- A. 启动更慢
- B. 安全/自定义过滤器链被绕过，测试绿不代表请求过生产过滤器后的行为
- C. MockMvc 失效
- D. 无法注入 @MockitoBean
> 答案：B
> 解析：为提速关过滤器会掩盖鉴权/包装类问题；需要时应对过滤器单独写用例或升级到真 HTTP 端口的集成测试。

### 6. 想测 MySQL 的 `ON DUPLICATE KEY UPDATE` 行为，@DataJpaTest 默认内嵌库不行，正确改造是？（6分）

- A. 换 H2 MySQL 兼容模式即可放心
- B. @AutoConfigureTestDatabase(replace=NONE) + Testcontainers MySQL + @DynamicPropertySource
- C. mock EntityManager
- D. @Rollback(false)
> 答案：B
> 解析：兼容模式仍与真引擎有方言/行为差异，唯一可信是容器化真 MySQL；B 是标准三件套。

### 7. "把协作者的替身换成真 Bean 测试就不会红"，这说明该用例？（6分）

- A. 写得很好
- B. 层级放错了，本质是需要真依赖的集成测试
- C. 应该删掉
- D. 应该改成 verify
> 答案：B
> 解析：这是切片/单测升级判据——契约交互需要真实验证时归集成层（常配 Testcontainers），Mock 层只保留行为编排断言。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于切片测试的说法正确的有？（9分）

- A. @WebFluxTest 场景常用 WebTestClient 驱动
- B. @SpringBootTest(webEnvironment=RANDOM_PORT)+TestRestTemplate 能覆盖真 HTTP 栈与过滤器
- C. 业务规则的参数化分支矩阵应优先放进 @WebMvcTest，覆盖面更广
- D. 切片不加载 AOP 切面、@Async、Cache 等横切装配，这类需求要升级集成测试
> 答案：ABD
> 解析：C 层错配——业务矩阵属于毫秒级 Service 单测（纯 Mockito），搬进切片会让分钟级测试爆炸且归因变差。

### 9. （多选）@MockitoBean 顶替 Bean 带来的盲区包括？（9分）

- A. 被顶替 Bean 自身的 SQL/远程契约完全没有被验证
- B. 上下文缓存指纹变化导致每个配置组合各起一个上下文，数量失控
- C. 替换是全局的，同一测试类内无法对同一 Bean 分用例用不同桩（需 reset 语义小心处理）
- D. 真实现的行为回归靠该切片"顺带"保证
> 答案：AD
> 解析：D 是典型错觉——被 Mock 的 Bean 真行为必须由它自己的测试/契约测试保证；B 说反了，MockitoBean 改变缓存指纹是事实但"数量失控"表述错误归因；C 不准确——每用例桩可重编排。（B、C 为干扰项）

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 为"订单查询接口"设计测试：Controller 层切片、Repository 层切片、端到端集成各测什么、用什么工具，如何避免三层重复劳动？（40分）

> 参考答案：
- 要点1：Web 切片——@WebMvcTest+MockMvc+@MockitoBean(OrderService)：参数绑定/校验、错误码 JSON 契约、HTTP 状态码、内容协商；Service 逻辑一律桩掉；
- 要点2：数据切片——@DataJpaTest：动态查询、分页排序 SQL、唯一约束（@Rollback(false)/TestTransaction 提交验证）、索引命中不验执行计划；
- 要点3：集成——@SpringBootTest(RANDOM_PORT)+Testcontainers(MySQL)+对外部风控用 @MockitoSpyBean/录制桩：真过滤器链、序列化端到端、迁移脚本；
- 要点4：分工原则——同一断言只在一层出现：错误码映射归 Web、SQL 语义归数据层、装配与横切（缓存/AOP/事务传播）归集成；
- 要点5：耗时与门禁：切片毫秒~秒级 PR 必跑，集成挂主干/nightly，用 Tag 分层；
- 要点6：盲区治理——被 @MockitoBean 顶替的下游必须有独立契约测试兜底，防止"三层全绿、上线即炸"。
