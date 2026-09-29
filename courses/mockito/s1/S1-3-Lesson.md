# 静态/final Mock、strictness 与过度 Mock

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：会用 `mockStatic`/`mockConstruction` 处理绕不开的静态与 new，说清 Mockito 5 默认 InlineMockMaker 为何能 mock final 及其代价，建立 strictness 三档的选用判断，并能识别与反驳"过度 Mock"的五个信号。

## 一、静态方法 mock：mockStatic 是线程局部的

```java
try (MockedStatic<Orders> mocked = mockStatic(Orders.class)) {   // 目的：接管 LegacyUtils 式的静态工厂
    mocked.when(() -> Orders.generateNo()).thenReturn("NO-1");   // 结果：作用域仅当前线程 + try 块内
    assertEquals("NO-1", service.create(cmd).getOrderNo());
}                                                                // 说明：离开作用域自动还原，防跨用例泄漏
// 反例 1：把 MockedStatic 存成字段/不 close → 静态桩泄漏到整个线程后续所有测试
// 反例 2：被测代码把逻辑丢给线程池——子线程里静态调用不受 mockStatic 管辖，测试假绿或偶发失败
```

mockStatic 还能 `verifyStatic` 校验调用，但它对**高频静态工具**（JSON 序列化、日志）有可观性能开销，且基于字节码 instrumentation——别把它当日常，只给 legacy 代码兜底。

## 二、final 与构造：InlineMockMaker 的能力边界

Mockito 5 默认 mock maker 从"运行时生成子类"（subclass，mock 不了 final）切换为**字节码 instrumentation 的 inline**：final 类、final 方法、甚至 enum 之外的任何类型都能 mock；`mockito-inline` 独立 artifact 已并入核心，无需额外依赖。代价：JVM 启动/转换开销略高、与 JaCoCo on-the-fly 等 agent 偶发冲突、native/同步方法不受管。

```java
try (MockedConstruction<SmsClient> cons = mockConstruction(SmsClient.class,
        (mock, ctx) -> when(mock.send(any())).thenReturn(true))) {   // 结果：被测代码里 new SmsClient(...) 得到的都是替身
    service.notify(order);                                           // 说明：对付"内部自己 new 依赖"的设计缺陷
    assertEquals(1, cons.constructed().size());                      // 目的：顺带验证确实构造了一次
}
```

`mockConstruction` 是"代码不可注入"的止痛药——根治永远是改成构造器注入。

## 三、时间、随机数：先改造再 mock

`mockStatic(Instant.class)` 是邪道（JDK 类 instrumentation 受限且脆弱）。正解是把不可测依赖变成可注入依赖：`Clock.clock(fixedInstant)` 注入、随机源传 `Random`/`ListSeed`。设计原则一句话：**seam（接缝）比 mock 便宜**——测试写不动，通常是生产代码结构在报警。

## 四、strictness 三档

| 档位 | 行为 | 适用 |
|------|------|------|
| STRICT_STUBS（默认） | 死桩 + 参数误用当场报 | 所有新代码 |
| STRICT | 只报死桩，不做参数误用检查 | 老项目/迁移缓冲期 |
| LENIENT | 全不报 | 整个大类迁移期临时用，配 TODO |

`PotentialStubbingProblem` 报错会并排打印"桩的参数 vs 实际参数"，多数是参数对象 equals 没重写或 matcher 漂移——修桩或修 equals，而不是降档。

## 五、过度 Mock 的五个信号

①一个用例 mock 了被测类 80% 的协作者（被测的只剩编排，测它等于测编译器）；②verify 锁死内部私有方法链调用顺序，纯重构必红；③mock 值对象/DTO（数据载体应为真对象）；④链式深度 stub 续命三段以上；⑤测试代码量超过被测代码量且断言全是"verify 次数"。每中一条扣分，中三条建议推倒：换成更高一层（切片/容器化集成）或先重构生产代码。过度 Mock 的终局是"重构即全红"——测试从资产变负债。

## 六、关联技术

注解与捕获在 [注解注入、ArgumentCaptor 与深度 Stub](S1-2-Lesson.md)；Mock 边界与切片策略在 [Spring Boot 切片测试（关联 JUnit）](S1-4-Lesson.md)；Extension 生命周期在 [扩展模型与条件执行](../../junit/s1/S1-3-Lesson.md)；用真依赖替代 Mock 的路线在 [Testcontainers 与集成测试](../../test-containers/s1/S1-1-Lesson.md)。
