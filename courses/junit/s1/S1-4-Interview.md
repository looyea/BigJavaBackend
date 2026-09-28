# 与 Mockito/Testcontainers/Spring Boot Test 协同（关联） · 面试题

## 题 1：Mockito、Testcontainers、Spring Boot Test 各自解决什么问题？为什么会觉得它们"重复"？

- Mockito 解决"协作者不可控"：用替身切断真实依赖，让单测快、可 stub 异常分支；Testcontainers 解决"依赖不可信"：真 MySQL/Kafka 进生命周期，验契约与方言；Spring Boot Test 解决"装配不可见"：真实 IoC/Web/MVC 环境；
-  看似重复源于都出现在"测试"语境，实际分层正交：Mock 用于单元层，容器用于集成层，Boot Test 是装配框架、三者都挂在它的扩展机制上；
- 加分：给判据——"这段逻辑与依赖的交互契约是否需要被真实验证"，需要则容器，不需要则 Mock。

## 题 2：为什么 @SpringBootTest 里 Testcontainers 容器常用 static 字段？

- Spring TestContext 按配置指纹缓存上下文并跨测试类复用，若容器是实例字段随测试类实例生灭，缓存下来的上下文会指向已销毁容器的连接池；
- static（或独立单例持有）+ @DynamicPropertySource 把 jdbc url 延迟回填，容器生命周期与上下文缓存对齐；@Testcontainers 注解负责启动/停止；
- 加分：提到跨类进一步复用可用"平台级单例容器"模式（一个 JVM 全共享），并靠 Ryuk 兜底清理；关上下文缓存是错误方向——那是拿全量重启换虚假的干净。

## 题 3：@MockitoBean（老版本 @MockBean）替换的是容器里的 Bean，这会带来什么测试盲区？

- 切片/集成测试中被替换 Bean 的真实行为完全没被验证（它的 SQL、远程契约、序列化都可能烂），测试绿只代表"我的代码和假 Bean 配合良好"；
- 缓解：给 Mock 的行为补一条契约测试（真 Bean 的独立测试或消费者驱动契约），或在集成层用 Spy 保留真实现只切断最外部边界；
- 加分：能对比 @MockitoBean（进容器顶替）与 @Mock（纯对象不入容器）的适用层，说明"往 @SpringBootTest 里狂塞 MockBean"是把集成测试写成昂贵单元测试的反模式。

## 题 4：一次 PR 流水线里这三类测试怎么编排？

- 秒级单元（JUnit+Mockito+参数化）阻塞合并；分钟级切片（@WebMvcTest/@DataJpaTest）同 PR 并行跑；重集成（@SpringBootTest+容器、端到端）放合并后主干/nightly，发布前全量门禁；
- 用 Tag/groups 切集，surefire/failsafe 或 Gradle task 分离；失败要能一眼看出层（报告分组、skipped 统计）；
- 加分：给出耗时预算（如 PR 门禁 8 分钟红线）、以及"IT 红了算不算阻塞合并"的团队约定——没有编制的分层等于没分层。

## 题 5：Mock 联调"全绿上线即炸"，最常见的原因有哪些？

- 契约漂移：mock 的返回结构是按记忆手写的，真实服务字段/错误码早已变更——解法是契约测试或从真实流量/IDL 生成 stub；
- 把交互细节 mock 没了：链式调用中间对象忘 stub 导致 NPE 分支测不到（深度 stub 只是止痛），或 verify 锁死调用次数让重构寸步难行；
- 环境差异未覆盖：mock 掉了事务/连接池/消息重投等"只在真环境存在"的行为；
- 加分：提出"测试可信度审计"——统计线上缺陷里有多少理论上应被哪层拦截，反向修金字塔形状。

## 题 6：面试官问"你们单测里允许 new 真实对象吗？何时该测 getter/setter？"怎么答？

- 允许且鼓励：值对象、纯函数、无 IO 协作者用真实对象，断言更可信、重构更抗摔——Mock 只该出现在"跨越部署边界"的位置；
- getter/setter 不单独测，但作为参数化数据构造与 assertAll 输出的一部分自然覆盖；Lombok 生成代码可靠覆盖率豁免而非空测试；
- 加分：给出边界口诀"测行为不测字段、测契约不测实现"，并举例：DTO 的校验注解（@Valid）属于行为，值得在 Web 切片里验 HTTP 400。
