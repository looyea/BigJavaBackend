# Spring Boot 切片测试（关联 JUnit） · 作业

## 作业 1：从 @SpringBootTest 里"降维"（动手题）

**目标**：把一个 60 秒的全量上下文用例改造成 2 秒的切片组合。

**任务**：
1. 造一个含 Controller+Service+Repository 的查询接口，先写一个 @SpringBootTest+MockMvc 用例（记录启动耗时）；
2. 拆成两个切片：@WebMvcTest（Service 用 @MockitoBean，断言错误码 JSON 契约）与 @DataJpaTest（断言分页与动态条件 SQL 行为）；
3. 对比三者的上下文 Bean 数量（启动日志或 `context.getBeanDefinitionCount()`）与耗时；
4. 保留一个"换真 Bean 才会红"的用例（缓存注解失效），论证它必须留在集成层。

**验收标准**：两张切片都能在 3 秒内完成；能准确说出哪些横切能力（AOP/@Async/Cache）不在切片视野内。

**参考解法要点**：@WebMvcTest 指定 Controller class 参数收窄装配面；@DataJpaTest 记得它默认回滚，分页 total 断言在事务内可查。

## 作业 2：真 MySQL 数据切片（工程题）

**目标**：把 @DataJpaTest 从内嵌 H2 切到 Testcontainers MySQL，抓一个只有真库能暴露的问题。

**任务**：
1. 用 `@AutoConfigureTestDatabase(replace = NONE)` + 静态 MySQLContainer + @DynamicPropertySource 改造；
2. 植入一个 JSON 列实体与一条 `ON DUPLICATE KEY UPDATE` 自定义语句：先证明 H2（MySQL 兼容模式）下报错或行为不一致，再在真库跑绿；
3. 用 @Rollback(false)/TestTransaction 补一条"唯一索引并发冲突转 DataIntegrityViolation"用例（配合 count 断言）。

**验收标准**：贴出 H2 失败 vs MySQL 通过两种输出；说明为何"兼容模式"仍不能替代真引擎（方言函数/锁语义/字符集排序）。

## 作业 3：分层规约起草（文档题）

**任务**：为团队写一页"Web 切片 / 数据切片 / 集成测试职责表"：每类允许出现的注解、断言主题、禁止事项（如在 @WebMvcTest 里验业务规则矩阵、给集成测试滥用 @MockitoBean 顶掉一半 Bean）、耗时预算与 CI 阶段。

**验收标准**：每条"禁止"都配一个反例用例说明它会漏掉或拖慢什么；给出升级判据原文："把替身换成真 Bean 就不会红的用例，属于集成层"。
