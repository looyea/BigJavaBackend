# 静态/final Mock、strictness 与过度 Mock · 面试题

## 题 1：Mockito 为什么曾经 mock 不了 final 类？现在呢？

- 旧 subclass mock maker 的原理是运行时生成被 mock 类的子类并覆写方法，final 类/方法无法被继承覆写，故无能为力；
- Mockito 5 默认 inline maker：通过 instrumentation 在类加载时直接改字节码织入拦截，final 类、final 方法、普通方法统统可 mock，`mockito-inline` artifact 已并入核心；
- 加分：代价链——需要 JVM 支持 attach/instrumentation，与 JaCoCo 等 agent 版本要兼容、有额外转换开销；"能 mock final"不等于"该 mock final"，final 常是设计边界信号。

## 题 2：mockStatic 的作用域模型是什么？哪些场景会失效？

- 线程局部 + 生命周期绑定 MockedStatic 对象（close 即还原），所以必须 try-with-resources；
- 失效场景：被测逻辑切到线程池/虚拟线程执行（别的线程走真实实现）、忘记 close 造成跨用例泄漏、并行执行同线程冲突（同一类重复注册抛 Static mocking already registered）；
- 加分：JDK 核心类（Instant/System/Math）不建议也不稳定；对高频静态工具做静态 mock 有性能税——引出"先改造再 mock"。

## 题 3：代码里 `Instant.now()` 和 `new SmsClient()` 没法注入，测试怎么写？长期方案呢？

- 短期：`mockConstruction(SmsClient.class, ...)` 接管作用域内构造；时间用调用处包一个 `Clock` 静态壳或直接给方法加 Clock 参数——`mockStatic(Instant)` 是下策；
- 长期：可测性重构——协作者经构造器注入、时间/随机源作为参数或 Bean（Clock.fixed、可播种 Random），测试回到普通 @Mock；
- 加分：金句"seam（接缝）比 mock 便宜"：一次结构性改造让后续每个测试都受益，静态 mock 是每次都要重付的利息。

## 题 4：讲讲 STRICT_STUBS，它解决的真实痛点是什么？

- 两件事：测试结束时报告从未被调用的死桩（UnnecessaryStubbing），以及运行期"方法被调了但参数与所有桩都不匹配"时当场抛 PotentialStubbingProblem 并打印桩/实参对照；
- 痛点：默认 mock 对未命中桩静默返回 null/零值，错误被推迟到远处 NPE 或假绿——严格模式把报错拉回第一现场；
- 加分：说明为什么"全局 LENIENT + reset()"的老仓库最怕改需求——所有护栏都拆了；正确豁免粒度是单条 `lenient()` 或确属 setup 共享桩。

## 题 5：什么算过度 Mock？你如何说服团队少写 mock？

- 信号清单：一次用例 mock 掉大半协作者、verify 锁内部调用顺序/次数、mock 值对象、深度 stub 三段链、纯重构测试全红、测试代码反超被测代码；
- 本质：测的是"实现而非行为"，测试从安全网变紧身衣；说服路径——用"重构演练"演示（提取私有方法导致 40 个测试红）+ 引入切片/容器化集成测试承接跨协作者场景；
- 加分：给出边界——Mock 正确的用武之地是"跨部署边界的契约交互"（必发消息、绝不调扣款），并用 SUT（State-based vs Interaction-based）术语收口。

## 题 6：并行执行测试时 Mockito 有坑吗？

- 普通 mock/spy 实例随测试实例走，天然并行安全；shared/static mock、mockConstruction 之外的全局配置改动是竞争源；
- 真坑在 mockStatic：注册是"类+线程"级，若测试框架在同一线程复用而两个类都注册同静态类会互踩——并行下必须严格作用域，或改用注入方案；inline maker 的字节码转换是全局的，首次 mock 某类时有一次性停顿；
- 加分：提到 JUnit 并行 + 静态 mock 组合的排错模式（单独跑绿、并行红），以及把"禁用 static mock 字段"写进规范。
