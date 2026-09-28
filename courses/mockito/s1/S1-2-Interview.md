# 注解注入、ArgumentCaptor 与深度 Stub · 面试题

## 题 1：@InjectMocks 的注入策略是什么？它失败时的表现为什么危险？

- 依次尝试：最大可满足构造器 → setter → 字段反射，只拿 @Mock/@Spy 池里的对象按"类型（+同名）"配对；
- 危险在"静默"：没有匹配的依赖不报错，字段留 null，测试运行到该行才 NPE，新人常误判为被测代码 bug；
- 加分：给出团队规范——依赖 ≤3 且类型互同时用注解方便；出现同类型多依赖或构造器重载，改显式 new，测试可读性也更好。

## 题 2：ArgumentCaptor 和 argThat 都能"看参数"，差别在哪？

- argThat 是匹配器：参与"这次调用算不算命中 verify"，失败信息只有 Argument(s) are different；适合一条轻量判据；
- Captor 是收集器：capture() 配合 times(n) 把实参存起来，事后 getValue/getAllValues 做任意深度断言，报错精确到 assertEquals 的 expected/actual；
- 加分：两个坑——捕获的是引用不是快照（对象被后续原地修改会失真）；与次数强绑定导致脆弱。能状态断言时优先断出口。

## 题 3：thenReturn、thenThrow、thenAnswer 这些打桩 API 怎么按需求选？

- 固定返回值/固定异常 → thenReturn/thenThrow（可链式 `.thenReturn(a).thenReturn(b)` 模拟多次不同响应，最后一次永久生效）；
- 输出依赖本次入参或有内部状态（回填 id、按 key 查表、次数计数）→ thenAnswer/thenAnswer(inv -> ...)；
- 加分：划红线——thenAnswer 里出现 if/业务复刻就该抽出内存 Fake 类；"假实现骗人比真实现出 bug 更难被发现"。

## 题 4：RETURNS_DEEP_STUBS 是福音还是毒药？

- 福音面：第三方大对象图（SDK Response 三层 get）逐层 mock 纯属噪音，深度 stub 一行 `when(a.b().c()).thenReturn(x)` 解决；
- 毒药面：链上任何一环真实可能为 null，深度 stub 让其永远返回自动 mock，null 传播的故障分支永远测不到；还部分架空 strict stubs（自动创建的中间 mock 不受桩审计）；
- 加分：给取舍标准——外部只读对象图可用、自己域内链式先重构（拍平 DTO/守迪米特）、要测 null 路径就显式打 null 桩。

## 题 5：@Mock/@Spy/@Captor 注解体系里还有哪些容易踩的雷？

- @Spy 未初始化实例：Mockito 尝试无参构造，构造含 IO 即炸；@Spy 接口不支持；
- static @Mock：跨用例共享打桩与调用记录，严格模式报警或假绿；
- 手动 openMocks 与 MockitoExtension 并存：重复初始化、绕过严格检查；@Nested + PER_CLASS 交互时外层字段生命周期变化；
- 加分：@Mock 上 `answer = RETURNS_SMART_NULLS/RETURNS_MOCKS` 等可选答案能改善"未打桩返回 null"的可诊断性，SmartNullable 报错带调用位置。

## 题 6：面试官问"你们单测里被测对象怎么构造的？"怎样答出层次感？

- 基线：@ExtendWith(MockitoExtension.class) + @Mock 依赖 + 显式 new 被测对象（构造器注入天然配合），Arrange 三段清晰；
- 数据侧：测试数据 ObjectMother/Builder 工厂方法，返回新实例防共享突变；时间用 Clock 注入而不是 mockStatic（伏笔下一节）；
- 例外：类层次深、依赖多时用 @InjectMocks 提效，但 PR 规约要求依赖同类型时必须回退显式构造；
- 加分：点出"测试装配风格统一"比风格本身更重要——一半显式一半注解的仓库最伤可读性。
