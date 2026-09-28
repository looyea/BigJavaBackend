# Spring Boot 切片测试（关联 JUnit） · 面试题

## 题 1：@WebMvcTest 底层是怎么"只装 Web 层"的？

- 组合注解：@SpringBootConfiguration 探测 + @AutoConfigureWebMvc/@MockMvc 相关自动配置 + TypeExcludeFilter 把组件扫描限制在 Controller/Converter/Filter/Jackson 定制等 Web 相关类型，@Service/@Repository 不入选；
- 因此 Service 必须经 @MockitoBean（Boot 3.4 前是 @MockBean）提供替身，否则装配直接缺 Bean 报错；
- 加分：能对比 @JsonTest（只装 ObjectMapper 模块）、@WebFluxTest（配 WebTestClient），并说出切片失败先看"缺哪个 Bean"通常是层错配信号。

## 题 2：@MockitoBean 和 Mockito 的 @Mock 有何本质不同？

- @Mock 是纯对象层面的 Mockito 实例，不涉容器；@MockitoBean 会向 ApplicationContext 注册替身并**顶掉同类型真 Bean**，让注入链（构造器/@Autowired）拿到的都是假件；
- 影响面不同：@MockitoBean 改变测试上下文缓存键——每种替换组合各缓存一份上下文，滥用会让 CI 里上下文反复重建变慢；
- 加分：Boot 3.4 迁移话题——@MockBean 废弃的原因是它与 Spring 容器生命周期耦合过重，@MockitoBean 基于 Mockito 的 reset 机制在每用例间自动清理。

## 题 3：@DataJpaTest 默认回滚，什么时候必须提交？怎么提交？

- "提交才暴露"的行为：唯一索引/外键冲突转译、级联与 flush 时机、数据库触发器、自增/序列的可见性；
- 手段：方法级 @Rollback(false)、或 TestTransaction.begin/commit 精细控制、或拆到 @SpringBootTest+Testcontainers；
- 加分：点出"H2 兼容模式不等于 MySQL"——JSON 列、ON DUPLICATE KEY、排序规则差异都要真容器（承接 Testcontainers 话题）。

## 题 4：MockMvc、TestRestTemplate、WebTestClient 怎么选？

- MockMvc：切片内、无端口、直接调 DispatcherServlet，快但绕过真网络栈与容器层过滤器语义；
- TestRestTemplate：@SpringBootTest(RANDOM_PORT) 起内嵌服务器走真 HTTP，覆盖过滤器/编码/端到端序列化，慢一档；
- WebTestClient：WebFlux 生态对应品（bindToController/bindToServer 两种强度）；
- 加分：给出实践序——契约（状态码/JSON 字段）用 MockMvc，安全链路与跨进程行为用真端口，别用 MockMvc 结论替代过滤器链验证。

## 题 5：什么信号说明你的"切片测试"已经名存实亡？

- 一个 @WebMvcTest 里挂了 7 个 @MockitoBean、还得 @Import 三个 Service 才跑得起来——装配面已被你手工扩回全量，收益趋零；
- 每个用例都 @MockitoBean 顶掉一半 Bean，绿只证明"Controller 和假 Service 配合良好"；
- 处置：协作者 ≥3 的 Controller 逻辑下沉重组；跨装配验证升级集成；下游真行为补契约测试；
- 加分：金句——"切片的价值在'少装'，靠 @Import 续命的切片是在自毁长城"。

## 题 6：面试官问"你们测试分层怎么落 CI"？给一个资深答案。

- 结构与门禁：纯单测+切片在 PR 门禁（预算 8 分钟、并行分片），@SpringBootTest+Testcontainers 在合并后主干必跑，E2E/夜全量在 nightly，发布流水线重放主干 IT；
- 稳定性治理：Tag 强制分层、skipped 计数进报表、flaky 隔离区（重试率超阈自动建 issue）；
- 反馈设计：PR 失败信息按层标注（web 契约/SQL/装配），门禁耗时周报公示防膨胀；
- 加分：主动谈权衡——"IT 不阻塞合并"的前提是主干 IT 红 30 分钟内响应回滚，否则分层只是把风险后移。
