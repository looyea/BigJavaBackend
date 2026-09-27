# 小测验 · 泛型与类型擦除

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. `List<String> ls = new ArrayList<>();` 编译擦除后，运行期 `ls.getClass()` 是？（15分）

- A. `List<String>` 的匿名类
- B. `ArrayList`（不携带 `<String>` 信息）
- C. `ArrayList<String>` 保留泛型
- D. 编译报错

> 答案：B
> 解析：类型参数被擦除，运行期对象就是原始 `ArrayList`，`<String>` 只在编译期检查用。

### 2. 一个方法只从传入的集合里**读取**元素，参数应声明为？（15分）

- A. `Collection<? super T>`
- B. `Collection<? extends T>`
- C. `Collection<T>` 且必须可变
- D. ` raw Collection`

> 答案：B
> 解析：PECS——集合作为生产者（你读）用 `extends`；作为消费者（你写）用 `super`。

### 3. 【多选】下列哪些是"类型擦除"直接导致的限制？（20分）

- A. 不能 `new T()` 或写 `T.class`
- B. 不能创建泛型数组 `new T[n]`
- C. 不能 `f(List<String>)` 与 `f(List<Integer>)` 构成重载
- D. 不能用 `for-each` 遍历泛型集合

> 答案：ABC
> 解析：D 无关，for-each 完全可用。ABC 都因运行期丢失 T 的类型信息而无法通过编译。

### 4. 判断：可以在方法体里写 `if (obj instanceof T)` 来判断泛型类型。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：擦除后无 T 可判，`instanceof` 只能用具体类型或类型令牌（`Class<T>.isInstance`）。

### 5. 填空题：PECS 全称为 Producer ______ / Consumer ______；`Collections.copy` 的源参数用 `List<? ______ T>`、目标参数用 `List<? ______ T>`。（15分）

> 答案：Extends / Super / extends / super
> 解析：读源（生产）用 extends，写目标（消费）用 super，是 PECS 的经典落地。

### 6. 简答题：说出 PECS 原则，并解释"擦除后为什么 Spring 仍能按 `List<PaymentHandler>` 的泛型元素类型注入所有实现"。（25分）

> 参考答案：
> - PECS：作为生产者（从中读）用 `? extends T`，作为消费者（向其写）用 `? super T`
> - 擦除擦的是运行期**局部变量与对象实例**的类型参数；但**类、方法、字段的声明签名**仍把泛型信息作为元数据保留
> - Spring 通过反射读取注入点（字段/构造器参数）的 `ParameterizedType`/`ResolvableType`，拿到元素类型 `PaymentHandler`，据此收集容器中所有该类型 Bean 注入
> - 同理适用于 Gson `TypeToken`、MyBatis `TypeReference`
