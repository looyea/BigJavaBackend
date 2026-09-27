# 小测验 · 字符串、包装类型与对象等值契约

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. `String a = "abc"; String c = new String("abc");`，则 `a == c` 与 `a.equals(c)` 分别是？（15分）

- A. true / true
- B. false / true
- C. true / false
- D. false / false

> 答案：B
> 解析：`==` 比引用，`new String` 在堆上另建对象与池中 `"abc"` 不同 → false；`equals` 比内容 → true。

### 2. `Integer a = 127, b = 127, c = 128, d = 128;` 则 `a==b` 与 `c==d` 分别是？（15分）

- A. true / true
- B. false / false
- C. true / false
- D. false / true

> 答案：C
> 解析：`valueOf` 对 -128~127 走 `IntegerCache` 复用同一对象，`a==b` true；128 超缓存各 new 一个，`c==d` false。比较包装类应用 `equals`。

### 3. 【多选】关于 equals 与 hashCode 契约，正确的有哪些？（20分）

- A. `a.equals(b)` 为 true 必须 `a.hashCode()==b.hashCode()`
- B. hashCode 相等则 equals 一定相等
- C. 重写 equals 就必须重写 hashCode，且二者只用同一组字段
- D. 只重写 equals 不重写 hashCode，会让"逻辑相等"的对象在 HashMap 里存进去取不出来

> 答案：ACD
> 解析：B 反了——hashCode 相同只是冲突，equals 未必相等（允许）。A/C/D 是契约与后果的正确描述。

### 4. 判断：`TreeSet` 判断两个元素是否重复，依据的是元素的 `equals` 方法。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：有序集合 `TreeSet/TreeMap` 靠 `compareTo==0`（或 Comparator）判等，不看 equals。`BigDecimal("1.0")` 与 `("1.00")` 会被判重复而吞掉。

### 5. 填空题：`Integer n = null; int m = n;` 会抛 ______；作 HashMap key 的对象应当是不可变类型（如 String、______），否则其字段变化会使 hashCode 漂移、元素再也取不回。（15分）

> 答案：NullPointerException（NPE） / record
> 解析：`int m = n` 触发拆箱 `n.intValue()` 对 null 抛 NPE；可变对象做 key 会"哈希雪崩"，用 String/包装类/record 规避。

### 6. 简答题：说出 `equals` 应满足的性质、它与 `hashCode` 的联动规则，并解释"可变对象做 HashMap key"为何造成内存泄漏。（25分）

> 参考答案：
> - equals 五性质：自反、对称、传递、一致、与 null 比较恒 false
> - 联动：equals 相等 ⇒ hashCode 必须相等（反之不必）；重写 equals 必须同时重写 hashCode 且用同一组字段
> - 可变 key：put 后若改变参与 hashCode 的字段 → hashCode 变化 → get 定到错误的桶找不到，但该 entry 仍占空间无法移除 → 堆积即内存泄漏
> - 规避：key 用不可变类型，或 hashCode 只基于不变字段（如主键）
