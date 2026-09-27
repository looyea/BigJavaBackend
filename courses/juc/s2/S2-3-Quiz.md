# 并发容器与同步器 · 小测

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. JDK 8 ConcurrentHashMap 的 put 在"桶非空"时如何保证线程安全？（15分）

- A. 全局一把大锁
- B. 对每个桶分段锁（Segment）
- C. `synchronized` 锁住该桶的头节点，桶为空则用 CAS 放
- D. 完全靠 volatile

> 答案：C
> 解析：JDK 8 弃用分段锁，锁粒度细化到单个桶：空桶 CAS、非空桶 `synchronized(头节点)`，不同桶互不阻塞。B 是 JDK 7 的做法。

### 2. "限制同一时刻最多 K 个线程访问某资源"应选哪个同步器？（15分）

- A. CountDownLatch
- B. CyclicBarrier
- C. Semaphore
- D. ConcurrentHashMap

> 答案：C
> 解析：Semaphore 维护 K 个许可，acquire 减、release 加，耗尽则挂起——正是限并发/资源池语义。

### 3. 【多选】关于同步器与并发容器，正确的有哪些？（20分）

- A. CountDownLatch 一次性、不可复用；要循环对齐用 CyclicBarrier
- B. ConcurrentHashMap 允许 null 键和 null 值，和 HashMap 一样
- C. CopyOnWriteArrayList 读无锁、写时复制整数组，适合读多写少
- D. BlockingQueue 的 put 满时挂起、take 空时挂起，天然提供生产者-消费者背压

> 答案：ACD
> 解析：B 错——CHM **禁止** null 键/值（无法区分"无值"与"值为 null"）。A/C/D 正确。

### 4. 判断：并发初始化时 `if(!map.containsKey(k)) map.put(k,v)` 是原子安全的。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：containsKey 与 put 之间有竞态，可能重复初始化；应用 putIfAbsent/computeIfAbsent/merge 这类原子复合操作。

### 5. 填空题：CHM 的 size/计数用 ______ + CounterCell[] 分散累加（与 LongAdder 同思路）；CyclicBarrier 全部线程到齐后可执行一个可选的 ______。（10分）

> 答案：baseCount / 屏障动作（barrierAction）

### 6. 用一句话分别说清 CountDownLatch、CyclicBarrier、Semaphore 的语义差异，并各给一个生产场景。（30分）

> 参考答案：
> - CountDownLatch：等" N 个事件"完成，计数减到 0 放行等待者，一次性；场景 主线程等多个并行子查询全部返回再汇总
> - CyclicBarrier：N 个线程互相等到齐再一起继续，可带屏障动作、可循环；场景 多线程分阶段计算每阶段对齐 / 压测并发起跑
> - Semaphore：控制同时进入的许可数，acquire/release；场景 限流最多 K 并发打下游、护连接池
> - 关键区别：Latch 等事件(自己不计入)、Barrier 等彼此(参与者算一个)、Semaphore 限并发数
> - 选型口诀：等事件→Latch，等彼此→Barrier，限数量→Semaphore
