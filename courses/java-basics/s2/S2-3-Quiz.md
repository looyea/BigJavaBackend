# 小测验 · Lambda 与 Stream API

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. `stream.filter(x -> x > 0)` 中 `filter` 需要的断言函数式接口是？（15分）

- A. `Function`
- B. `Predicate`
- C. `Consumer`
- D. `Supplier`

> 答案：B
> 解析：`filter` 接收 `Predicate<T>`（`boolean test(T)`）做布尔判断。

### 2. 判断：Lambda 里可以直接修改它捕获的外部局部变量。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：捕获的局部变量必须 effectively final，Lambda 拿的是值副本，编译器禁止修改。

### 3. 【多选】关于并行流 `parallelStream`，下列说法正确的有？（25分）

- A. 默认共用 `ForkJoinPool.commonPool()`，任务里阻塞会拖累全 JVM 其他并行流
- B. 在 `forEach` 里累加外部非线程安全集合会有数据竞争风险
- C. 任何场景并行流都比串行快，应默认开启
- D. IO 密集型任务不适合用默认并行流

> 答案：ABD
> 解析：C 错——并行有拆分/合并开销，数据量小、难拆分数据源、含装箱/有序操作时反而更慢。

### 4. 要把"每个订单里的多个商品项"合并成"一个所有商品项的流"，应使用？（15分）

- A. `map`
- B. `flatMap`
- C. `filter`
- D. `peek`

> 答案：B
> 解析：一对多展开要把"流的流"摊平成一个流，用 `flatMap`；`map` 是一对一。

### 5. 填空题：`Collectors.toMap(k, v)` 遇到重复 key 默认抛 ______，需传入第三个参数 ______ 来定义合并策略；无终端操作的中间流不会真正执行，这叫 ______ 求值。（10分）

> 答案：IllegalStateException / merge 函数 / 惰性
> 解析：toMap 重复键默认快速失败；给 mergeFunction 决定留旧/留新；Stream 惰性 + 终端触发。

### 6. 简答题：说明 Stream 的"中间操作 / 终端操作 / 惰性求值 / 一次性"四个特性，并给出"什么时候该用、什么时候不该用并行流"的判断。（25分）

> 参考答案：
> - 中间操作返回新 Stream、惰性（不触发计算）：filter/map/sorted/limit 等；终端操作触发整条管道并产出结果：collect/forEach/reduce/count/match 等
> - 惰性求值 + 短路：无终端则一个元素都不算；limit/findFirst/anyMatch 可提前停止，能处理无限流
> - 一次性：Stream 消费后不能再遍历，需重新从源获取
> - 该用并行：CPU 密集、数据量大、源易拆分（ArrayList/数组/范围）、无阻塞无副作用
> - 不该用并行：含 IO/锁/阻塞、需在 forEach 改共享状态、数据源难拆（BufferedReader.lines/迭代器生成）、数据量小或含有序/装箱操作
