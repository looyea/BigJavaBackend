# 线程池七参数与执行流程 · 小测

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. 任务提交后，ThreadPoolExecutor 的正确处理顺序是？（15分）

- A. 先扩到最大线程，再排队
- B. 核心线程 → 队列 → 非核心(到 max) → 拒绝
- C. 直接建新线程，不管核心数
- D. 先拒绝再排队

> 答案：B
> 解析：当前线程 < core 建核心；否则入队；队满且 < max 建非核心；再满触发拒绝。max 只在队列满时才用，是最常见误区。

### 2. 下列哪种拒绝策略会让"提交任务的线程自己把任务执行掉"，从而天然回压？（15分）

- A. AbortPolicy
- B. DiscardPolicy
- C. CallerRunsPolicy
- D. DiscardOldestPolicy

> 答案：C
> 解析：CallerRunsPolicy 由调用线程同步跑该任务，减缓提交速度、不丢任务（Web 场景可能拖慢请求线程）。默认是 AbortPolicy 抛异常。

### 3. 【多选】关于线程池配置，正确的有哪些？（20分）

- A. `core=2, max=10, 队列=很大` 时，线程很难扩到 10，因为任务几乎都进队列
- B. `Executors.newFixedThreadPool` 用无界队列，任务堆积可能 OOM，生产不推荐
- C. CPU 密集型线程数经验上可取"核数 + 1"作为起点
- D. 用默认 ThreadFactory 更利于线上按线程名排查问题

> 答案：ABC
> 解析：D 错——默认线程名都是 pool-N-thread-M，难分辨业务；应自定义 ThreadFactory 起有意义名字。A/B/C 正确。

### 4. 判断：ThreadPoolExecutor 支持运行期通过 setCorePoolSize/setMaximumPoolSize 动态调参。（10分）

- A. 正确
- B. 错误

> 答案：A
> 解析：这些参数可运行期修改（volatile 语义），配合配置中心可做线上热调池（如大促临时扩容）。

### 5. 填空题：`newCachedThreadPool` 的危险在于 maximumPoolSize 为 ______ 会无限建线程；它使用 ______ 队列（不存储、直接交接）。（10分）

> 答案：Integer.MAX_VALUE / SynchronousQueue

### 6. 列出 ThreadPoolExecutor 七个参数，并解释"设了较大的 max 却几乎用不上"的原因与两种改进思路。（30分）

> 参考答案：
> - 七参数：corePoolSize、maximumPoolSize、keepAliveTime、unit、workQueue、threadFactory、handler
> - 原因：流程是"核心→队列→最大"，只有队列满了才会扩非核心到 max；队列过大→任务一直排队→永不到扩容步
> - 改进①：把工作队列设为有界且较小（或 SynchronousQueue）让 max 能被触发
> - 改进②：按业务调 core/max 比例，压测定容量；IO 密集多给线程、CPU 密集≈核数+1
> - 补充：务必用有界队列防 OOM、自定义线程名、自定义拒绝兜底关键任务
