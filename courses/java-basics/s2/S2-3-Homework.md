# 作业题 · Lambda 与 Stream API

> 不判分，对照参考要点自查。

## 作业 1：分组聚合实战（必做，本节核心）

给定 `List<Order>`（字段：`userId`、`amount`、`items:List<Item>`、`status`），用 Stream 完成：

1. 按 `userId` 分组，统计每个用户订单数（`groupingBy` + `counting`）
2. 按 `userId` 分组并对 `amount` 求和（`groupingBy` + `summingDouble`）
3. 把所有订单的 `items` 摊平成 `List<Item>`（`flatMap`）
4. 按 `status` 分区（`partitioningBy`），只统计有效订单金额（先 `filter`）

**参考要点**：多级 `groupingBy` 的下游收集器嵌套；`flatMap(Order::getItems)`；金额用 `mapToDouble` 避免装箱。

## 作业 2：toMap 冲突修复（必做）

用 `list.stream().collect(Collectors.toMap(User::getId, u->u))` 放入两个相同 id，观察 `IllegalStateException`；分别用"保留旧值""保留新值""把 value 改成 `List<User>`（groupingBy）"三种方式修复。

## 作业 3：reduce 正确性（必做）

用 `reduce` 求字符串拼接和数字求和。刻意写一个**违反关联律**的 `reduce`（如 `(a,b)->"["+a+b+"]"` 却给了错误的 identity），对比串行与 `.parallel()` 结果差异，解释为什么并行归约要求 identity/accumulator/combiner 语义自洽。

## 作业 4：并行流性能对照（必做）

对 `IntStream.range(1, 10_000_000)`：

1. 分别用串行 `sum()`、`parallel().sum()`、普通 for 循环计时
2. 对一个 `ArrayList` 做**纯 CPU** 计算对比串/并行
3. 把任务换成 `Thread.sleep(50)` 的 IO 模拟，用 `parallelStream` 跑，观察 commonPool 被占满、其他并行流被拖累

**结论**：写出"什么任务该并行、什么绝不该用默认并行流"。

## 作业 5：Lambda vs 匿名类（选做）

把一段匿名 `Comparator`/`Runnable` 改写成 Lambda，再故意在两者里各打印 `this`，观察输出差异（外围实例 vs 匿名类自身）；用 `javap -c` 找 `invokedynamic` 印证 Lambda 的生成方式。
