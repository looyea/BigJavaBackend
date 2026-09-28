# Mock/Spy/Stub 与 when/verify · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. Stub 与 Mock 作为测试替身，核心分工差异是？（6分）

- A. Stub 验证返回值来源、Mock 验证数据库
- B. Stub 只喂数据靠状态断言，Mock 侧重验证交互（是否调用/参数/次数）
- C. Stub 是真实对象，Mock 是假对象
- D. 二者完全同义
> 答案：B
> 解析：意图决定选型——多数用例用 Stub 给返回值再断言结果；"必须调用某方法"本身是需求时才用 Mock 的 verify。

### 2. 对 mock 的方法一个参数用 `any()`、另一个参数直接传裸值，会发生？（6分）

- A. 正常运行，裸值按 equals 匹配
- B. 抛 InvalidUseOfMatchersException
- C. 自动把裸值包装成 eq()
- D. 编译错误
> 答案：B
> 解析：matcher 记录在栈上按参数数消费，混用导致数量对不上；要么全 matcher，要么全裸值，相等语义用 eq() 显式包装。

### 3. 未打桩就调用 mock 的方法，默认行为是？（6分）

- A. 抛 MockitoException
- B. 返回默认值（null/0/false/空集合）
- C. 死循环等待
- D. 自动递归打桩
> 答案：B
> 解析：RETURNS_DEFAULTS 返回类型零值，"诡异 NPE"多半是漏打桩或参数没匹配上导致桩未命中。

### 4. `when(spy.count()).thenReturn(5)` 的问题在于？（6分）

- A. 无问题，when 是通用风格
- B. 括号里会先真实执行一次 count()，可能有副作用/异常
- C. thenReturn 不支持 spy
- D. 会导致 UnnecessaryStubbing
> 答案：B
> 解析：stub 已有行为要用 doReturn(5).when(spy).count()——do 系列不把调用真正执行。

### 5. STRICT_STUBS 下抛 UnnecessaryStubbingException 意味着？（6分）

- A. 测试必挂，禁止提交
- B. 存在从未被命中的死桩，提示清理或确属共享 setup 需要处理
- C. matcher 用错了
- D. mock 太多内存溢出
> 答案：B
> 解析：它是"死桩报警"不是运行时错误根因；处理方向：删桩、或 setup 通用桩局部 lenient，而不是全局关严格模式。

### 6. 想断言"下游消息发送恰好发生 2 次且金额>0"，最直接的组合是？（6分）

- A. times(2) + argThat(a -> a.getAmount().signum() > 0)
- B. atLeastOnce() + any()
- C. never() + eq(0)
- D. verifyNoMoreInteractions() 单独使用
> 答案：A
> 解析：次数用 times(2)，内容谓词用 argThat；D 单独用会锁死所有交互细节，重构灾难。

### 7. 关于 `spy(new XxxService(dep))`，正确的有？（6分）

- A. spy 不执行真实构造
- B. 构造函数被真实执行，含 IO 时应先解耦或改 mock 接口
- C. spy 只能用于接口
- D. spy 对象不能 verify
> 答案：B
> 解析：spy 是"包一层记录仪的真实对象"，构造与其他方法默认真跑；正因如此能 mock 接口就别 spy 具体类。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）下列关于打桩与验证的说法正确的有？（9分）

- A. `when(...).thenThrow(...)` 可以编排依赖抛异常，测被测类的容错分支
- B. `verify(mock, never()).send(any())` 适合断言"未支付不得发货"这类负向路径
- C. 同一个方法按不同入参可打多条桩，按 matcher 命中对应条
- D. 打桩必须写在每个用例内，写进 @BeforeEach 一律报错
> 答案：ABC
> 解析：D 错——setup 里的通用桩合法，只是若某用例不消费会触发严格模式报警，应按需用 lenient 或下放到用例。

### 9. （多选）哪些信号提示"你在过度 Mock"？（9分）

- A. verify 断言了内部私有协作的调用次数，重构不改行为也得改测试
- B. 一个用例里 mock 了被测类 6 个依赖中的 5 个方法链
- C. 用 RETURNS_DEEP_STUBS 穿透 config.a.b.c 三层才拿到值
- D. 对 Repository 接口 Stub 一个查询返回值
> 答案：ABC
> 解析：A 锁实现细节、B 被测类成了"编排空壳"、C 暴露过度耦合；D 是 Mock 的正当用法。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 说明 Mock/Spy/Stub 的区别，when 与 doReturn 两套打桩风格的差异与适用场景，以及 STRICT_STUBS 两种典型报错的含义与正确处置。（40分）

> 参考答案：
- 要点1：Mock 全替换重交互、Stub 全替换只喂数据、Spy 保真实只切部分方法；选型看"测状态还是测行为"；
- 要点2：when().thenReturn() 读起来顺但会真执行括号内调用——mock 上用没问题；spy/已有行为必须 doReturn().when() 避免副作用与 NPE；
- 要点3：doThrow/doAnswer 同理适用于 spy；已打桩方法再 when 一次是覆盖不是叠加，注意顺序；
- 要点4：UnnecessaryStubbingException=死桩：删或局部 lenient；PotentialStubbingProblem=调用参数与桩不匹配：查 matcher/参数构造是否 equals 成立；
- 要点5：处置纪律——不全局关严格模式，不用测试内 reset(mock) 掩盖共享污染；
- 要点6：verify 纪律：默认 times(1)，负向 never()，慎用 verifyNoMoreInteractions 与精确次数，优先状态断言。
