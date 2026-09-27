# 小测验 · 栈、队列与双端队列

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分，≥ 60 分过关。

### 1. JDK 中实现"栈"语义的推荐做法是？（15分）

- A. `new java.util.Stack<>()`
- B. `new ArrayDeque<>()` 并用 push/pop/peek
- C. `new PriorityQueue<>()`
- D. `new Vector<>()`

> 答案：B
> 解析：`Stack` 继承 `Vector`、全方法带同步且暴露随机访问破坏栈语义；官方推荐用 `ArrayDeque` 当栈，更快更省内存。

### 2. 线程池的任务队列为什么强烈建议"有界"？（15分）

- A. 有界队列查找更快
- B. 无界队列会让 maximumPoolSize 与拒绝策略形同虚设，突发流量下无限堆积致 OOM 且排队延迟不可控
- C. 有界队列线程安全，无界不安全
- D. 为了节省一个指针

> 答案：B
> 解析：无界时任务全进队列、线程数停在 core，等于关闭了扩容与拒绝保护；有界 + 拒绝策略才是快速失败/回压的稳定性手段。

### 3. 【多选】关于 Deque / Queue / PriorityQueue，正确的有哪些？（20分）

- A. `ArrayDeque` 底层是循环数组，靠 head/tail 取模实现两头 O(1)
- B. `ArrayDeque` 不能存 null，因为 null 表示"空/无元素"会与 peek 返回歧义
- C. `PriorityQueue` 出队保证整体有序
- D. BFS 用队列、DFS/回溯用栈，二者是天然的算法骨架

> 答案：ABD
> 解析：C 错——`PriorityQueue` 只保证堆顶最值先出，其余不排序（部分有序）。A/B/D 均为事实。

### 4. 判断：`LinkedBlockingQueue` 默认容量是 `Integer.MAX_VALUE`，所以它天然是有界安全队列。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：`MAX_VALUE` 近似无界，仍会导致任务堆积 OOM；用它必须**显式传入合理容量**才算有界。

### 5. 填空题：生产者-消费者中，`ArrayBlockingQueue` 用一把锁配合 ______ 两个条件队列把"队空等待"与"队满等待"分开唤醒；`LinkedBlockingQueue` 则用 ______ 把入队与出队的临界区分离以提高吞吐。（10分）

> 答案：notEmpty 与 notFull / Condition / 两把锁 / putLock 与 takeLock

### 6. 电力采集网关每秒海量设备上报涌入，消费者批量落库速度会波动。请用本节结构设计一段缓冲，说明队列类型、容量策略、队满时的处理及理由。（30分）

> 参考答案：
> - 用有界 `BlockingQueue`（如 ArrayBlockingQueue 或显式设容量的 LinkedBlockingQueue）做生产-消费缓冲，天然削峰
> - 容量 = 到达速率 × 可容忍排队时间，由压测校准；不可无界，避免 OOM
> - 队满时 offer 失败走拒绝/丢弃最旧/转存 MQ 兜底，保护下游不被压垮
> - 消费者 `drainTo` 批量聚合若干条再落库，减少 DB 往返
> - 关键：队列容量与拒绝策略是容量规划产物，不能拍脑袋
