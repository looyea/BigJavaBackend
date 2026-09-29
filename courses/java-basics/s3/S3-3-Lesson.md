# Optional 与语言级设计取向

> 本节难度：★★☆☆☆
> 重要程度：★★★☆☆
> 学习产出：理解 `Optional` 的**真实定位——它是"返回值容器"而非万能空值工具**，掌握 `ofNullable/of/orElse/orElseGet/orElseThrow/filter/map/flatMap` 的正确用法与三大反模式；顺带建立 Java 的**语言级设计取向**观感：克制、务实、渐进（对比 Kotlin/Scala 的空安全），学会判断"何时该用、何时是过度设计"。

## 一、为什么会有 Optional：null 的百年污点（★★☆☆☆）

`null` 是 Tony Hoare 自称的"十亿美元错误"——它类型上合法、却语义模糊（"没查到" vs "查到值为空" vs "还没初始化"都用一个 null 表达），且把 NPE 推迟到不可预知的下游。Java 8 引入 `Optional<T>`：**用一个显式的容器类型，把"可能为空"写进方法签名的契约里**，强制调用方正视空值分支。

```java
// 例子目的：对比"返回裸对象"与"返回 Optional"——后者把"可能没有"写进签名，编译器逼调用方处理
Optional<User> findUser(Long id);                    // 新：签名即文档——"这里可能没有"
// 应用：调用方必须从 Optional 里安全取值，而不是直接拿可能为 null 的引用
User u = findUser(1L).orElse(User.GUEST);            // 查不到就用默认游客对象
// 正确用法结果：findUser 命中时 u 是查到的用户，未命中时 u == User.GUEST，全程不会为 null
// 旧写法 User findUser(Long id) 的问题：调用方忘记判空就 u.getCity() → 运行时抛 NullPointerException（线上 NPE 头号来源）
```

关键认知：`Optional` 解决的**不是 NPE 本身，而是"接口没有表达可空性"**。它是给**返回值**用的，不是给字段、参数、集合元素用的（第三节讲原因）。

## 二、正确姿势：链式而非 if-else（★★★☆☆）

`Optional` 的价值在于**函数式组合**，把它当 `if(x!=null)` 的替代品就浪费了它：

```java
// ❌ 反模式一：只是把 null 检查换了层皮，还不如直接 if
Optional<User> ou = findUser(id);
if (ou.isPresent()) { return ou.get().getCity(); }

// ❌ 反模式二：orElse 传了会执行的方法/重对象——即便有值也会构造默认值（浪费/可能副作用）
return findUser(id).orElse(buildExpensiveDefault());

// ✅ orElseGet 传 Supplier，只在真空时才执行
return findUser(id).map(User::getCity).orElseGet(this::defaultCity);

// ✅ 空即异常场景就该快速失败，把默认值推给上层
return findUser(id).orElseThrow(() -> new UserNotFoundException(id));
```

三兄弟辨析（面试高频）：`orElse(v)` 无论空不空都会求值 `v`；`orElseGet(s)` 惰性，仅空时调 `Supplier`；`orElseThrow(e)` 空则抛。**带方法调用/有开销的默认值一律用 `orElseGet`**。`map`/`flatMap` 处理"可能再为空的下钻"，`filter` 做条件收敛。

## 三、三大不该用 Optional 的地方（★★★☆☆）

| 场景 | 为什么不该用 | 该怎么做 |
| --- | --- | --- |
| **作为字段** | `Optional` 未实现 `Serializable`、非 final，做领域实体字段既不序列化又增加一层；且语义暧昧 | 字段直接允许 null 并配文档，或用 `@Nullable` 注解 |
| **作为方法参数** | 调用方被迫构造 Optional，样板代码灾难；参数可空性用注解更轻 | 用 `Objects.requireNonNull` 校验 / `@Nullable` / 方法重载 |
| **作为集合的"空"表达** | "空集合"和"没有集合"应统一为**返回空集合**而非 `Optional<List>` | `Collections.emptyList()` / `List.of()` |

`Optional` 的最佳且几乎唯一归宿：**作为方法返回值，明确告诉调用方"结果可能不存在"**。Guava 作者与《Effective Java》都持此立场。

## 四、语言级设计取向：Java 的克制与渐进（★★☆☆☆）

跳出 Optional 看 Java 的设计哲学——它不是"最先进"的语言，而是**在表达力、向后兼容、工程务实之间长期权衡**的产物：

- **克制的抽象**：宁可少给语法糖，也不引入难以推理的特性。泛型选了**类型擦除**而非 reified（呼应 s2-1），Optional 只是标准库类而非语言级空安全——都是"务实妥协"的体现。
- **渐进演进、拒绝破坏兼容**：从 Java 8 的 Lambda/Stream/Optional，到 10 `var`、14 `record`/switch 表达式、17 sealed、21 virtual threads——每一步都在**不砸旧饭碗**前提下补齐（详见 java-modern 分区）。
- **对比其他语言**：Kotlin 用**类型系统**（`T?` / `!!` / `?.`）在编译期根治空安全，比 Java 的 `Optional` 库方案更彻底；但 Java 选库方案是为了兼容海量存量代码。理解这层取舍，比记 API 更重要——**没有"最好"的设计，只有"最合适当下约束"的设计**。

> `@Nullable`/`@NonNull` 注解 + 静态分析（Checker Framework、IDE、ArchUnit）是 Optional 之外的另一条空值治理路线，二者互补：注解轻量、覆盖参数与字段；Optional 强约束、适合返回值。

## 五、动手题

1. 把一个含三层 `if(x!=null)` 嵌套取值的旧方法，重写为 `Optional.ofNullable(a).map(A::getB).map(B::getC).orElse(default)` 链式写法，体会可读性差异。
2. 故意用 `orElse(expensiveCall())` 与 `orElseGet(() -> expensiveCall())`，在 `expensiveCall` 里打印日志，观察"有值时"前者仍被调用，验证两者惰性差异。
3. 给一个"返回 `Optional<List<User>>`"的接口做重构，改成"永远返回集合、空则返回 `List.of()`"，并说明为什么后者更好。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 用了 Optional 仍 NPE | `get()` 前没判 `isPresent`；或 Optional 里包的元素自身字段为 null |
| 默认值逻辑意外执行/开销大 | `orElse` 传了会求值的调用，应换 `orElseGet` |
| 实体序列化报错 / 领域模型多一层别扭 | 把 Optional 用作了字段 |
| 接口到处要调用方 `Optional.of(参数)` | 误把 Optional 当参数类型 |
| "明明有数据却走了默认分支" | `map` 链中某环节返回 null，`Optional.map` 会把非空变空 |

## 七、关联技术栈

- **向前**：类型擦除体现的语言取舍 ↔ s2-1；`Objects.requireNonNull` 与快速失败 ↔ s2-2 异常；Stream 的 `findFirst` 返回 Optional ↔ s2-3
- **向后**：`var`/`record`/sealed/virtual threads 的演进脉络 ↔ java-modern 分区各节
- **横向**：Kotlin 空安全类型系统、`@Nullable` 注解 + 静态分析、函数式语言的 Maybe 单子——同一问题的不同设计解

## 八、本节小结

`Optional` 记住三句话：**它是"返回值容器"不是空值万能药、用链式（map/filter/orElseGet）而非 `isPresent+get`、别拿它当字段/参数/集合**。往上抽一层，Java 的语言取向是"克制、渐进、务实权衡"——评判一个设计好不好，要看它解决的约束，而非单纯追新。

至此，Java 基础语言分区（java-basics）全部完成。下一阶段进入 java-modern，看 Java 9→21 把这些设计取向推进到了哪里。
