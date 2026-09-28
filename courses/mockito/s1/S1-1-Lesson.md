# Mock/Spy/Stub 与 when/verify

> 本节难度：★★☆☆☆
> 本节重要性：★★★★☆
> 学习产出：分清 Mock/Stub/Spy 三种替身的意图差异，会用 `when/thenReturn/thenThrow` 打桩、`verify` 校验交互，避开"matcher 混用裸值"与"对 spy 用 when() 触发真实方法"两大高频异常。

## 一、三种替身，两种意图

| 替身 | 真实逻辑 | 验什么 | 典型场景 |
|------|---------|--------|----------|
| Mock | 完全替换 | 交互（调没调、传什么） | 验证"支付成功后必须发货" |
| Stub | 完全替换 | 只喂返回值 | 被测类需要下游数据才能算 |
| Spy | 保留真实 | 交互+真实结果 | 包装真实实现、只切断其中一个方法 |

意图轴是"测状态 vs 测交互"：多数业务方法用 Stub 喂数据、断言返回/落库状态即可；只有"必须发生某次调用"本身是需求（发消息、扣款回调）才值得 verify。

## 二、打桩：when 的读法与坑

```java
// 目的：打桩=编排"依赖在什么输入下有什么行为"
when(couponRepo.findById("C1")).thenReturn(Optional.of(coupon));
when(couponRepo.findById("GONE")).thenReturn(Optional.empty());     // 空分支单独编排
when(payClient.charge(any())).thenThrow(new GatewayTimeoutException("5s")); // 结果：异常分支也能测

// 反例 1：打桩"不会被调用的方法" → STRICT_STUBS 下 UnnecessaryStubbingException（不是 bug，是死桩报警）
// 反例 2：when() 括号里真实执行了一次方法——对 spy 危险，见第四节
```

未打桩的调用不会报错，而是返回**默认值**：null、0、false、空集合（RETURNS_DEFAULTS）。"mock 返回 null 引发 NPE"十有八九是没打桩或参数没匹配上，先查这里。

## 三、verify：参数匹配器规则

```java
service.placeOrder(cmd);
verify(payClient).charge(BigDecimal.valueOf(100));       // 默认 times(1)
verify(mqProducer, times(2)).send(any(Message.class));   // 次数断言
verify(smsClient, never()).send(any());                  // 反例路径：未支付绝不发发货短信

// 规则：一个调用里要么全裸值、要么全 matcher，混用抛 InvalidUseOfMatchersException
verify(repo).save(eq(order));                            // 说明：要"matcher 语义的相等"用 eq() 包装
// 反例：verify(repo).save(same(o), 3) —— matcher 与裸值 3 混用直接炸
```

参数还想按内容判断用 `argThat(o -> o.getAmount().signum() > 0)`，或进下一步捕获（ArgumentCaptor）。

## 四、Spy 的两种伤

`spy(new OrderService())` 会**真的执行构造函数**——构造里有 IO 就炸；且 `when(spy.calc(x)).thenReturn(y)` 会先**真调一次 calc**。安全写法：

```java
PricingService svc = spy(new PricingService(repo));         // 目的：保留真实计价逻辑
doReturn(BigDecimal.TEN).when(svc).tax(any());        // 结果：doReturn 风格不触发真实方法，stub 已有行为用这套
verify(svc).tax(any());
```

能 mock 接口就别 spy 类：spy 是"实现细节被锁进测试"的开始，重构敏感。

## 五、默认严格模式

Mockito 3+ 的 `MockitoExtension` 默认 **STRICT_STUBS**：死桩（UnnecessaryStubbing）与参数不匹配的误用（PotentialStubbingProblem）当场报，好过失败信息诡异的"mock 返回了 null"。别一报错就调 `@MockitoSettings(strictness = LENIENT)`——那是关掉报警喇叭；只有确属共享 setup 里的通用桩才局部 lenient。

## 六、关联技术

注解注入与参数捕获在 [注解注入、ArgumentCaptor 与深度 Stub](S1-2-Lesson.md)；静态/final  mock 与过度 Mock 批判在 [静态/final Mock、strictness 与过度 Mock](S1-3-Lesson.md)；Spring 切片里顶替 Bean 见 [Spring Boot 切片测试（关联 JUnit）](S1-4-Lesson.md)；骨架机制在 [JUnit 5 架构、生命周期与断言](../../junit/s1/S1-1-Lesson.md)。
