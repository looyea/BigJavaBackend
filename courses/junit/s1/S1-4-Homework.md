# 与 Mockito/Testcontainers/Spring Boot Test 协同（关联） · 作业

## 作业 1：三层配方落地（动手题）

**目标**：为同一个"创建订单"用例写出三层测试，体会各层能抓住什么缺陷。

**任务**：
1. 单元层：`OrderService` 依赖 `InventoryClient`/`OrderRepository` 全 Mock，用参数化跑 10 组状态/金额分支；
2. 切片层：`@DataJpaTest` 验证 `order_no` 唯一索引冲突抛 `DataIntegrityViolationException`（注意 Mock 掉的 Repository 永远测不出这条路径）；
3. 集成层：`@SpringBootTest` + Testcontainers MySQL + `@MockitoSpyBean` 外部支付网关，跑一次真实"下单→扣减→落库"，断言库里有行；
4. 给每层打正确 Tag，surefire 配置 unit 常跑、failsafe/nightly 跑 IT。

**验收标准**：故意引入三个缺陷——(a) 金额分支写反 (b) H2 下能建、MySQL 方言函数报错的查询 (c) 唯一索引未生效——证明分别被第 1/3/2 层抓到，其余层漏过。

**参考解法要点**：容器用静态单例 + @DynamicPropertySource；`spring.jpa.properties.hibernate.dialect` 保持 MySQL 与生产一致。

## 作业 2：串桩事故复盘（工程题）

**目标**：亲手制造并修复一次"mock 跨用例泄漏"。

**任务**：
1. 写两个用例共用一个 static @Mock，用例 A 打桩 `repo.save(any())` 返回实体、用例 B 未打桩却断言返回 null——先观察 STRICT_STUBS 的报错形态；
2. 再改成 PER_METHOD 标准写法（@Mock 实例字段）验证恢复；
3. 总结：什么情况下才允许共享 mock（只读、无打桩或 lenient 明确标注），并在团队规范里怎么写才能防回归。

**验收标准**：贴出 UnnecessaryStubbingException/PotentialStubbingProblem 两种报错各一例，解释触发条件差异。

## 作业 3：测试体系评审文档（文档题）

**目标**：输出一页"本项目测试金字塔现状与改造计划"。

**任务**：统计仓库中三类测试的数量、平均耗时与所依赖组件，画出实际形状（通常是倒金字塔），提出改造：哪些 @SpringBootTest 应降级为切片、哪些 H2 用例应迁到 Testcontainers、哪些 Mock 断言测的是实现细节应删。

**验收标准**：每项改造有"层错配/替身不当"的证据（引用具体用例）；给出 PR 门禁耗时的预期变化数字。
