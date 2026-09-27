# 泛型与类型擦除

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：理解 Java 泛型是**编译期检查 + 运行期擦除**的折中设计，记住擦除带来的那串"不能"（不能 `new T()`、不能 `instanceof T`、不能建泛型数组、静态上下文不能用类型参数、重载不能只靠类型参数区分），并熟练运用**通配符与 PECS 原则**写出可扩展的 API。这是读懂集合源码、Spring 泛型注入（`List<Handler>`）的前提。

## 一、泛型解决什么，又为何"消失"（★★★☆☆）

JDK5 前集合存的都是 `Object`，取用要手动强转、编译期无法发现放错类型。泛型把类型检查**提前到编译期**，消除样板强转。代价是它用了**类型擦除（type erasure）**：编译后类型参数被替换为其**边界**（无界 `<T>` → `Object`，`<T extends Number>` → `Number`），字节码里几乎不保留 `<String>` 这类信息。

```flow
源码 List<String> → 编译期类型检查（塞 Integer 直接编译失败）
                 → 擦除：运行期就是 List（元素取用处插入强转 (String)）
                 → 与 JDK5 前 raw List 二进制兼容
```

**为什么擦除**：为了向后兼容存量代码与字节码格式，是一种历史妥协（对比 C# 保留运行期泛型）。它带来能力，也带来下面一连串限制。

## 二、擦除带来的"不能"清单（★★★★☆）

| 写不出来 | 原因 | 绕法 |
| --- | --- | --- |
| `new T()` / `T.class` | 运行期没有 T 的类型信息 | 传 `Class<T>` 或用反射工厂 |
| `x instanceof T` | 擦除后无 T 可判 | 判原始类型，或传类型令牌 |
| `new T[n]`（泛型数组） | 数组协变需要运行期元素类型 | `List<T>` 替代，或 `(T[])new Object[n]`+抑制警告 |
| `catch(T e)`（`T extends Exception`） | 擦除后异常类型不明 | catch 边界类型 |
| `f(List<String>)` 与 `f(List<Integer>)` 重载 | 擦除后签名相同 → 冲突 | 换方法名 |
| 静态字段/方法用类的 `<T>` | 静态上下文与实例类型参数无关 | 方法自带 `<E>` |

补充：类型参数不能是基本类型（`List<int>` ❌，用 `Integer`，装箱代价见 s1-4）；泛型 + 协变返回会生成**桥方法（bridge method）**衔接签名——这正是 s1-1 vtable 里那个合成方法。

## 三、通配符 `?` 与 PECS 原则（★★★★★）

无界通配符 `List<?>` 表示"某具体但未知类型的 List"，**读当 Object、写除 null 都不行**（编译器不知真实类型）。真正价值在**有界通配符**，配合 **PECS**：

- **Producer Extends**——集合作为**生产者**（你从里面**读**）：用 `<? extends T>`。
- **Consumer Super**——集合作为**消费者**（你往里**写**）：用 `<? super T>`。

```java
// 例子目的：PECS 法则（Producer-Extends, Consumer-Super）——从 src 读用 extends，往 dest 写用 super
double sumOfNumbers(Collection<? extends Number> c) {   // 只读（生产 Number）→ extends
    double s = 0;
    for (Number n : c) s += n.doubleValue();             // 读出来当 Number 用，合法
    return s;
}
void addItems(Collection<? super Integer> c) {          // 只写（消费 Integer）→ super
    c.add(1); c.add(2);                                   // 能往 <? super Integer> 里安全写 Integer
}
// 正确用法结果：sumOfNumbers(List.of(1, 2.5)) 返回 3.5；addItems(new ArrayList<Number>()) 后列表变 [1, 2]
// 错误用法：读用 super——对 Collection<? super Integer> 调 get 只能得到 Object，无法当 Integer 直接参与运算（编译期类型不兼容）
// 错误用法：写用 extends——c = Collection<? extends Integer> 时调 c.add(1) 报错 cannot add elements to a collection with wildcard-extends
```

`Comparator<? super T>`（`TreeSet`/`sort` 参数）同理：比较器**消费**你的元素，允许其处理父类型。

## 四、泛型方法与设计建议（★★★★☆）

**优先在方法上声明类型参数**（`<T> T first(List<T> l)`），比类级更灵活。API 设计经验（Effective Java）：

1. **库/框架的入参尽量用通配符**提升可用性（`? extends`/`? super`），**返回值不要用通配符**（逼调用方处理麻烦）。
2. 别让客户端不得不强转返回的 `Object`——那说明泛型没设计好。
3. 需要"运行期真实类型信息"的场景（序列化、依赖注入按类型匹配），用**超类型令牌 / `Class<T>` / `ParameterizedType`** 把泛型信息显式带进运行期。

> **框架回响**：Spring 的 `@Autowired List<PaymentHandler>` 按**泛型元素类型**注入所有实现、MyBatis 的 `TypeReference`、Gson 的 `TypeToken`，都靠反射读取"擦除后仍留在类签名/字段声明里"的泛型信息——擦除擦的是**局部变量与运行时对象**，**类/方法/字段的声明签名仍保留泛型元信息**，框架正是利用这一点。

## 五、动手题

1. 写一个 `<T extends Comparable<? super T>> void sort(List<T>)`，解释为什么约束里还要 `? super`。
2. 尝试 `List<String>[] arr = new ArrayList<String>[2];` 观察编译错误，改用 `List<List<String>>` 或带 `@SuppressWarnings("unchecked")` 的 `(List<String>[]) new List[2]`，对比安全性。
3. 用一个 `Class<T>` 令牌实现 `T create(Class<T> c)`（`c.getDeclaredConstructor().newInstance()`），体会绕开 `new T()` 的标准套路。

## 六、关联技术栈

- **向前**：桥方法、协变返回 ↔ s1-1（多态与 vtable）；`Comparable` ↔ s1-4（等值契约）
- **集合源码**：`Collections.copy`、`Comparator<? super T>`、`AbstractList<E>` 骨架 ↔ s1-2/s1-3
- **框架应用**：Spring 泛型注入/`ResolvableType`、Gson `TypeToken` ↔ spring-core s1-2、s3-2 反射
- **现代演进**：更安全的泛型相关能力见 java-modern（如 record 的类型参数、switch 模式匹配对泛型的增强）

## 七、本节小结

Java 泛型 = **编译期强检查 + 运行期擦除换兼容**。记住："擦除"带来一堆 `new T()`/`instanceof T`/泛型数组的"不能"，用 `Class<T>`/通配符/集合替代来化解；写 API 时把 **PECS（读用 extends、写用 super）** 当肌肉记忆。

下一节看异常体系——受检 vs 非受检的取舍，以及 try-with-resources 背后的资源释放契约。
