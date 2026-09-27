# 实际面试题 · ThreadLocal 与内存泄漏

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。答题要展示"你知道机制的边界"，而不是背名词。

## 题 1：ThreadLocal 为什么会内存泄漏？怎么避免？

**期望时长**：2 分钟

**答题要点**：

- 数据存在 `Thread.threadLocalMap`，Entry 的 key 是 ThreadLocal 的**弱引用**、value 是**强引用**。
- 外部无强引用时 key 被回收成 null，但 value 仍被线程拽着回收不掉；线程池核心线程不死 → 僵尸 value 堆积。
- 惰性清理（expungeStaleEntry）只在 set/get 时顺带做，不保证及时。
- 唯一可靠手段：**用完在 finally 里 `remove()`**。

**追问链**：

1. 那 key 用弱引用岂不是没用？→ 有用：弱引用让 key 可回收为 null，给惰性清理提供"识别脏项的线索"；它不是为防 value 泄漏，value 泄漏仍需 remove。
2. 为什么 value 不也做成弱/软引用？→ 那样在用 ThreadLocal 强引用时值可能被 GC 掉，`get()` 返回 null，破坏语义正确性。

## 题 2：线程池里用 ThreadLocal 传用户上下文，会发生什么事故？

**答题要点**：

- 线程复用：上个任务 set 不 remove，下个任务 get 到**残留值**（串数据 / 越权读到别人的用户态）。
- 修复：任务结束 finally remove；或用框架的上下文清理切面统一兜底。

**追问链**：`InheritableThreadLocal` 能解决线程池透传吗？→ 不能，它只在**创建子线程时**复制，池化线程早已创建、复用，拿不到提交任务时的最新值——需 `TransmittableThreadLocal` 或装饰 Runnable/Callable。

## 题 3：既然 SimpleDateFormat 非线程安全，用 ThreadLocal 包它是最佳实践吗？

**答题要点**：

- 能解（每线程一份），但是历史包袱：要记得 remove、有泄漏面。
- 更优：直接用不可变线程安全的 `java.time.format.DateTimeFormatter`，从根上避免共享可变状态，无需 ThreadLocal。

**追问链**：虚拟线程时代 ThreadLocal 有什么新问题？→ 百万虚拟线程各挂大副本 → 内存膨胀；解药是 **Scoped Values**（结构化、只读共享、无泄漏面）。

## 题 4：说说 ThreadLocalMap 为什么用开放地址法而不是哈希链表？

**答题要点**：

- key 用 ThreadLocal 的 identity hash 定位；冲突时线性探测下一个空槽，不用链表。
- 考量：条目通常不多、避免额外 Entry.next 指针开销；配合"清理脏槽+环形探测"。删除用"拖拽式"把连续探测段重新安置以维持查找链完整。

**追问链**：为什么删 key==null 的项要重新排布而不是直接置空？→ 开放地址法靠探测段连续，直接置空会截断后续同段元素的查找路径。
