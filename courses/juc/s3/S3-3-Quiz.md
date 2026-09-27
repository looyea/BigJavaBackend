# 小测验 · 并发设计模式与生产者消费者模型

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. 链式异步中，"基于上一步结果再发起下一个异步任务"应使用哪个方法以避免 `CF<CF<T>>` 嵌套？（15分）

- A. `thenApply`
- B. `thenCompose`
- C. `thenCombine`
- D. `handle`

> 答案：B
> 解析：`thenApply` 是结果变换（映射成普通值），若它的函数返回 CF 就得到嵌套的 `CompletableFuture<CompletableFuture<T>>`；`thenCompose` 相当于 flatMap，把内层展平。`thenCombine` 是"两个独立异步都完成后合并"，不用于单依赖串联。

### 2. 生产者-消费者模型里，队列"必须设上界"的核心意义是？（15分）

- A. 节省对象内存
- B. 形成天然背压：满了让生产者 `put` 阻塞，把"消费慢"顶回上游，避免无限堆积 OOM
- C. 让消费更快
- D. 防止虚假唤醒

> 答案：B
> 解析：有界队列是阻塞式背压的关键。无界队列（如默认 `LinkedBlockingQueue`）在生产远快于消费时会无限膨胀直到 OOM。上界不直接改变消费速度，也不是为省内存。

### 3. 【多选】关于 `CompletableFuture` 编排，下列对应关系正确的有哪些？（20分）

- A. 两个独立异步都完成后合并结果 → `thenCombine` / `allOf`
- B. 任一先完成即继续 → `anyOf` / `applyToEither`
- C. 任一环节抛异常时的降级出口 → `exceptionally` / `handle`
- D. 拿到结果做同步类型转换 → `thenApply`

> 答案：ABCD
> 解析：四项都是 CF 的标准用法。补充：设置超时用 `completeOnTimeout`/`orTimeout`；`supplyAsync` 不指定线程池会落到 `commonPool`，IO 密集场景应给专用池。

### 4. 判断：Actor 模型里，其他线程可以直接读写某个 Actor 内部的状态，只要加锁即可。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：Actor 的私有状态只能由该 Actor 自己在串行处理消息时访问，外界只能通过发消息（tell/ask）与之交互，不能直接改其状态——这正是"用消息替代共享内存"的精髓。

### 5. 填空题：背压（backpressure）是当下游处理不过来时，把"慢"的信号 ______ 传导给上游，让上游 ______/丢弃/降级，而不是无节制往下游灌。（10分）

> 答案：反向 / 反向传导 / 减速

### 6. 简述背压的三种实现流派，并说明为什么它是流式/消息系统的"命门"。（30分）

> 参考答案：
> - 阻塞式：有界 BlockingQueue，put 满即阻塞生产者，把快端顶住
> - 请求式：Reactive-Streams/Flow 的 request(n)，下游按处理能力主动拉取指定额度
> - 丢弃/降级式：offer 失败即采样/丢弃/熔断，优先保护自身不被打爆
> - 命门原因：一旦消费端因 GC 或下游抖动变慢，无背压则缓冲无限增长 → OOM、延迟雪崩，甚至整链崩溃
> - 典型呼应：netty 写缓冲水位 isWritable/WriteBufferWaterMark、Kafka/RocketMQ 消费限流削峰
