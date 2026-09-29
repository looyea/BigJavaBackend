# Lambda 与 Stream API

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：认全核心函数式接口（`Function/Consumer/Supplier/Predicate` 及原始类型特化），讲清 Lambda 捕获变量的 effectively-final 约束与 `this` 语义；掌握 Stream 的**惰性求值 / 中间-终端操作 / 只能消费一次**模型；尤其能说清**并行流的陷阱**（共享 ForkJoinPool、副作用、并非到处都快）。这是写现代 Java、读懂 Reactor/WebFlux 的基础。

## 一、函数式接口：Lambda 的类型（★★★☆☆）

Lambda 是**函数式接口**（`@FunctionalInterface`，仅一个抽象方法）的实例。记住这张表，读写都靠它：

| 接口 | 方法 | 用途 |
| --- | --- | --- |
| `Function<T,R>` | `R apply(T)` | 转换 T→R |
| `Consumer<T>` | `void accept(T)` | 消费（无返回，如 forEach） |
| `Supplier<T>` | `T get()` | 供给（惰性生成、工厂） |
| `Predicate<T>` | `boolean test(T)` | 判断（filter） |
| `UnaryOperator<T>` | `T apply(T)` | 同类型一进一出（map 自映射） |
| `BinaryOperator<T>` | `T apply(T,T)` | 同类型两进一出（reduce） |
| `Comparator<T>` | `int compare(T,T)` | 排序（注意它有两个静态工厂但仅一抽象方法） |

**原始类型特化**（避免装箱，呼应 s1-4）：`IntFunction`、`ToIntFunction<T>`、`IntPredicate`、`IntStream` 等。处理数字先用 `mapToInt/mapToLong`，别在 `Stream<Integer>` 上算。

## 二、Lambda 的两个语义要点（★★★★☆）

1. **捕获局部变量必须 effectively final**（实际不再改变），因为 Lambda 捕获的是**值的副本**，改原变量会造成两边不一致，编译器直接禁止。
2. **`this` 指向不同**：Lambda 里的 `this` 是**定义它的外围实例**（Lambda 不引入新作用域）；匿名内部类的 `this` 是**它自己**。这是"用 Lambda 替换匿名类"时唯一的行为差异。

底层用 `invokedynamic` + `LambdaMetafactory` 生成，**不是每调用一次 new 一个类**，无捕获的 Lambda 还会缓存单例，性能优于匿名内部类。

## 三、Stream 的惰性模型：中间 vs 终端（★★★★★）

```flow
数据源 → [中间操作(惰性，返回新 Stream)]... → [终端操作]
             filter/map/flatMap/sorted/distinct/limit/skip/peek   collect/forEach/reduce/count/match/find
关键：没有终端操作，整条管道一个元素都不处理（惰性 + 短路）；Stream 是一次性的，终端后不可再用。
```

- **短路**：`limit`、`anyMatch`、`findFirst` 遇到满足条件即停，能处理**无限流**（`Stream.iterate`/`generate`）。
- **`map` vs `flatMap`**：`map` 一对一，`flatMap` 把每个元素摊平成流再拼接（"流的流"→"流"），常用于一对多展开 + 去空。
- **`peek` 只用于调试**，别拿它做副作用业务（可能被优化、并行下行为不定）。
- **`collect` 才是聚合主力**：`toList`、`toMap`（**key 冲突会抛，必须给 merge 函数**）、`groupingBy`（可多级、下游再 `counting/summingInt`）、`joining`、`partitioningBy`。
- **`reduce` 要遵守不可变累加 + 关联律**（尤其并行），身份值 `identity`、累加 `BinaryOperator`、合并 `combine` 三者语义要一致，否则串并行结果不同。

## 四、并行流 parallelStream 的坑（★★★★★）

一句 `.parallel()` 看着免费提速，实则雷区：

1. **共用 `ForkJoinPool.commonPool()`**：全 JVM 默认共享，池大小 ≈ `CPU核数-1`。只要有任务**阻塞**（IO、锁、`Thread.sleep`），就把公共池占满，**拖垮进程里所有其他并行流/CompletableFuture**。IO 型任务绝不该用默认并行流。
2. **副作用即数据竞争**：`forEach` 里改外部 `ArrayList`/计数器、非线程安全累加 → 结果错乱甚至崩溃。并行流要求**无副作用**、用 `collect/reduce` 归约。
3. **不是处处都快**：
   - 数据源要易拆分才受益：`ArrayList`/数组/`IntStream.range` 好；`BufferedReader.lines`/`iterator()`生成的难拆，并行几乎无益甚至更慢。
   - 任务要**细粒度 CPU 密集**才有收益；数据量小、操作很轻时，拆分与合并的开销反而拖累。
   - 有状态/有序中间操作（`sorted`、`limit` 保序）、装箱（用 `IntStream` 代替）都削弱收益。
4. **调试困难**：栈帧被 ForkJoin 打散。

> 经验：**默认用串行流，测量确认是 CPU 密集瓶颈再并行；确需并行且有阻塞风险时，把任务提交到自建 `ForkJoinPool` 隔离**，别污染 commonPool（呼应 juc 线程池与高并发分区）。

## 五、例子：正确用法与错误用法

```java
// 例子目的：把函数式接口、effectively-final 捕获、toMap 重复键、map vs flatMap 四个知识点各给一个正确与错误用例
import java.util.*;
import java.util.stream.*;
class LambdaStreamDemo {
    record Order(String id, String user, int amount) {}

    public static void main(String[] args) {
        // 知识点 1：四大函数式接口的应用
        List<Integer> nums = List.of(1, 2, 3, 4);
        long even = nums.stream().filter(x -> x % 2 == 0).count();   // Predicate.test 判断
        System.out.println(even);                                     // 正确用例输出：2（偶数 2、4）
        int sum = nums.stream().map(x -> x * 2).reduce(0, Integer::sum); // Function.apply 转换 + 归约
        System.out.println(sum);                                      // 正确用例输出：20（2+4+6+8）

        // 知识点 2：捕获局部变量必须 effectively final（错误用法）
        int base = 10;                                                // base 不再改变 → 可被 lambda 捕获
        IntFunction<Integer> f = x -> x + base;                       // 正确：读取 effectively-final 变量
        System.out.println(f.apply(5));                               // 正确用例输出：15
        // 错误用法：int base2 = 10; base2 = 20; IntFunction<Integer> g = x -> x + base2;  // 编译报错
        //   local variables referenced from a lambda expression must be final or effectively final

        // 知识点 3：toMap 重复键必须给 merge 函数（错误用法→异常）
        List<Order> orders = List.of(new Order("A", "u1", 100), new Order("A", "u1", 50)); // 两条 id 都是 "A"
        try {
            orders.stream().collect(Collectors.toMap(Order::id, o -> o));                    // 错误：无 merge
        } catch (IllegalStateException e) {
            System.out.println("Duplicate key，toMap 默认遇重复键抛 IllegalStateException：" + e.getMessage());
        }
        Map<String, Integer> byId = orders.stream()
            .collect(Collectors.toMap(Order::id, Order::amount, Integer::sum));              // 正确：给 merge (a,b)->和
        System.out.println(byId);                                                            // 正确用例输出：{A=150}（100+50 合并）

        // 知识点 4：map vs flatMap（一对多展开用 flatMap）
        List<List<Integer>> nested = List.of(List.of(1, 2), List.of(3));
        System.out.println(nested.stream().flatMap(List::stream).collect(Collectors.toList())); // 正确输出：[1, 2, 3]
        // 错误用法：nested.stream().map(List::stream)... 得到 Stream<Stream> 没“摊平”，后续无法当一维流处理
    }
}
```

## 六、动手题

1. 用 `groupingBy` + 下游 `summingInt`，把订单按"用户 → 各用户消费总额"聚合；再加一级 `partitioningBy(金额>阈值)`。
2. 写一个 `toMap(Order::getId, o->o)`，放入重复 id 观察 `IllegalStateException`，补 merge 函数修复。
3. 对 1000 万元素的 `IntStream` 求和，分别用**串行 stream、parallelStream、`LongAdder`、普通 for 循环**测耗时；再故意在一个 `parallelStream().forEach` 里 `Thread.sleep(100)`，观察它对同 JVM 其他并行流的拖累。

## 七、关联技术栈

- **向前**：`Comparator` ↔ s1-4；装箱开销 ↔ s1-4；`Consumer/Function` 大量出现在框架回调
- **并发**：commonPool 与 `CompletableFuture` 默认执行器同源 ↔ juc s2 线程池、s3-3
- **响应式**：Reactor/RxJava 的 `map/flatMap/filter/reduce` 语义与此一致，是 WebFlux 的语法基础 ↔ spring-mvc s2-2
- **工程**：`removeIf`、`Optional` 链式（下一节 s3-3）、Spring `@Cacheable` 的 key SpEL 背后也是函数式

## 八、本节小结

Lambda 让"把行为当参数"成为一等公民，Stream 用**惰性管道 + 终端触发**重塑集合处理。真正拉开水平的是两点：**用对中间/终端与 `collect`/`reduce` 的语义**，以及**清醒对待并行流**——它是 CPU 密集场景的加速器，不是免费的午餐，共享池 + 副作用是两大命门。

下一节讲数值精度、日期时间与字符编码——这些是"人人都用、天天出错"的线上事故高发区。
