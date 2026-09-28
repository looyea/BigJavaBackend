# Mock/Spy/Stub 与 when/verify · 面试题

## 题 1：Mock、Stub、Spy、Fake 四个词到底怎么区分？

- 按"是否含真实逻辑 + 验证什么"两轴分：Stub/Mock 都是全替换，区别在用途——Stub 只喂返回值走状态断言，Mock 用 verify 断交互；Spy 包住真实对象默认全真跑、可局部改写；Fake 是轻量真实现（如内存版 Repository、H2），行为可信但不进生产；
- Gerard Meszaros 的分类里 Mock/Stub/Spy/Fake 都是 Test Double 的子类，"替身"是总称；
- 加分：给选型口诀——跨部署边界用 Mock/Stub 隔离，进程内简单协作直接 Fake 真对象，legacy 大类才被迫 Spy。

## 题 2：为什么 `when(spy.method()).thenReturn(x)` 危险？正确写法？

- when 的参数求值会真的调用一次 spy 的 method（记录仪包装但调用穿透），副作用执行、若有异常直接抛出、返回 null 还可能让 when 自身报错；
- 正确：`doReturn(x).when(spy).method()`（或 doThrow/doAnswer），stub 阶段零调用；
- 加分：顺带说 mock 上两种风格等价（本来就没有真实行为），所以团队规范常写"统一 when 风格，spy 例外必须 doReturn"。

## 题 3：verify 的 matcher 为什么不能和裸值混用？

- Mockito 把 matcher 压入栈，按"声明的 matcher 数 == 参数数"消费配对；混用时栈里 1 个 matcher 对 2 个参数，直接 InvalidUseOfMatchersException；
- 需要"值相等"语义时用 eq(值) 把它升格为 matcher，全裸值则隐式按 equals 匹配；
- 加分：讲一个真实坑——参数对象的 equals 未重写（按引用比）导致"看着相等却 verify 失败"，此时应改用 argThat 按字段断言或修 equals。

## 题 4：UnnecessaryStubbingException 怎么修？直接 lenient 对不对？

- 先归因：多数是需求/实现变更后某条桩不再被走到（死桩），首选删桩或把桩下放到真正需要它的用例；确属 @BeforeEach 共享桩才对该条 `lenient().when(...)`；
- 全局关严格模式是把报警喇叭拆了——将来参数不匹配的 PotentialStubbingProblem 也不会报，mock 静默返回默认值，调试成本转移给下一个接手人；
- 加分：STRICT_STUBS 还附带 "stubbed vs actual 参数差异" 的友好报错，这正是它成为默认的价值。

## 题 5：什么样的断言说明测试在"锁实现细节"？怎么救？

- 信号：verify 了私有协作链每一环的调用次数/顺序、verifyNoMoreInteractions 全家桶、mock 了被测类的值对象、改内部方法拆分就得改测试；
- 救法：断言回到公共出口（返回值/落库状态/对外消息），交互断言只保留"本身就是需求"的（必发 MQ、绝不发短信）；
- 加分：引用"测行为不测实现"并给出重构测试法——理想状态是纯内部重构后测试零修改仍绿。

## 题 6：mock 返回的 List 被被测代码 add 了一个元素，下一个用例脏了，为什么？怎么防？

- mock 打桩返回的是同一个 List 实例引用，被测方法对入参/返回值的原地修改会穿透到测试字段——PER_METHOD 只重建 mock，不重建你 `thenReturn` 里共享的常量对象；
- 防治：`thenReturn(new ArrayList<>(List.of(...)))` 每次新实例，或返回 `List.copyOf(...)` 不可变集让越界修改当场暴露；
- 加分：由此引出"测试数据的构造成本应封装成工厂方法（ObjectMother）"，以及别用 reset(mock) 续命——那是掩盖共享状态的止痛药。
