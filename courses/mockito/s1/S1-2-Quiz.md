# 注解注入、ArgumentCaptor 与深度 Stub · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. 使用 MockitoExtension 时，JUnit 5 测试里还需要手动 `MockitoAnnotations.openMocks(this)` 吗？（6分）

- A. 需要，否则 @Mock 不生效
- B. 不需要，Extension 已在每用例前完成初始化并在结束后做严格检查
- C. 只在 @Nested 里需要
- D. 需要，但要放在 @BeforeAll
> 答案：B
> 解析：手动 openMocks 与 Extension 并存会导致重复初始化且绕过 STRICT_STUBS 检查，是迁移 JUnit 4 时的典型遗留代码。

### 2. @InjectMocks 的注入尝试顺序是？（6分）

- A. 字段 → setter → 构造器
- B. 构造器 → setter → 字段
- C. 随机
- D. 仅构造器
> 答案：B
> 解析：优先用参数最多的可行构造器，其次 setter，最后反射字段；都没有匹配时才报或静默留 null，故"缺 mock"常表现为 NPE 而非注入错误。

### 3. 同一个类里有两个同类型（如都叫 RedisTemplate）的 @Mock，@InjectMocks 靠什么配对到构造器参数？（6分）

- A. 声明顺序
- B. 字段名与目标参数/属性名匹配
- C. hashCode
- D. 无法配对，只能手动 new
> 答案：B
> 解析：类型相同退化为按名字匹配——mock 字段名要与被测类参数名一致，重命名敏感；这也是"显式 new 被测对象更稳"的论据。

### 4. 需要断言发给 MQ 的消息对象的 5 个字段内容，最合适的工具是？（6分）

- A. argThat 里连写 5 个条件
- B. ArgumentCaptor 捕获后 getValue/getAllValues 再 assertAll
- C. verifyNoInteractions
- D. thenAnswer
> 答案：B
> 解析：argThat 失败信息是"matcher 不匹配"难以定位字段；捕获后逐项 assertAll 一次看全差异。

### 5. `when(repo.save(any())).thenAnswer(inv -> 回填id后的实体)` 相比 thenReturn 的能力增量是？（6分）

- A. 性能更好
- B. 返回值可依赖本次调用的入参/可带状态（模拟自增、回显）
- C. 支持更多类型
- D. 可以省掉打桩
> 答案：B
> 解析：thenReturn 是固定死值；Answer 拿到 InvocationOnMock 的实参，能实现"输入决定输出"的准 Fake 行为。

### 6. RETURNS_DEEP_STUBS 解决什么问题、又掩盖什么问题？（6分）

- A. 解决链式调用逐层打桩；掩盖"中间层可能返回 null"的真实故障路径
- B. 解决并发打桩；掩盖线程问题
- C. 解决静态方法 mock；掩盖类加载
- D. 没有实际作用
> 答案：A
> 解析：`when(a.b().c())` 一行通吃链式结构，代价是链路里任何一环真实返回 null 的 bug 都测不出来，且弱化严格桩检查。

### 7. `@Spy` 字段的正确用法是？（6分）

- A. 直接 @Spy 一个接口
- B. @Spy 并给字段初始化真实实例（如 new ArrayList<>()）
- C. @Spy + static
- D. @Spy 不能与 @InjectMocks 同用
> 答案：B
> 解析：Spy 必须包裹真实对象；接口没有实现无从 spy；未初始化的具体类 @Spy 会由 Mockito 尝试无参构造，失败即报错。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于 ArgumentCaptor 的说法正确的有？（9分）

- A. 目标方法被调用多次时用 getAllValues() 按调用顺序取全部入参
- B. capture() 本身就是一种 matcher，必须出现在 verify 里而非打桩 when 里
- C. 泛型 captor 从 Mockito 5.7 起可用 ArgumentCaptor.captor() 免 unchecked 警告
- D. 捕获对象后续被被测代码原地修改时，拿到的可能是改后状态
> 答案：ACD
> 解析：B 半对半错——capture() 也可用于打桩参数匹配但官方警告其占位语义（返回默认值），规范用法是 verify 场景；此项按"必须只能 verify 用"表述过强，不选。ACD 均为事实：D 是"捕获引用非快照"的经典坑。

### 9. （多选）哪些做法会削弱 @Mock 体系的可靠性？（9分）

- A. 把 @Mock 声明为 static 让全类共享
- B. 用例末尾 reset(mock) 清掉上一用例的交互记录
- C. 给确属 @BeforeEach 共享桩的个别语句加 lenient()
- D. 在同类型多 mock 时依赖字段名匹配而不显式构造被测对象
> 答案：ABD
> 解析：A 破坏 PER_METHOD 隔离引发串桩；B 掩盖状态污染反模式；D 是隐性脆弱点，建议显式 new；C 是被认可的最小化豁免用法。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 详述 ArgumentCaptor 与 argThat 的差异与选择依据；说明 thenReturn/thenAnswer 的适用边界；给出深度 Stub 的"可用/不该用"各两种场景。（40分）

> 参考答案：
- 要点1：argThat=谓词筛选调用，失败信息只有"不匹配"，适合简单一条判据；Captor=捕获实例后逐项断言，报错精确到字段，适合多字段内容校验；
- 要点2：Captor 与 times(n) 绑定，调用次数一变测试即碎——能状态断言就不用捕获，这是脆弱度排序；
- 要点3：thenReturn 给固定值/固定异常即可满足大多数分支；thenAnswer 用于输出依赖入参或有内部状态（id 回填、按 key 查表演示 Fake）；
- 要点4：thenAnswer 里别写业务逻辑复刻——假实现比真实现更难维护，超过一行就该考虑内存 Fake 类；
- 要点5：深度 stub 可用：第三方 SDK 巨型只读对象图（Response.getBody().getItems()）、纯配置树读取；
- 要点6：不该用：自己域内五层链式（该重构拍平/守迪米特）、需要验证 null 传播故障路径、以及借此 mock final 链——同时会架空 strict stubs 检查。
