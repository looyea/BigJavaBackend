# 实际面试题 · Lambda 与 Stream API

## 题 1：Stream 的中间操作和终端操作有什么区别？为什么叫惰性求值？

**答题要点**：中间操作（`filter/map/flatMap/sorted/distinct/limit`）返回一个新的 Stream、**不会立即计算**，只是把操作记录进管道；终端操作（`collect/forEach/reduce/count/match/find`）才**触发整条管道真正处理数据**并产出结果。惰性 = 没有终端操作就一个元素都不处理；配合短路（`limit`/`findFirst`/`anyMatch`）能处理无限流、减少计算。Stream 还是一次性的，终端后就耗尽。

**追问链**：`peek` 能当 forEach 用吗？→ 不建议，它设计为调试用，某些终端会优化掉它、并行下行为不定，别放业务副作用。

## 题 2：`map` 和 `flatMap` 的区别？

**答题要点**：`map(Function)` 一对一映射，`Stream<T>→Stream<R>`；`flatMap(Function<T,Stream<R>>)→Stream<R>` 把每个元素映射成一个子流再**摊平拼接**成一个流，用于一对多展开（订单→所有商品项）、去空、字符串拆词合并等。

## 题 3：Lambda 能修改捕获的局部变量吗？和匿名内部类有什么不同？

**答题要点**：不能，捕获的局部变量必须 effectively final（Lambda 捕获的是值副本，防两边不一致）。与匿名类的关键差异是 `this`：Lambda 的 `this` 指向**定义它的外围实例**（不引入新作用域），匿名类的 `this` 是它自己。底层 Lambda 用 `invokedynamic`+`LambdaMetafactory` 生成，比匿名类更省（无捕获的可缓存复用）。

## 题 4：`parallelStream` 有什么坑？你会在什么场景用它？

**结构化回答**：

1. **共享 `ForkJoinPool.commonPool()`**：全 JVM 默认同一池，任务里阻塞（IO/锁/sleep）会占满线程、**拖累所有其他并行流和默认 CompletableFuture**。
2. **不能有副作用**：`forEach` 改外部非线程安全集合/计数器会数据竞争，应用 `collect/reduce`。
3. **不是处处快**：源要易拆分（ArrayList/数组/范围好，`BufferedReader.lines`、迭代器难）；任务要 CPU 密集、粒度够细；有序/装箱操作削弱收益。
4. 该用：大CPU 密集、可拆、无阻塞无副作用；不该用：IO 型、含阻塞、小数据量。确需并行且可能阻塞就自建 ForkJoinPool 隔离。

## 题 5：`Collectors.toMap` 为什么可能抛异常？怎么用 groupingBy 做多级统计？

**答题要点**：`toMap(keyMapper,valueMapper)` 遇到**重复 key** 默认抛 `IllegalStateException`，必须传第三个 merge 函数决定保留策略（留旧/留新/合并）。`groupingBy` 可嵌套多级：`groupingBy(部门, groupingBy(职级, summingDouble(薪资)))`，下游还能接 `counting/averagingInt/mapping/collectingAndThen` 做组合统计。

## 高频追问速答

1. Stream 会修改原集合吗？→ 不会，中间操作产生新流、`collect` 产新容器；`removeIf`/`sort` 才是原地改集合。
2. `forEach` 里能 `return` 提前结束吗？→ 不能，`return` 只是结束当前 lambda，要中断用 `limit`/`takeWhile`(JDK9)/`anyMatch` 或退回 for。
3. 为什么数字流要 `mapToInt`？→ 避免 `Integer` 装箱/拆箱开销并可用 `sum/average` 直接归约。
4. 并行流怎么控制线程数？→ 默认 commonPool 大小靠 `-Djava.util.concurrent.ForkJoinPool.common.parallelism`；更稳妥是提交到自建池。
5. `Optional` 和 Stream 关系？→ 同为函数式风格、`map/filter/orElseGet` 语义一致；Optional 是"0/1 容器"，Stream 是"0..n 流"（下节 s3-3）。
