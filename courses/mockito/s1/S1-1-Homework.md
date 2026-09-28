# Mock/Spy/Stub 与 when/verify · 作业

## 作业 1：Stub 驱动计价分支（动手题）

**目标**：用打桩编排一张"优惠券服务各种回应"的矩阵，测计价逻辑。

**任务**：
1. `PricingService` 依赖 `CouponClient`；用同一个 mock 按入参打 4 条桩：正常券、过期券（抛 `CouponExpiredException`）、不存在的券（返回 empty）、超时（thenThrow RuntimeException）；
2. 参数化跑四分支，断言各自的最终价格/降级行为；
3. 故意把其中一个用例传入的券码改掉使其不命中任何桩，观察"默认值 null → NPE"现象，并在报告里说明排查路径（先查桩是否命中）。

**验收标准**：四条桩全部被消费（无 UnnecessaryStubbing 报警）；NPE 现象能被解释为 matcher 未命中而非框架 bug。

## 作业 2：Spy 与 doReturn 实验（工程题）

**目标**：亲历 `when(spy.xxx())` 真执行一次的危害。

**任务**：
1. 写一个方法内有计数器副作用的类，`spy` 后分别用 `when(spy.next()).thenReturn(99)` 与 `doReturn(99).when(spy).next()` 打桩，再各调用一次，打印计数器值（2 vs 1）；
2. 把桩改为 `doThrow`，验证 spy 其余方法仍走真实逻辑；
3. 反思题（书面）：什么场景才该用 spy 而不是 mock 接口？给出"legacy 类无法抽接口才局部 spy"的判断标准。

**验收标准**：两种风格计数器差异截图；能口述"when 括号内是一次真实调用"的机制。

## 作业 3：verify 分寸评审（文档题）

**目标**：给一组现成断言判定"该 verify 还是该断言状态"。

**任务**：针对下面 5 个需求分别写出你推荐的断言方式并排序其脆弱度：(a) 下单成功后必须发一条 MQ；(b) 查询接口返回 DTO 字段映射正确；(c) 重试组件对失败依赖调用 3 次；(d) 未支付用户不发短信；(e) service 内部先调 repoA 再调 repoB（顺序为实现细节）。

**验收标准**：a/c/d 用 verify（never/times 给出理由）、b 用 assertAll 状态断言、e 被判为"不该锁顺序"并给出替代（只断最终状态）；附一段 150 字"脆弱的交互断言如何拖垮重构"。
