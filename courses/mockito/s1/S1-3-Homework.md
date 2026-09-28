# 静态/final Mock、strictness 与过度 Mock · 作业

## 作业 1：mockStatic 作用域实验（动手题）

**目标**：建立"线程局部 + 必须 close"的肌肉记忆。

**任务**：
1. 对一个静态工具 `NoGenerator.next()` 分别写三个用例：正确使用 try-with-resources、故意不 close（用变量接住后放任）、把 MockedStatic 提为实例字段在 @BeforeEach 创建——观察第三个在第二个用例开始时抛 "Static mocking is already registered in the current thread" 或桩泄漏生效；
2. 在 mockStatic 生效期间调用一个把逻辑丢给 `CompletableFuture.runAsync` 的方法，对比主线程/池线程内的静态调用行为并记录；
3. 总结成 5 行团队使用守则。

**验收标准**：三种误用至少复现两种异常/假绿形态；异步不接管有实验输出佐证。

## 作业 2：从静态依赖到可注入的重构（工程题）

**目标**：给一段 `Instant.now()` + `new SmsClient()` 混合的过程式 legacy 方法做可测化改造。

**任务**：
1. 原方法直接测：只允许 mockStatic/mockConstruction，写 2 个用例（含"发送失败重试一次"分支）；
2. 重构：提取 `Clock` 参数与 `SmsClientFactory` 接口（构造注入），再写同样 2 个用例，删除全部静态 mock；
3. 对比两版测试的行数、脆弱点（重构敏感项），量化"seam 比 mock 便宜"。

**验收标准**：第二版零 mockStatic；给出改造前后"改内部实现是否红"的对照实验（加一层私有方法提取）。

## 作业 3：strictness 治理方案（文档题）

**目标**：为 300 个历史测试类（一半靠 reset() 与 LENIENT 苟活）制定回收计划。

**任务**：写出分阶段方案——盘点指标（lenient 类数、reset 出现次数、死桩 Top20）、门禁策略（新文件必须 STRICT_STUBS，CI 统计只降不升）、迁移批排期（按变更频率倒序）、以及"PotentialStubbingProblem 报错三连排查步骤"（参数 equals → matcher 漂移 → 分支变更死桩）培训提纲。

**验收标准**：每阶段有可量化退出指标；包含"禁止为大文件整体加 @MockitoSettings(LENIENT) 而无 issue 编号"的硬规则。
