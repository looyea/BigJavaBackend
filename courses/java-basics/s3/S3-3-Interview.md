# S3-3 Optional 与语言级设计取向 · 面试追问

> Optional 看似小题，却能一眼区分"背 API"和"懂设计"的人。高分答法：讲清定位（返回值契约）、点透反模式（orElse 求值、当字段/参数）、并上升到语言取舍视角。

## 题 1：Optional 是干什么的？它能根除 NullPointerException 吗？

**期望时长**：1.5 分钟

**答题要点**：

- 定位：容器类型，把"结果可能不存在"写进返回值签名，让可空性显式化。
- 针对的是"接口没表达可空"，**不是** NPE 本身——`get()` 空时照样抛 NoSuchElementException，包里元素字段仍可 null。
- 引导用 `map/filter/orElse*` 函数式处理，替代散落的 if-null。

**追问链**：那和 `@Nullable` 注解比呢？→ 注解轻量、能覆盖参数/字段、靠静态分析；Optional 强约束、适合返回值，二者互补。

## 题 2：orElse 和 orElseGet 有什么区别？什么情况下用错会有 bug？

**答题要点**：

- `orElse(v)`：`v` 无论空不空都会被求值。
- `orElseGet(s)`：仅空时才调用 Supplier。
- 用错场景：`orElse(findExpensiveDefault())` 即便有值也会执行那次昂贵/有副作用的调用。

**追问链**：`orElse(null)` 有这个问题吗？→ 没有，`null` 是字面量不触发计算；风险来自方法调用与新对象构造。

## 题 3：哪些地方不该用 Optional？为什么？

**答题要点**：

- 字段：未实现 Serializable、非 final，污染领域模型且不能序列化。
- 参数：调用方被迫 `Optional.of(x)`，样板灾难。
- 集合的"空"：应返回空集合而非 `Optional<List>`，避免"空 vs 无"的双重语义。
- 唯一推荐归宿：方法返回值。

**追问链**：`Stream.findFirst()` 为什么返回 Optional？→ 它正是"终端操作的结果可能不存在"，是返回值用法的典范。

## 题 4：Kotlin 的空安全和 Java Optional 是一回事吗？

**答题要点**：不是一回事。Kotlin 在**类型系统层**区分 `T` 与 `T?`，编译器强制在使用前处理空，覆盖所有位置（变量/参数/返回/集合元素），彻底且零运行时包装；Java Optional 是**运行期容器 + 约定**，靠 API 引导，不强制。

**追问链**：既然 Kotlin 更好，Java 为何不上语言级空安全？→ 兼容海量把 null 当正常值的存量代码与生态，改造成本与语义冲突太大——体现 Java"渐进、务实、不破兼容"的设计取向。

## 题 5：聊聊你理解的 Java 语言设计哲学。

**答题要点**：

- 克制：宁少给语法糖也不引入难推理特性（泛型选类型擦除、Optional 只是标准库类）。
- 渐进兼容：Java 8→21 一步步补（var/record/sealed/virtual threads）而不砸旧代码。
- 务实权衡：在表达力、性能、生态兼容间取"够用的最优解"，非追最先进。

**追问链**：这取向的代价？→ 有时显得"落后/啰嗦"（如样板代码、类型擦除限制），但换来的是无与伦比的向后兼容与存量迁移友好——大型工程视角下这笔账通常是划算的。

## 高频速答

- `Optional.of(null)`？→ 抛 NPE；允许 null 用 `ofNullable`。
- Optional 空但调 `get()`？→ 抛 NoSuchElementException，应 `orElseThrow` 自定义。
- 能让 Optional 可序列化吗？→ 官方未实现 Serializable，故不作字段。
- `map` vs `flatMap`？→ 下游已返回 Optional 用 flatMap 避免嵌套 `Optional<Optional<T>>`。
- 空集合还是 Optional 集合？→ 永远返回空集合。
