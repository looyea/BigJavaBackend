# 面向对象核心与多态真相

> 本节难度 ★★☆☆☆ · 重要性 ★★★★★
> 学习产出：能画出一张方法调用的字节码→运行期分派链路图，说清"重载看编译期、重写看运行期"的底层依据，并避开构造器多态、协变返回、`super`/`this` 的经典坑。

## 一、面向对象是什么（★★☆☆☆）

Java 的面向对象不是"封装/继承/多态"三个名词的背诵，而是一套**用抽象边界隔离变化**的工程方法：

- **封装**：把易变实现藏进稳定的接口之后。语言层面提供 `private/包级/protected/public` 四级访问，字节码层面每个字段和方法都带访问标志。
- **继承**：`extends` 建立"is-a"复用关系，单继承；`implements` 建立"can-do"能力契约，可多实现。
- **多态**：父类引用指向子类对象，同一句 `p.dog()` 在不同运行期把消息分派给不同实现。多态是**继承 + 重写 + 向上转型**三者合力的结果，缺一不构成运行期多态。

```java
abstract class Animal { abstract void sound(); }
class Dog extends Animal { @Override void sound() { System.out.println("汪"); } }
class Cat extends Animal { @Override void sound() { System.out.println("喵"); } }

Animal a = new Dog();   // 向上转型
a.sound();              // 编译期只看 Animal，运行期跳到 Dog 的实现 → 汪
```

## 二、它解决了什么问题（★★☆☆☆）

没有多态，业务里就会写满 `if (type == DOG) ... else if (type == CAT) ...`。每加一种动物，都要改这段判断，违反**开闭原则**。多态把"选择哪个实现"的决策**从调用点下推到对象自身**：新增一个子类，调用方代码零改动。

这正是后端框架的命脉：Spring 的 `HandlerAdapter`、MyBatis 的 `TypeHandler`、JDBC 的 `Driver`、Servlet 容器的 `Filter` 链，全都依赖"面向接口 + 运行期多态分派"，才能做到插件式扩展。

## 三、类、抽象类、接口的边界（★★★☆☆）

| 维度 | 类 | 抽象类 | 接口 |
| --- | --- | --- | --- |
| 继承/实现数量 | 单继承 | 单继承 | 多实现 |
| 实例化 | 可（非抽象） | 不可 | 不可 |
| 成员变量 | 任意 | 任意（可有状态） | 只能 `public static final` 常量 |
| 构造器 | 有 | 有（供子类 `super`） | 无 |
| 方法体 | 有 | 可有抽象/具体 | Java 8 起允许 `default`/`static`，Java 9 起允许 `private` 方法 |
| 语义 | "是什么" | "is-a + 部分共享实现" | "can-do 能力契约" |

选型经验：**优先面向接口**；当多个实现要共享字段和构造逻辑时，再抽一层抽象类（`AbstractList`、`AbstractMap` 就是这个套路，称为骨架实现 Skeleton Implementation）。

## 四、重写 vs 重载：多态的两副面孔（★★★★☆）

- **重载 Overload**：同类中方法名同、参数列表不同。**编译期**依据"静态类型 + 实参"确定调用签名，写进 `invokestatic/invokevirtual` 指令的常量池索引，属于**静态分派**。
- **重写 Override**：子类替换父类方法实现。**运行期**依据"对象的实际类型"确定，属于**动态分派**。

重写三条硬约束（编译器强制）：

1. 参数列表必须完全一致，返回值可为**协变类型**（子类，Java 5 起）。
2. 访问权限**只能放宽不能收紧**（`public`→`protected` 报错）。
3. 抛出检查异常不能比父类方法更宽。

## 五、多态的底层真相：虚方法表（★★★★★）

每个类在方法区持有一张**虚方法表 vtable**，条目是该类所有可被重写的方法的直接指针。子类表复制父类表后，把被重写项替换为子类自己的入口地址。运行期调用流程：

```flow
对象引用 ref → Mark Word 定位对象头 → 找到所属类的 vtable → 按方法在表中的固定索引 slot 取地址 → 跳转到真实方法
```

要点：

- `private`、`static`、`final` 方法和构造器**不在 vtable 里**，用 `invokespecial/invokestatic` 直接绑定，天然不可多态。
- JIT 若发现分派目标唯一（monomorphic），会把虚调用**内联**掉，退化成直接调用——这就是"过度抽象会拖慢热点路径"的物理原因。

```flow
编译期 invokeinterface/invokevirtual 只记录符号引用 → 运行期按实际类型查表 → 命中子类实现
```

## 六、特别注意点（★★★★☆）

1. **构造器里的多态陷阱**：父类构造器中调用被子类重写的方法，此时子类尚未完成初始化，字段还是默认值。绝不要在构造器调用可被重写的方法（Effective Java Item 19）。

   ```java
   class Super { int n = 1; Super(){ print(); } void print(){ System.out.println("super"); } }
   class Sub extends Super { private final int m = 100;
       @Override void print(){ System.out.println(m); } }   // 打印 0，不是 100
   ```

2. **字段没有多态**：`a.name` 取的是**静态类型**声明的字段，字段是静态绑定的，只有方法动态绑定。
3. **`super.x` 绕过重写**：在子类方法里 `super.m()` 直接按父类 vtable 调用，不进入动态分派。
4. **接口 default 冲突**：两接口有同名 `default` 方法，实现类**必须重写**消歧，编译不通过。
5. **桥方法 bridge method**：泛型 + 协变返回会让编译器生成一座合成方法衔接签名，反编译看到 `access$0`、`bridge` 别慌。

## 七、动手题

1. 只用 `Animal/Dog/Cat`，写一个 `feed(Animal a)` 方法，用多态避免 `instanceof` 判断；再故意在父类构造器调用可重写方法，打印出那个"0"的现象并解释。
2. 用 `javap -v` 反编译一个含抽象父类与实现子类的工程，找出子类的 vtable 中方法条目，确认被重写方法的索引位置与父类一致。

## 八、关联技术栈

- **字节码**：`invokespecial`（构造/private/super）、`invokestatic`、`invokevirtual`、`invokeinterface`、`invokedynamic`
- **集合框架**：`AbstractList`/`AbstractMap` 的骨架实现即抽象类复用的典范（下一节）
- **Spring**：`@Override` 与接口分派是 AOP 代理、策略模式落地的地基
- **泛型与类型擦除**：桥方法（阶段二 s2-1 深入）

## 九、本节小结

多态不是语法糖，而是"**编译期只认符号、运行期按真实类型查 vtable 绑定**"的机制。理解它，才能理解为什么框架能插件式扩展，也才能避开构造器时序、字段静态绑定、协变桥方法这些一线高频坑。

下一节进入集合框架全景，看这套抽象能力如何撑起 `Collection`/`Map` 的整个体系。
