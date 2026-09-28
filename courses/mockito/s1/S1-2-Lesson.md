# 注解注入、ArgumentCaptor 与深度 Stub

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：理解 `@Mock/@InjectMocks` 的三种注入门与优先级，能用 `ArgumentCaptor` 对"发出去的消息"做内容断言，掌握 `thenAnswer` 动态打桩与深度 Stub 的正确姿势和它的批判边界。

## 一、注解注入：MockitoExtension 替你做了什么

```java
@ExtendWith(MockitoExtension.class)          // 结果：每用例自动 init 注解字段并做严格桩检查（JUnit 5 无需 MockitoAnnotations.openMocks）
class RefundServiceTest {
    @Mock ShippingClient shipping;           // 目的：声明即建，PER_METHOD 下每个用例全新实例，零串桩
    @Mock RefundRepository repo;
    @InjectMocks RefundServiceImpl service;  // 说明：按 构造器 → setter → 字段 三级尝试注入，只注入 mock/spy
}
```

三门规则：被测类有构造器注入（Spring 推荐姿势）就走构造器，**多余的 @Mock 不会报错但缺失依赖会静默注入 null**——@InjectMocks 失败不抛异常是最大陷阱，字段没注上表现为运行期 NPE。lombok `@RequiredArgsConstructor` 的类若参数名与 mock 字段名一致可顺利按类型+名字匹配；同类型多 mock 时靠字段名配对，改名敏感，故**显式 new 往往比 @InjectMocks 更稳**。

## 二、ArgumentCaptor：断言"传出去的东西"

verify 的 argThat 只能"筛选调用"，要看具体内容和做多项断言时用捕获：

```java
var cap = ArgumentCaptor.forClass(RefundMsg.class);   // 目的：抓住真实调用时的入参实例
verify(shipping, times(2)).notifyRefund(cap.capture());
List<RefundMsg> msgs = cap.getAllValues();            // 结果：多次调用逐一检查（单次用 getValue）
assertAll("消息内容",
    () -> assertEquals(orderNo, msgs.get(0).getOrderNo()),
    () -> assertEquals(0, new BigDecimal("10.00").compareTo(msgs.get(0).getAmount())));
// 反例：对"未被调用的 mock"capture 后取值 → NoSuchElement/NullPointer，先保证 verify 次数≥1
```

泛型集合捕获用 `ArgumentCaptor.captor()`（5.7+）免抑制警告；`captor.getAllValues()` 与调用次数绑定，改实现就脆——能状态断言的别上捕获。

## 三、thenAnswer：返回值依赖入参时

`thenReturn` 是死值；要"原样回显、按 id 查表、序列号自增"用 `thenAnswer`：

```java
when(repo.save(any(Order.class))).thenAnswer(inv -> {   // 说明：模拟真库行为——回填自增 id
    Order o = inv.getArgument(0);
    return o.withId(nextId.getAndIncrement());           // 目的：有状态的假实现，接近 Fake 而非纯 Stub
});
when(cache.get(anyString())).thenAnswer(inv -> data.getOrDefault(inv.getArgument(0), MISS));
```

写进 @BeforeEach 的 thenAnswer 若含可变态，注意每用例重建（实例字段天然满足；static 数据要手动清）。

## 四、深度 Stub：链式调用的止痛药

`a.b().c().d()` 层层打桩令人崩溃，`RETURNS_DEEP_STUBS` 让中间层自动生成子 mock：

```java
Config cfg = mock(Config.class, RETURNS_DEEP_STUBS);
when(cfg.limiter().redis().host()).thenReturn("127.0.0.1");   // 结果：中间链不用逐层编排
// 反例：生产代码到处是五层链还靠深度 stub 续命——这是该做 DTO 拍平/修 Law of Demeter 的信号，
// 且深度 stub 会吞掉"中间层返回 null"的真实故障路径，Strict 检查也部分失效
```

边界：第三方不可变的大对象图（如 SDK 的 Response）用深度 stub 可接受；自己域内的链式结构应改设计而不是喂 stub。

## 五、@Captor、@Spy 注解与收尾纪律

`@Captor ArgumentCaptor<Foo>` 自动处理泛型；`@Spy` 字段必须已初始化（`@Spy List<String> list = new ArrayList<>()`），裸 @Spy 具体类等于把构造风险留在注解里。收尾三禁：禁 `MockitoAnnotations.openMocks` 手动调（Extension 已管）、禁测试末尾 reset 全量 mock 掩盖污染、禁 static @Mock。

## 六、关联技术

打桩与 verify 基础在 [Mock/Spy/Stub 与 when/verify](S1-1-Lesson.md)；strictness 体系与过度 Mock 批判在 [静态/final Mock、strictness 与过度 Mock](S1-3-Lesson.md)；Spring 侧的 `@MockitoBean` 见 [Spring Boot 切片测试（关联 JUnit）](S1-4-Lesson.md)；Extension 机制原理在 [扩展模型与条件执行](../../junit/s1/S1-3-Lesson.md)。
