# JUnit 5 架构、生命周期与断言 · 作业

## 作业 1：生命周期实验（动手题）

**目标**：用实验证明 PER_METHOD 与 PER_CLASS 的行为差异，彻底记住 @BeforeAll 的 static 约束。

**任务**：
1. 写一个测试类含两个 @Test 与一个实例计数器字段 `int created`，在构造函数里 `created++` 并打印，观察两个用例看到的 `created` 值（PER_METHOD 下各自都是 1）；
2. 把类加上 `@TestInstance(PER_CLASS)` 重跑，观察 `created` 变成 2——证明整类共享一个实例；
3. 故意把非 static 的 @BeforeAll 放在默认模型下运行，记录报错信息，再改成 static 或 PER_CLASS 修复；
4. 用 `@Nested` 内嵌一层"金额校验"子测试，验证外层 @BeforeEach 会先于内层执行。

**验收标准**：能贴出三种配置的构造输出对比；能说清"为什么 PER_METHOD 下实例字段天然隔离"。

**参考解法要点**：报错原文是 `@BeforeAll ... must not be non-static`——根因是默认模型下该方法执行时尚无实例可挂载。

## 作业 2：断言重构（工程题）

**目标**：把一段"JUnit 4 风格"的烂断言改造成精准可读的 JUnit 5 写法。

**任务**：给定如下反例代码（自己先抄一遍再改）：

```java
@Test(expected = RuntimeException.class)
void testOrder() {                       // 反例起点：expected 无法校验抛出位置与消息
    Order o = service.create(-1);
    assertTrue(o.getStatus() == "CREATED");   // 失败只报 false，无实际值
    assertEquals(new BigDecimal("100.0"), o.getAmount()); // scale 坑：100.0 vs 100.00
}
```

1. 拆成两个用例：`shouldRejectNegativeAmount` 用 assertThrows 拿回异常并断言消息含 "amount"；
2. 状态/金额断言合并进 assertAll，金额改用 compareTo；
3. 失败信息改为 Supplier 形式；加 @DisplayName 让报告可读。

**验收标准**：改造后代码在 IDE 里跑绿；手动把断言改坏一处，报告能一次列出 assertAll 下全部失败项而非首个即停。

## 作业 3：模块结构调研（文档题）

**目标**：说清 junit-platform / jupiter-api / jupiter-engine / vintage-engine 四者关系。

**任务**：在一个项目里同时保留一个 JUnit 4 测试与一个 Jupiter 测试，通过仅增删 `junit-vintage-engine` 依赖观察哪个测试消失，画出"platform-launched → engine 发现执行 → jupiter-api 提供编写面"的依赖方向图。

**验收标准**：图中箭头方向正确（engine 依赖 api，构建工具依赖 platform）；能用一句话说清"为什么 Spring 的测试支持是 Extension 而不是新引擎"。
