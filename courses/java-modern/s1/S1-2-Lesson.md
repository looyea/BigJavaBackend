# Java 17 LTS：语言结构现代化

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：掌握让 Java "写法换代"的四大结构特性——**record（不可变数据载体）、sealed（受限类型层级）、instanceof / switch 模式匹配、文本块**，理解它们如何把 java-basics 里 s3-3 谈的"设计取向"落到语法层：用更少的样板表达更强的约束。会用来写**代数数据类型（ADT）+ 穷尽匹配**，这是现代 Java 领域建模的主流姿势。

## 一、record：一句话写完一个数据类（★★★★☆）

```java
// 例子目的：定义一个不可变值对象 Money，展示 record 自带能力与紧凑构造器的校验/归一化
public record Money(long amountCents, String currency) {   // 不可变、自带全参构造/同名访问器/equals/hashCode/toString
    public Money {                         // 紧凑构造器：校验/归一化（无 super 调用）
        if (amountCents < 0) throw new IllegalArgumentException("金额不能为负");
        currency = currency.toUpperCase();               // 归一化：构造时就大写化
    }
    public boolean isZero() { return amountCents == 0; }   // 可加自定义方法
}
// 正确用例：new Money(1000, "cny") → amountCents()=1000、currency()="CNY"（已被紧凑构造器转大写）；两个 new Money(1000,"cny") 的 equals 为 true（按字段逐一比较）
// 错误用例：new Money(-1, "cny") → 紧凑构造器抛 IllegalArgumentException: 金额不能为负
// 错误用例：试图 money.amountCents = 5 或 money.currency="x" → 编译报错，record 字段都是 final 不可变
```

record 是**有意为之的"透明数据载体"**：所有字段 `final`、访问器与组件同名（`m.amountCents()` 而非 `getAmountCents()`）、默认浅不可变。它天生适合 DTO、值对象、Map key（自带正确的 equals/hashCode，呼应 s1-4 等值契约）、方法内多返回值。

- **局限**：不能继承别的类（隐式 `final`、只能 implements 接口）、无紧凑构造器外的多构造灵活性、字段仍是浅不可变（内含可变对象要防御性拷贝，呼应 s1-1 安全发布）。
- **别把它当 Lombok `@Value` 的替代纠结**：语义更清晰、编译期生成、无需注解处理器（对照 s3-2 APT）。

## 二、sealed + 模式匹配：给类型层级上"户口"（★★★★★）

**sealed** 限定谁能继承/实现一个类型，形成**可枚举、封闭**的类型层级；配合 **instanceof 模式匹配**与 **switch 模式匹配**，编译器能做**穷尽性检查**——这正是函数式语言代数数据类型（ADT）的味道。

```java
// 例子目的：sealed 接口 + record 代数数据类型 + switch 类型模式匹配，把"支付结果"的分支写完备
public sealed interface PayResult
        permits PaySuccess, PayFailed, PayPending {}   // 只有这三个能实现

record PaySuccess(String tradeNo, Money amount) implements PayResult {}
record PayFailed(String code, String reason) implements PayResult {}
enum PayPending implements PayResult { IN_PROGRESS }   // 允许枚举/类混合

String describe(PayResult r) {
    return switch (r) {                              // 对密封类型做穷尽分派
        case PaySuccess s -> "成功 " + s.tradeNo();   // 模式变量 s 直接当 PaySuccess 用，无需先 instanceof+强转
        case PayFailed f -> "失败 " + f.code();
        case PayPending p -> "处理中";
        // 若漏一个分支，sealed + 穷尽检查直接编译报错
    };
}
// 正确用例：describe(new PaySuccess("T1", money)) 返回 "成功 T1"；新增一个 permit 类型后忘补 case → 编译期报错，不会漏到运行时
// 错误用例：对非 sealed 的普通接口做同样的 switch 不写 default → 穷尽检查失效，运行时并上未知实现会抛 IndexOutOfBoundsException/MatchException
```

- **instanceof 模式匹配**（16 转正，17 可直接用）：`if (o instanceof String s) { return s.length(); }`——告别"先判断再强转"两步。（switch 里的类型模式/record 解构则是 17 预览、21 转正，见本节末提示。）
- **sealed 的价值**：把"这个接口/抽象类到底有哪几种实现"变成编译期契约，新增实现必须显式 `permits`，防失控扩展；配合 switch 穷尽，新增一种结果忘了处理直接编译不过——**把"记得处理所有分支"从人肉纪律变成编译器保证**。

## 三、文本块与 switch 表达式（★★★☆☆）

这两项虽在 14/15 转正，但随 17 LTS 一起进入主流生产视野：

```java
// 例子目的：文本块写多行字符串 + switch 表达式求月份天数（有返回值、箭头不穿透）
String sql = """                                    // 多行不再 "...\n"+"..." 拼接，自动去缩进、保留格式
        SELECT id, amount
        FROM orders
        WHERE status = 'PAID'
        """;
int days = switch (month) {                          // switch 表达式：整个 switch 有返回值
    case JAN, MAR, MAY, JUL, AUG, OCT, DEC -> 31;     // 多个常量用逗号，箭头不会 fall-through 穿透
    case APR, JUN, SEP, NOV -> 30;
    case FEB -> leap ? 29 : 28;
    default -> throw new IllegalArgumentException(String.valueOf(month));   // 兵底：非法值直接抛
};
// 正确用例：month=FEB、leap=false 时 days=28；sql 就是三行 SQL，行首多余缩进被自动去除
// 错误用例：写成 switch 语句（无赋值、用旧 case: break）却忘写 break → 旧式 fall-through 穿透到下一个分支，算出错误天数
// 错误用例：month 传 null 进 switch → 直接抛 NullPointerException（即使有 default 也不接 null）
```

switch 表达式让"多路赋值"从冗长的 switch-case-break 或 if-else 链，收敛为一个**表达式**，配合 sealed 穷尽尤其安全。

## 四、为什么是"结构现代化"（★★★★☆）

17 之前（含 9-11）多是**库与工具**层面的增量；17 集中交付的是**改变你组织代码方式**的语言结构：数据用 record 表达、类型层级用 sealed 约束、分支用模式匹配穷尽。三者合起来，把大量"防御式样板 + 人肉纪律"替换成"声明式约束 + 编译器兜底"。这也是绝大多数团队"要么还停 8/11，要么直接上 17"的原因——17 才是值得跨的那道版本坎。

> 呼应 s3-3：Java 依旧"渐进、不破兼容"——record 不强制你放弃类、sealed 是可选的、老代码照常编译。现代特性是"增强"而非"替换"。

## 五、动手题

1. 把一个含 5 个字段、手写 getter/setter/equals/hashCode 的 VO 重写成 record，并用紧凑构造器加校验。
2. 用 sealed interface + 若干 record 建模"订单状态"，写一个 switch 模式匹配方法处理全部子类型；故意删掉一个分支，观察穷尽性检查的编译错误。
3. 把一段 `"line1\nline2\n"` 拼接和一段 if-else instanceof 强转链，分别改写成文本块与模式匹配。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| record 当 DTO，反序列化后字段是"旧值" | 组件是 final，Jackson 需按 record 构造器反序列化（配 `jackson-databind` 2.12+） |
| 给 record 加了个可变 `List` 组件被外部改 | record 只保证引用不可变，需防御性拷贝 |
| sealed 类型加新实现编译不过 | 忘了写进 `permits` / 未与接口同包（或子包同 classloader） |
| switch 模式匹配漏分支线上 NPE/漏处理 | 未用 sealed 穷尽、或用了带 default 吞掉新增类型 |

## 七、关联技术栈

- **向前**：record 的等值语义 ↔ s1-4；不可变与安全发布 ↔ s1-1/s1-4；"设计取向/克制" ↔ s3-3
- **向后**：record 解构模式、switch 穷尽完善在 Java 21（下一节）；Lombok 与 record 取舍 ↔ 构建工具
- **建模范式**：ADT + 模式匹配 ↔ 领域驱动设计里"显式建模状态/结果类型"

## 八、本节小结

17 的四件套一句话记：**record 管数据、sealed 管类型层级、模式匹配管分支、文本块/switch 表达式管表达**。核心价值是把约束交给编译器（穷尽、封闭、不可变），减少人肉纪律。它是"停 8/11"与"追 21"之间那道最值得跨的现代化门槛。

下一节 Java 21 LTS——虚拟线程正式转正，并发成本被彻底改写。
