# S3-3 Optional 与语言级设计取向 · 小测

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. `Optional` 最恰当的使用场景是？（15分）

- A. 作为实体类的字段类型
- B. 作为方法的返回类型，表达"结果可能不存在"
- C. 作为方法参数替代可空引用
- D. 作为 `List` 为空时的包装

> 答案：B
> 解析：Optional 定位是"返回值容器"。字段（不可序列化）、参数（强迫调用方构造 Optional）、空集合（应直接返回空集合）都不该用。

### 2. 关于 `orElse` 与 `orElseGet`，正确的是？（15分）

- A. 二者完全等价，只是写法不同
- B. `orElse` 惰性求值，`orElseGet` 立即求值
- C. `orElse` 无论是否为空都会求值其参数，`orElseGet` 仅在空时才执行 Supplier
- D. `orElseGet` 接收一个值，`orElse` 接收一个 Supplier

> 答案：C
> 解析：`orElse(v)` 的 `v` 总被求值（即便有值），带开销/副作用应改用惰性的 `orElseGet(supplier)`，仅空时才调用。

### 3. 【多选】下列哪些是 `Optional` 的推荐用法或正确认知？（20分）

- A. 用 `map`/`flatMap`/`filter` 链式组合，而非 `isPresent()+get()`
- B. 空属于异常场景时用 `orElseThrow` 快速失败
- C. 领域实体字段声明为 `Optional<T>` 以强制判空
- D. 返回集合时空就返回 `List.of()`，而不是 `Optional<List<T>>`

> 答案：ABD
> 解析：C 错——Optional 不该用作字段（未实现 Serializable、语义暧昧）。A/B/D 均为最佳实践。

### 4. 判断：Java 的 `Optional` 与 Kotlin 的 `T?` 空安全是同一机制，效果等价。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：Kotlin 在**类型系统层**编译期强制空安全；Java Optional 只是标准库容器，靠约定与 API 引导，二者层级与彻底程度不同。

### 5. 填空题：`Optional.of(x)` 当 `x` 为 null 时会抛 ______；要允许 null 应改用 `Optional.______(x)`。（10分）

> 答案：NullPointerException / ofNullable

### 6. 说明 `Optional` 的设计初衷，并解释"不该把它用作字段、参数、集合"这三条戒律的理由，各给一个更优替代。（30分）

> 参考答案：
> - 初衷：把"可能为空"写进返回值类型契约，弥补 null 语义模糊、NPE 延迟爆发的缺陷（针对接口表达可空性，而非消灭 NPE 本身）
> - 不作字段：Optional 未实现 Serializable、非 final，做领域字段增加无谓一层且无法序列化——改为允许 null + `@Nullable` 注解
> - 不作参数：调用方被迫 `Optional.of(...)` 包装，样板灾难——改为方法重载 / `Objects.requireNonNull` / `@Nullable`
> - 不作集合空表达："没数据"应统一为空集合语义——改为返回 `Collections.emptyList()` / `List.of()`
> - 补充：语言级取向是克制/渐进/务实权衡，评判设计看它解决的约束而非追新
