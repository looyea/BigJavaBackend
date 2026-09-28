# 扩展模型与条件执行 · 面试题

## 题 1：JUnit 5 的扩展模型解决了 JUnit 4 的什么问题？

- JUnit 4 横切机制割裂：Rule/ClassRule 管生命周期、Runner 管执行方式（且一个类只能一个 Runner，SpringJUnit4ClassRunner 与 Parameterized 互斥是历史名场面）、RunListener 在跑测试外很难配置；
- Jupiter 统一为 Extension 接口族：任意多个可叠加、按注册序执行、回调覆盖类/方法/参数/拦截各层面，Runner 的活由 InvocationInterceptor 等接管；
- 加分：能点名三大生态用户——MockitoExtension 注入 @Mock、SpringExtension 挂上下文、@Testcontainers 管容器，说明这套 API 支撑起了整个测试生态。

## 题 2：@ExtendWith 和 @RegisterExtension 的区别？生产里为什么常见后者？

- @ExtendWith 传 Class，框架无参实例化，全局/类级声明简洁但零配置；
- @RegisterExtension 是字段注册：可 builder 传参（镜像版本、开关）、static 字段实现类级单例、可控注册顺序，还能运行期条件决定接不接；
- 加分：提到 Testcontainers 官方推荐 @RegisterExtension / 静态容器字段正是吃"static 字段全类一次初始化"的语义；@ExtendWith 版的扩展只能靠注解属性或系统配置传参。

## 题 3：扩展实例字段在多测试并行时安全吗？状态该放哪？

- 不安全：PER_CLASS 或 static 注册下扩展是共享单例，裸字段跨线程互写，出现"A 用例读到 B 用例的时间戳"这类串数据；
- 正确姿势：ExtensionContext.getStore(Namespace)，按 ENGINE/CLASS/METHOD 层级天然隔离，且随作用域自动回收；
- 加分：说清 PER_METHOD 下扩展实例其实每用例新建（若经类实例字段注册），"看似安全"反而掩盖设计问题——一旦有人改 PER_CLASS 就炸，规范应强制 Store。

## 题 4：条件执行（@EnabledIf*）和 @Disabled、@Tag 三者怎么选调？

- @Disabled：已知缺陷/待重构的临时禁用，必须写 reason 并纳入债务统计——它与环境无关；
- @EnabledIfSystemProperty/EnvironmentVariable/OnOs/OnJre：环境前提不满足则跳过，声明"在什么条件下这条测试才有意义"；
- @Tag：不是跳过机制，是选集机制——surefire groups/excludedGroups、-Dgroups 按阶段挑哪些跑（单测永远跑、IT  nightly 跑）；
- 加分：指出 CI 报告里 skipped 与 passed 必须区分展示，大量 skipped 同样要治理——"永远被跳过的测试"和死测试等价。

## 题 5：写一个重试扩展（flaky test 自动重跑）的思路与争议？

- 思路：InvocationInterceptor.interceptTestMethod 里循环 invocation.proceed()，捕获失败后重试 N 次，全败才抛；重跑次数写 Store 并在报告标注；
- 争议：重试掩盖真实缺陷（并发 bug、资源泄漏被"多跑一次"蒙混）；业界主流态度是"治理 flaky 优于重试"——定位根因、隔离不稳定依赖；
- 加分：给出工程折中——只对打了 @Flaky 标签的用例启用重试且 CI 统计重试率，超阈值自动建 issue；引用"测试应确定性"原则说明重试是止痛药不是 cure。

## 题 6：TestExecutionListener 和 Jupiter Extension 有何不同？做全局测试报表选哪个？

- 层级不同：Listener 在 platform 层看所有 TestEngine（含 vintage）的事件流，经 LauncherSessionListener/ServiceLoader 全局注册，拿不到 Jupiter 语义细节（如参数化分组）；Extension 在 Jupiter 层，作用域跟着注解/字段注册走；
- 全局横切（所有测试埋点、报表汇总）→ Listener + ServiceLoader，零侵入；与测试语义强相关（注入参数、改执行方式）→ Extension；
- 加分：能说出 Spring Boot 的 @RecordApplicationEvents、Allure 集成都走 Listener 路线——它拿到完整 TestPlan 树，适合产出结构化报告。
