# 字符串、包装类型与对象等值契约

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：讲清 `String` 为何不可变、字符串常量池与 `intern` 的边界；解释自动装箱缓存导致的 `==` 判等陷阱与拆箱 NPE；把 `equals`/`hashCode`/`compareTo` 三者的**契约**刻进肌肉记忆——它们是上一节 HashMap 正确性的前提，也是 record、`@Data`、集合去重、排序线上事故的总根源。

## 一、String 的不可变与常量池（★★★☆☆）

`String` 内部是 `final` 的 `byte[]`（JDK9 起紧凑字符串，Latin-1 单字节存）或 `char[]`（JDK8），一旦构造不可修改。不可变不是洁癖，而是三重刚需：

- **可安全入池复用**：相同字面量共享一个对象（字符串常量池 StringTable）。
- **可缓存 hash**：`hashCode` 算一次存进 `hash` 字段，作 Map key 极快。
- **天然线程安全 + 可作 map key/安全传参**：不会被别处偷偷改掉。

```java
String a = "abc";              // 字面量 → 常量池
String b = "abc";              // 命中池，与 a 同一对象 → a == b 为 true
String c = new String("abc"); // 强制在堆上 new 一个新对象 → a == c 为 false，a.equals(c) 为 true
String d = "ab" + "c";         // 编译期常量折叠 → 仍是池里的 "abc"
String e = "ab"; String f = e + "c"; // 变量拼接 → 运行期走 StringBuilder，产生新堆对象
```

`intern()` 手动把字符串登记/查找进常量池。**经典面试题**"`new String("ab")` 创建几个对象"：池里若无 `"ab"`，创建 2 个（池中 1 个 + 堆上 1 个）；已有则只创建堆上 1 个。循环里大量 `+` 拼接要显式用 `StringBuilder`（JIT 对简单场景已优化，但跨语句/闭包内拼接仍会退化出多个 builder）。

## 二、自动装箱、缓存与拆箱陷阱（★★★★☆）

`Integer x = 100;` 实际调 `Integer.valueOf(100)`，而 `valueOf` 对 **-128~127** 走 `IntegerCache` 复用（可通过 `-XX:AutoBoxCacheMax` 调上界）。`Long/Short/Byte/Character` 同样有缓存区间，`Boolean` 只有 TRUE/FALSE 两枚，**`Float/Double` 没有缓存**（值域连续无法枚举）。于是：

```java
Integer a = 127, b = 127; System.out.println(a == b); // true（命中缓存，同一对象）
Integer c = 128, d = 128; System.out.println(c == d); // false（超出缓存，两个不同对象）
System.out.println(c.equals(d));                      // true —— 包装类比较永远用 equals
```

**拆箱 NPE 三连**，线上高频：

```java
Integer n = null;
int m = n;                       // 拆箱 n.intValue() → NullPointerException
Object obj = 1;
int v = (Integer) obj == 1 ? 1 : 2; // 混合基本类型与包装，触发拆箱；若另一侧为 null 直接 NPE
// 三目两分支类型不一致会被提升为同一类型并拆箱，是隐蔽 NPE 源
```

> 铁律：**包装类型之间比较一律 `.equals()` 或 `Objects.equals()`；实体字段用包装类型（区分 null 与 0），但参与运算前先判空**。

## 三、equals / hashCode 契约：HashMap 正确性的地基（★★★★★）

`Object` 规定两条必须同时遵守的契约：

1. **equals 五性质**：自反、对称、传递、一致、`x.equals(null)` 恒为 `false`。
2. **equals/hashCode 联动**：**`a.equals(b) == true` ⇒ `a.hashCode() == b.hashCode()`**（反之不必须，叫哈希冲突）。

为什么必须一起重写？`HashMap` 定位是"先按 `hashCode` 找桶，再在桶内用 `equals` 判等"。若只重写 `equals` 不重写 `hashCode`：

```java
map.put(new Key(1), "v");
map.get(new Key(1));   // 新对象 hashCode 不同 → 落到别的桶 → 返回 null，明明"相等"却取不到！
// 更糟：这些"永远取不回"的 entry 堆积 → 内存泄漏
```

**正确姿势**：用 IDE/`Objects.equals`+`Objects.hash` 让二者**只用同一组字段**；JDK16+ 直接用 `record`——编译器自动生成"值语义"的 equals/hashCode/toString，从根上杜绝不一致。Lombok `@Data`/`@EqualsAndHashCode` 会生成，但要警惕它把**所有非静态字段**纳入，混入集合/可变字段会引爆（见下）。

## 四、compareTo 与 equals 一致性（★★★★☆）

`Comparable<T>.compareTo` 用于 `TreeMap/TreeSet/Collections.sort`。**有序集合判等靠 `compareTo==0`，不看 `equals`**。若二者不一致：

```java
// BigDecimal 经典反例：compareTo 忽略标度，equals 看标度
new BigDecimal("1.0").equals(new BigDecimal("1.00")); // false
new BigDecimal("1.0").compareTo(new BigDecimal("1.00")); // 0
TreeSet<BigDecimal> s = new TreeSet<>();
s.add(new BigDecimal("1.0")); s.add(new BigDecimal("1.00"));
System.out.println(s.size()); // 1！第二个被 TreeSet 判为"重复"而吞掉
```

**建议**：实现 `Comparable` 时让 `sgn(compareTo(x,y)) == equals(x,y)` 一致（`String`、包装类都满足）；不一致要在类文档显著标注。金额比较用 `compareTo`，别用 `equals`（`1.0` 与 `1.00` 标度不同会误判），详见 s2-4 精度专题。

## 五、可变对象做 Key：哈希雪崩（★★★★☆）

用**可变字段参与 hashCode** 的对象作 `HashMap` key，put 之后再改这些字段 →  hashCode 变了 → 对象"漂移"到错误的桶 → `get`/`remove` 再也找不到它，且它永远赖在 map 里造成泄漏。

**对策**：作 key 的对象要么不可变（`String`/`record`/`Integer`），要么 hashCode 只基于**不会变的字段**（如实体主键 id）。

## 六、动手题

1. 写一个只重写 `equals` 不重写 `hashCode` 的 `Key` 类，放进 `HashMap` 再 `get`，复现"存进去取不出来"，再补 `hashCode` 修复。
2. 用 `Integer a=127,b=127` 与 `Integer a=128,b=128` 分别 `==` 与 `equals`，观察缓存区间；再用 `-XX:AutoBoxCacheMax=1000` 重跑验证。
3. 把一个 `record Point(int x,int y)` 与一个字段相同的普通类分别放入 `HashSet`，验证 record 的值语义去重生效。

## 七、关联技术栈

- **向前**：equals/hashCode 只用同一组字段 ↔ S1-3 HashMap 的桶内判等与树化
- **精度延伸**：`BigDecimal` 比较与标度、金额精度 ↔ s2-4
- **现代语法**：`record` 自动生成值语义 equals/hashCode/toString ↔ java-modern s1-2
- **并发可见性**：`String` 不可变 + final 字段的"安全发布" ↔ juc s1-1（final 与 happens-before）

## 八、本节小结

`String` 的不可变、装箱缓存的 `==` 陷阱、equals/hashCode/compareTo 三份契约，本质是同一件事：**Java 的"相等"有多个层次（引用 `==`、值 `equals`、序 `compareTo`、哈希 `hashCode`），必须选对并保持一致**。至此阶段一收官。

下一节进入阶段二，先看泛型与类型擦除——它决定了这些对象在集合里"看起来的类型"和"运行期真实的类型"之间的落差。
