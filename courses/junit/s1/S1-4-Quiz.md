# 与 Mockito/Testcontainers/Spring Boot Test 协同（关联） · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. Mockito/Spring/Testcontainers 接入 JUnit 5 的共同机制是？（6分）

- A. 自定义 TestEngine
- B. Jupiter Extension API
- C. Java SPI 替换断言
- D. Maven 插件
> 答案：B
> 解析：三者都实现扩展回调（参数注入、生命周期、实例后置处理），不需要也不应该另起引擎；引擎层保持 jupiter 一个。

### 2. 验证"Flyway 迁移脚本在真 MySQL 上能跑通"，最合适的工具组合是？（6分）

- A. Mockito mock 掉 DataSource
- B. H2 内存库 + @DataJpaTest
- C. Testcontainers MySQLContainer + @SpringBootTest
- D. 纯 JUnit assertAll
> 答案：C
> 解析：方言函数、DDL 行为只有真引擎能验；H2 兼容模式仍会漏，mock 则完全没执行 SQL——契约交互需要真依赖。

### 3. @SpringBootTest 上下文有缓存，容器应如何声明才与缓存语义对齐？（6分）

- A. 每个测试方法里 new 一个容器
- B. 静态字段/单例容器 + @DynamicPropertySource 注入连接信息
- C. @MockBean 容器
- D. 把上下文缓存关掉
> 答案：B
> 解析：上下文按配置指纹缓存复用，实例字段容器会随旧实例失效而上下文里的连接池指向死端口；静态单例 + 动态属性回填是标准解。

### 4. 有人把 @Mock 字段提为 static 想"省内存"，STRICT_STUBS 下最可能的后果是？（6分）

- A. 内存确实下降且无副作用
- B. 打桩跨用例残留，触发 UnnecessaryStubbing/串状态
- C. 编译错误
- D. 自动每用例重置
> 答案：B
> 解析：MockitoExtension 依赖 PER_METHOD 每用例新建 mock 集；static 共享让上一用例的打桩与调用记录漏进下一用例，严格模式直接报错或产生假绿。

### 5. @WebMvcTest 切片中，控制器依赖的 Service 默认应当？（6分）

- A. 真实装配全部 Bean
- B. 用 @MockitoBean（旧版 @MockBean）只提供被调行为
- C. 不需要提供
- D. 用 Testcontainers 起后端
> 答案：B
> 解析：切片的意义就是只装 Web 层相关 Bean，协作者以 mock 顶替，专注序列化、校验、状态码；全装配属于 @SpringBootTest 的职责。

### 6. "被测方法调用外部短信网关后写库"，网关这一步在单元测试里的正确替身是？（6分）

- A. Spy 真实网关类
- B. Mock 网借口并 stub 返回值，必要时 verify 调用参数
- C. 起一个真网关容器
- D. 反射改超时配置
> 答案：B
> 解析：对外部系统只关心契约交互（调没调、传了什么），Mock+verify 足够且最快；真网关容器属于集成层，不该进单测。

### 7. 给纯 Mockito 单元测试错误打上 @Tag("integration")，造成的问题是？（6分）

- A. 无影响
- B. 最快的用例被 PR 门禁排除，反馈链路 inverted——秒级测试最晚跑或不跑
- C. 编译失败
- D. Mock 失效
> 答案：B
> 解析：Tag 决定构建阶段选集；错层标记让本该永远秒跑的用例只出现在 nightly，掩盖问题且拖慢反馈。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于三层测试配方的分工，正确的有？（9分）

- A. 纯单元（JUnit+Mockito）适合跑业务分支与参数化矩阵
- B. Web 切片验证 JSON 序列化、@Valid 校验、HTTP 状态码映射
- C. 数据切片/集成验证 SQL、事务传播、迁移脚本
- D. 三层应该合并成一个 @SpringBootTest 全量跑，省代码
> 答案：ABC
> 解析：D 是反模式——全量上下文让单测秒级反馈变成分钟级、失败归因困难、并行也救不回分层价值。

### 9. （多选）哪些现象提示"H2 或 Mock 联在骗你"？（9分）

- A. 生产 MySQL 的 ON DUPLICATE KEY UPDATE 在 H2 语法模式下测试通过但线上报错
- B. Mock 掉的 Repository 让 service 单测全绿，而真实唯一索引冲突路径从未被走
- C. JSON 列类型在 H2 建表失败被 @Disabled 跳过
- D. Testcontainers 用例首跑 40s 后缓存复用降至毫秒
> 答案：ABC
> 解析：ABC 分别是方言差异、假依赖掩盖真实约束路径、以跳过掩盖缺验证；D 是容器的正常行为不是骗局。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 为一个"下单扣库存"服务设计三层测试体系：各层选什么工具组合、验证什么、不验证什么。（40分）

> 参考答案：
- 要点1：单元层——JUnit+Mockito：状态机分支、金额计算、幂等键判断；不验证 SQL 与 HTTP 契约；毫秒级、PR 必跑；
- 要点2：Web 切片——@WebMvcTest+@MockitoBean：请求校验、错误码映射、序列化字段名；不验证业务规则与数据库；
- 要点3：数据切片——@DataJpaTest 回滚事务验 repository 方言查询、唯一约束；
- 要点4：集成层——@SpringBootTest+Testcontainers(MySQL+Kafka)：完整装配、迁移脚本、消息落库；外部支付网关用 Mock/Spy 切断；
- 要点5：协同细节：静态单例容器+@DynamicPropertySource 对齐上下文缓存；mock 保持 PER_METHOD 防串桩；
- 要点6：治理：Tag 分阶段（unit 每 PR、IT nightly/发布前），skipped 与耗时纳入报表，避免错层与烂尾。
