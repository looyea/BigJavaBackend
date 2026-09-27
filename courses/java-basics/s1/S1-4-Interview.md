# 实际面试题 · 字符串、包装类型与对象等值契约

> 等值契约是"看着简单、一问就翻车"的典型，且直接连着上一节 HashMap。答好它 = 展示你懂 JVM 内存、懂集合正确性前提、有排障经验。

## 题 1：`String` 为什么设计成不可变？带来哪些好处？

**答题要点**：

- 内部 `final byte[]`（JDK9 紧凑字符串）/`char[]`，构造后不能改。
- 好处：① 可安全进字符串常量池复用、省内存；② hashCode 可缓存，作 Map key 快；③ 天然线程安全、可安全共享传参；④ 安全——作类名/URL/连接参数不被中途篡改。

**追问链**：

1. `String` 拼接性能？→ 单语句 `+` 编译器转 `StringBuilder`；循环内跨语句要显式复用 `StringBuilder`，否则每轮 new。
2. `intern()` 干嘛？→ 把字符串登记/查找进常量池，返回池中引用；大量重复串可省内存但别滥用（池在元空间/堆，扫描有成本）。

## 题 2：`Integer a=127,b=127` 与 `a=128,b=128`，`a==b` 结果为何不同？

**答题要点**：`Integer x=...` 走 `valueOf`，对 **-128~127** 命中 `IntegerCache` 复用同一对象（`==` true），超出则各 new（`==` false）。`Long/Short/Byte/Character` 有类似缓存，`Boolean` 仅两枚，`Float/Double` 无缓存。结论：包装类比较永远用 `equals`。

**追问链**：能改缓存上界吗？→ `-XX:AutoBoxCacheMax` 可调 Integer 上界，但不该依赖它写正确性逻辑。

## 题 3：为什么重写 equals 必须重写 hashCode？只重写一个会怎样？

**答题要点**：契约是"equals 相等 ⇒ hashCode 相等"。HashMap 定位 = 先用 hashCode 定桶、再用 equals 桶内判等。只重写 equals 时，两个逻辑相等对象 hashCode 不同 → 落到不同桶 → `put` 进去的对象 `get` 取不回，且这些取不回的 entry 永久占位造成内存泄漏。

**追问链**：hashCode 相等 equals 就一定相等吗？→ 不一定，那只是哈希冲突，允许。

## 题 4：为什么不建议用可变对象当 HashMap/HashSet 的 key？

**答题要点**：若参与 hashCode 的字段在 put 后被修改，对象 hashCode 变了 → 下次 get 定到错误的桶找不到，元素"漂移"在表里既取不回也删不掉 → 泄漏。对策：key 用不可变类型（`String`/包装类/`record`），或 hashCode 只基于不变字段（主键 id）。

## 题 5：`compareTo` 和 `equals` 不一致会引发什么线上问题？

**结构化回答**：

1. `TreeSet/TreeMap` 判重靠 `compareTo==0`（或 `Comparator`），**不看 equals**；`HashSet/HashMap` 靠 equals+hashCode。
2. 不一致典型：`BigDecimal` 的 equals 看标度（`1.0≠1.00`），compareTo 忽略标度（`1.0==1.00`）→ TreeSet 会把二者当重复吞掉，只剩 1 个。
3. 后果：同一批数据进不同集合"数量对不上"、去重结果诡异。
4. 建议：实现 Comparable 时尽量让"序判等"与 equals 一致，不一致必须写文档；金额统一标度或用最小单位整数。

## 高频追问速答

1. `==`、`equals`、`compareTo`、`hashCode` 四者分别比什么？→ 引用、内容值、排序序、哈希桶位。
2. record 能替代手写 equals/hashCode 吗？→ 能，编译器按全部组件生成值语义三件套，杜绝不一致。
3. Lombok `@Data` 的坑？→ 默认把全部非静态字段纳入 equals/hashCode/toString，混入可变/集合字段易出事，宜用 `@EqualsAndHashCode(onlyExplicitlyIncluded=true)` 或直接 record。
4. `String` 放常量池还是堆？→ 字面量进池，`new` 进堆，`intern` 回指池中。
5. 拆箱什么时候 NPE？→ 包装值为 null 参与运算/赋值给基本类型/进三目统一类型时。
