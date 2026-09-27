# 实际面试题 · 泛型与类型擦除

## 题 1：Java 泛型的实现方式是什么？为什么运行期拿不到 `<String>`？

**答题要点**：Java 泛型是**编译期机制 + 类型擦除**。编译后类型参数被替换为其边界（无界 `<T>`→`Object`，有界→上界类型），只在调用处插入强制转换。目的是与 JDK5 之前的 raw type **二进制兼容**。所以运行期 `List<String>` 和 `List<Integer>` 是同一个 `ArrayList`，`getClass()` 不含泛型信息。

**追问链**：

1. 为什么不用 C# 那种保留运行期泛型的方式？→ 为了兼容存量字节码与类库，历史妥协。
2. 擦除后 `T` 的信息完全没了？→ 局部变量/实例没了，但**类/字段/方法声明签名**仍以元数据保留泛型，反射可读（见题 5）。

## 题 2：类型擦除带来了哪些"不能"？怎么绕？

**答题要点**：不能 `new T()`/`T.class`（无运行期类型）→ 传 `Class<T>` 令牌；不能 `instanceof T` → 用 `Class.isInstance`；不能 `new T[]` → 用 `List<T>`；`catch(T)`、仅靠类型参数区分的重载都非法；静态上下文不能用类的 `<T>`。核心绕法是**把类型信息显式带进运行期**（`Class<T>`/`TypeToken`）。

## 题 3：`<? extends T>` 和 `<? super T>` 有什么区别？PECS 是什么？

**答题要点**：`<? extends T>` 上界通配，能读成 T、不能写（除 null）；`<? super T>` 下界通配，能写 T、读出来是 Object。**PECS**：Producer-Extends（集合是你的数据来源、你从中读→用 extends），Consumer-Super（你往集合写→用 super）。典型：`Collections.copy(List<? super T> dest, List<? extends T> src)`、`Comparator<? super T>`。

**追问链**：返回值为什么不建议用通配符？→ 会把处理麻烦转嫁给调用方，API 难用。

## 题 4：`List<Object>` 和 `List<?>` 一样吗？

**答题要点**：不一样。`List<?>` 是"某个未知具体类型的列表"——**不能往里 add 任何非 null 元素**（编译器不知真实类型），读出来当 Object；`List<Object>` 是"元素类型为 Object 的列表"，可以 add 任何对象。另外 `List<String>` 是 `List<?>` 的一种，但**不是** `List<Object>`（泛型不具协变性，`List<String>` 与 `List<Object>` 无父子关系，除非用通配符）。

## 题 5：既然擦除，Spring 为什么能按 `List<PaymentHandler>` 精确注入？

**结构化回答**：

1. 擦除针对**运行期的对象实例与局部变量**；但**字段声明、方法参数、类继承的泛型签名**是写进 class 文件元数据的，反射能读到（`Field.getGenericType()` 返回 `ParameterizedType`）。
2. Spring 在依赖注入时读取注入点的通用类型，解析出元素类型 `PaymentHandler`，再去容器里收集所有该类型 Bean 组装成 List。
3. 同理 Gson 的 `TypeToken`、MyBatis 的 `TypeReference` 用"超类型令牌"技巧捕获完整泛型——都是子类匿名类把泛型固化进 `getGenericSuperclass()`。

## 高频追问速答

1. `List<String>` 是 `List<Object>` 的子类型吗？→ 不是，泛型不协变；要用 `List<? extends Object>` 表达关系。
2. 什么是桥方法？→ 泛型/协变返回下编译器生成的合成方法，衔接擦除签名与具体签名，保证多态分派正确。
3. `<T>` 和 `<?>` 区别？→ 前者是声明的类型参数（可用作 new/约束），后者是无界通配符（只能用于使用处）。
4. 泛型能提高性能吗？→ 运行期基本无差别（擦除+强转），收益在编译期类型安全、去样板强转。
5. 为什么不能用基本类型作类型参数？→ 擦除到 Object 需装箱，`List<int>` 非法，用 `Integer` 或专用结构（如 `IntArrayList`）。
