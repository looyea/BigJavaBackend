# 参数化、动态与重复测试 · 作业

## 作业 1：状态机迁移表数据驱动（动手题）

**目标**：用 @MethodSource 把"订单状态机哪些迁移合法"一次性测完。

**任务**：
1. 定义枚举 `OrderStatus { CREATED, PAID, SHIPPED, COMPLETED, CANCELLED, REFUNDED }` 与一个 `canTransit(from, to)` 被测方法；
2. 用 `@EnumSource` 先跑"自迁移必须非法"一轮；再用 `@MethodSource` 列出全部合法迁移与非法迁移两张表（合计 ≥16 组），断言预期布尔；
3. 用 name 模板让报告展示成 `[7] PAID → SHIPPED 期望 true` 的形式；
4. 故意在一条非法迁移里把被测方法改错，截图报告如何精确指向该数据行。

**验收标准**：单组失败不影响其余 15 组执行；报告标题能直接当状态机评审的追溯表用。

**参考解法要点**：`Stream.of(OrderStatus.values()).flatMap(f -> Stream.of(...))` 可生成全组合，再用 Set 声明合法对——数据表与被测逻辑同源维护。

## 作业 2：幂等接口的重复测试（工程题）

**目标**：验证带幂等键的扣减接口"重复调用只生效一次"。

**任务**：
1. 写一个内存版 `InventoryService.deduct(sku, qty, idempotentKey)`，同 key 重复调用返回相同结果且不重复扣减；
2. 用 `@RepeatedTest(50)` 并发外循环反复调用同一 key，每轮注入 `RepetitionInfo` 在最后一轮断言总扣减量恰为一次；
3. **反例体验**：把实现改成"无幂等表"版本重跑，观察第 2 轮起断言失败——体会重复测试抓的就是这类缺陷。

**验收标准**：贴出两种实现下的失败报告差异；能说明 @RepeatedTest 与"起 50 个线程压"的本质区别（前者验函数语义，后者验并发安全）。

## 作业 3：目录扫描动态测试（文档+动手题）

**目标**：为"所有 SQL 脚本都必须有回滚配对"这条团队规范写自动化校验。

**任务**：用 `@TestFactory` 扫描 `src/main/resources/db/migration` 下全部 `V*.sql`，为每个文件生成一条 `DynamicTest("V3__add_index.sql 存在配对 U3__add_index.sql")`；文件缺失时该条失败但其余继续。

**验收标准**：新增一个无配对脚本后 CI 精确报出该文件名；解释为何这里不用参数化（条数与文件名编译期未知）。
