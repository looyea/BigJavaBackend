# 小测验 · ThreadLocal 与内存泄漏

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. `ThreadLocal` 解决并发问题的根本思路是哪一项？（15分）

- A. 多线程共享一份数据，加锁串行访问
- B. 每个线程各持一份私有副本，避免共享
- C. 用 CAS 保证对单一变量的原子更新
- D. 把任务提交到单线程池排队执行

> 答案：B
> 解析：`synchronized` 才是"共享一份 + 加锁串行"；`ThreadLocal` 是"每线程一份、无锁各行其是"，本质是**避免共享**而非"给共享加锁"。

### 2. 关于 `ThreadLocal` 数据的存储位置，正确的说法是？（15分）

- A. 存在 `ThreadLocal` 对象自身的字段里
- B. 存在全局静态 Map 里，按线程 id 索引
- C. 存在每个 `Thread` 对象的 `threadLocalMap` 字段里
- D. 存在 `ThreadLocal` 内部的 `ConcurrentHashMap` 里

> 答案：C
> 解析：数据不在 `ThreadLocal` 对象里，而在每个线程自己的 `Thread.threadLocalMap` 中，key 是 `ThreadLocal` 的弱引用、value 是你放入的值的强引用。

### 3. 【多选】以下关于 `ThreadLocalMap` 的 Entry 与内存泄漏的说法，正确的有哪些？（20分）

- A. Entry 的 key 是对 `ThreadLocal` 的弱引用
- B. Entry 的 value 是对所存对象的强引用
- C. 只要 key 是弱引用，value 就永远不会泄漏
- D. 线程池里长命线程用完不 `remove()`，会导致僵尸 value 堆积并串数据

> 答案：ABD
> 解析：弱引用只保证"外部无强引用时 key 能被回收成 null"，从而给惰性清理提供线索；但 value 仍是强引用，key 变 null 后 value 依然回收不掉。C 说反了——value 泄漏必须靠显式 `remove()` 才能避免。

### 4. 判断：在父子线程场景中，只要用了 `InheritableThreadLocal`，线程池里复用的工作线程就一定能拿到父线程最新的上下文。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：`InheritableThreadLocal` 只在**创建子线程的那一刻**复制父线程值；线程池的核心线程早已创建、被复用，不会重新继承，因此拿不到后续更新的上下文——这正是需要阿里 `TransmittableThreadLocal`（或提交任务时装饰）的原因。

### 5. 填空题：`ThreadLocal` 唯一可靠的防泄漏手段是每次用完在 ______ 块中调用 ______ 方法。（10分）

> 答案：finally / remove

### 6. 简述为什么 `ThreadLocalMap` 的 key 要设计成弱引用，以及为什么"弱引用仍不能防止 value 泄漏"。（30分）

> 参考答案：
> - 若 key 为强引用：只要线程存活，Thread→map→Entry→key+value 整条链都在，外部即使不再引用该 ThreadLocal 也永不回收，泄漏更严重
> - 用弱引用：外部无强引用时 GC 可把 key 回收为 null，惰性清理据此识别 null-key 脏项
> - 但 value 仍是强引用，key 变 null 后 Entry(null,value) 的 value 依旧被线程拽着回收不掉
> - 惰性清理只在 set/get 时顺带做、不保证及时，长命且不碰 map 的线程会一直持有僵尸 value
> - 结论：弱引用是为了让 key 可回收、给清理留线索，并非防 value 泄漏；防泄漏最终必须显式 remove()
