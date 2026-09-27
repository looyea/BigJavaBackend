# 作业题 · 面向对象核心与多态真相

> 作业不判分，做完对照参考答案自查。全部要求手写并能在 JDK 17+ 编译运行。

## 作业 1：多态替代 if-else（必做）

设计一个"支付手续费计算器"：定义接口 `FeeStrategy`，含 `BigDecimal fee(BigDecimal amount)`。用 `PercentFee`（按比例）、`FixedFee`（固定额）、`FreeFee`（免手续费）三个实现类。写一个 `Charge` 类持有 `FeeStrategy`，通过多态计算费用。

要求：

1. 新增一种"阶梯费率"策略时，不修改任何已有计算代码（体会开闭原则）。
2. 用 `List<FeeStrategy>` 遍历演示"面向接口"。

**参考答案要点**：`Charge` 只依赖 `FeeStrategy` 接口；策略通过构造器注入；新增策略仅新增一个实现类。

## 作业 2：亲手复现构造器多态陷阱（必做）

写出课程里 `Super/Sub` 那段代码，运行观察打印结果，然后在 `Sub` 里把重写方法改成访问一个未初始化字段，用注释解释：

1. 为什么打印的是 `0` 而不是 `100`？
2. 给出两种修复方案（`final` 修饰方法 / 改用静态工厂）。

## 作业 3：反编译看 vtable（选做）

用 `javap -v -p` 反编译作业 1 编译出的 `PercentFee.class` 与 `Charge.class`：

1. 找到调用 `fee` 的指令是 `invokeinterface` 还是 `invokevirtual`，说明为什么。
2. 记录 `invokeinterface` 指令的操作数（索引 + 参数数量），理解运行期如何定位。

## 作业 4：重载决议推理（选做）

```java
static void f(Object o){ System.out.println("Object"); }
static void f(String s){ System.out.println("String"); }
static void f(Integer i){ System.out.println("Integer"); }

f(null);              // 打印什么？
f((Object) "x");      // 打印什么？
List<?> l = new ArrayList<String>();  // 泛型是否影响重载？
```

先手写预测，再运行验证，用"最具体适用方法 / maximal specific"解释 `f(null)` 的归属。
