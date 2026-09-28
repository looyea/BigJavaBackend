# 扩展模型与条件执行 · 作业

## 作业 1：RandomPort 扩展（动手题）

**目标**：完整走一遍 ParameterResolver 三件套：自定义注解 → supports/resolve → 注册生效。

**任务**：
1. 实现注解 `@RandomPort`（TARGET_PARAMETER）与扩展 `RandomPortExtension implements ParameterResolver`，supports 条件必须同时校验类型与注解（防劫持所有 int 参数）；
2. 测试方法 `void httpWorks(@RandomPort int port)` 配合一个临时起在随机端口的 HttpServer 跑通；
3. 分别用 `@ExtendWith` 与 `@RegisterExtension` 注册一次，给扩展加一个 `minPort` 配置字段，演示只有字段注册能传参；
4. 把 supports 故意放宽为"只看类型"，再造一个 @ParameterizedTest 的 int 参数方法，观察冲突现象并记录。

**验收标准**：第 4 步能复现"参数被扩展抢先注入、参数化数据没传进来"的异常表现，并解释根因。

## 作业 2：跨回调状态与 Store（工程题）

**目标**：实现一个统计"每个用例实际耗时+重试次数"的扩展，状态全程走 Store。

**任务**：
1. BeforeEachCallback 记录开始时间到 `CONTEXT.getStore(Namespace.create(getClass()))`；
2. 重跑逻辑用 InvocationInterceptor.interceptTestMethod 捕获异常后重试一次实现（TestWatcher 只能感知失败不能重跑），重试次数 +1 仍存 Store；
3. AfterEachCallback 取出耗时与重试数打印成 `SLOW[m=120ms, retry=1]` 标记；
4. 开并行执行（junit.jupiter.execution.parallel.enabled=true）验证无串数据——这正是不能用裸字段的原因。

**验收标准**：并行 4 线程跑 20 个用例，每条的 retry/耗时标记与用例一一对应；把实现改回裸字段版本演示串数据。

## 作业 3：条件执行策略设计（文档题）

**目标**：为团队定一条"集成测试何时跑"的规则并用注解落地。

**任务**：某模块 IT 依赖公司内网数据库。用 `@Tag("it")` + `@EnabledIfEnvironmentVariable(named="INTRANET", matches="true")` 组合：本地默认跳过、CI 主干流水线必跑、发布前 nightly 全量。写出 surefire/jacoco 配置片段与一段 200 字规则说明（谁负责配环境变量、跳过的用例如何在报告里可见）。

**验收标准**：规则能回答"跳过≠通过，如何在 CI 报告区分 skipped 与 passed"；避免用 @Disabled 硬禁导致测试烂尾的反例写法。
