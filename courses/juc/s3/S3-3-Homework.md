# 作业题 · 并发设计模式与生产者消费者模型

> 作业不判分，做完对照参考答案自查。全部要求手写并能在 JDK 17+ 编译运行。

## 作业 1：CompletableFuture 聚合三源（必做）

mock 三个方法 `queryStock`（sleep 100ms）、`queryPrice`（sleep 120ms）、`riskCheck`（sleep 80ms），各返回简单值。用 `CompletableFuture` **并行**发起并聚合为一个结果字符串：

1. 用 `thenCombine` 会合前两个，再 `thenCompose` 串上第三个。
2. 加 `exceptionally` 让 `riskCheck` 抛异常时降级为 `"risk=UNKNOWN"`。
3. 加 `orTimeout(150ms)` 观察 `queryPrice` 超时后走了异常分支。

要求：主线程不得出现阻塞式 `get()`；打印总耗时 ≈ max(三者) 而非 sum。

**参考答案要点**：编排全靠回调触发下游；异常/超时都要有出口，否则 `join` 处抛 `CompletionException` 或永久等待。

## 作业 2：thenApply 嵌套坑（必做）

写 `CompletableFuture.supplyAsync(() -> 1).thenApply(x -> CompletableFuture.completedFuture(x+1))`，观察其类型是 `CF<CF<Integer>>`，取结果拿到的不是 2 而是一个 CF。再改用 `thenCompose` 修复，打印得到 2。用注释说明 flatMap 语义。

## 作业 3：有界队列背压实验（必做）

`ArrayBlockingQueue<Integer>(10)`，一个生产者高速 `put`、一个消费者每 200ms `take` 一个。

1. 观察生产者 `put` 频繁阻塞（背压生效），内存稳定。
2. 改成 `new LinkedBlockingQueue<>()`（无界），把消费者去掉，跑一会儿观察队列 size 无限增长直至 `OutOfMemoryError`（用小堆 `-Xmx32m` 复现，务必隔离环境）。

**参考答案要点**：有界=背压=自我保护；无界=把上游压力全转成内存债，迟早爆。

## 作业 4：CSP 风格 vs 共享内存（选做）

分别实现"生产者发 100 个整数、消费者求和"：

1. 用共享 `ArrayList` + `synchronized` + 手写 `wait/notify`；
2. 用 `BlockingQueue`。

对比代码行数、易错点（虚假唤醒要用 `while`），说明 CSP 风格（把数据经队列转移所有权）为何更安全清晰。

## 作业 5：Actor 心智小练（选做）

用"单线程 `Executor` + 一个并发 mailbox 队列"模拟一个 Actor：所有对内部 `count` 的修改都通过往队列投递"递增消息"、由那唯一线程串行消费完成。验证无需 `synchronized` 也线程安全，注释解释"状态归 Actor、访问靠消息"。
