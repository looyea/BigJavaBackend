# 作业题 · 字符串、包装类型与对象等值契约

> 不判分，对照参考要点自查。

## 作业 1：对象计数与常量池（必做）

判断下列各语句分别在堆/常量池创建了几个 `String` 对象，并写出 `==`/`equals` 结果，再用 `System.identityHashCode` 实测验证：

1. `String a = "ab";`
2. `String b = "a" + "b";`
3. `String c = "a"; String d = c + "b";`
4. `String e = new String("ab");`
5. `String f = e.intern();`

**参考要点**：b 编译期折叠进池；d 运行期 StringBuilder 造新堆对象；e 堆上新建、f 经 intern 指回池中对象与 a 同。

## 作业 2：装箱缓存边界（必做）

写循环 `for (int i=-130;i<130;i++)` 生成 `Integer x=i, y=i;`，统计 `x==y` 为 false 的 i 区间。再用 `-XX:AutoBoxCacheMax=1000` 重跑，观察边界变化。结论：为什么生产代码比较包装类必须用 `equals`。

## 作业 3：坏 hashCode 复现（必做，本节核心）

实现只重写 `equals` 不重写 `hashCode` 的 `Key`，`map.put(new Key(1),"v")` 后 `map.get(new Key(1))` 返回 null；补上"与 equals 用同一字段"的 `hashCode` 修复。写一句话说明"存进去取不出来 + 内存泄漏"的机理。

## 作业 4：compareTo 与 equals 不一致（选做）

把 `new BigDecimal("1.0")` 与 `new BigDecimal("1.00")` 先后放入 `HashSet` 和 `TreeSet`，分别打印 size。解释为何 HashSet 得 2、TreeSet 得 1，并给出金额去重的正确做法（统一标度 `setScale` 或用整数分/`long`）。

## 作业 5：用 record 消除契约事故（选做）

把一个手写 equals/hashCode 的 `Point` 类改写成 `record Point(int x,int y)`，再对比 Lombok `@Data` 生成的版本；说明 record 如何"从根上保证 equals/hashCode 只用同一组（全部）字段"，以及何时仍需自定义。
