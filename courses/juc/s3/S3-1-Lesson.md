# ThreadLocal 与内存泄漏

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：看懂 `ThreadLocal` 不是"共享变量的锁"，而是**给每个线程一份私有副本**——每个 `Thread` 内部有一个 `ThreadLocalMap`，**key 是 ThreadLocal 的弱引用、value 是强引用**；由此推出经典的**内存泄漏**成因与"用完必须 `remove()`"的铁律；并掌握**线程池复用下 ThreadLocal 会串数据**这一隐蔽事故，以及在 Web 里传递请求上下文（traceId、用户态、事务/连接绑定）的正确姿势。

## 一、它是什么：空间换时间，每线程一份（★★★★☆）

`synchronized` 是"多线程共享一份、加锁串行访问"；**`ThreadLocal` 是"每线程各持一份副本、无锁各行其是"**——不是解决共享，而是**避免共享**。

```java
// 例子目的：用 ThreadLocal 给每个线程一份 SimpleDateFormat 副本，演示"无锁线程隔离"的定义与应用
static ThreadLocal<SimpleDateFormat> FMT =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));  // 定义：首次 get() 时按线程懒造初始值
String today = FMT.get().format(new Date());   // 应用：拿到属于当前线程的那个实例，互不干扰
// 正确使用结果：线程 A/B 各自 FMT.get() 得到不同的 SDF 实例，并发 format 不抛异常也不串位
// 错误用法：把 SimpleDateFormat 当 static 共享变量直接 new 一个→ 非线程安全，高并发下报出错误日期甚至 ArrayIndexOutOfBoundsException/NumberFormatException
// 错误用法：用 ThreadLocal 却从不 remove() → 线程池复用线程时，下个任务 get() 到上个任务的残留值（串数据）
```

典型用途：**请求级上下文**（traceId、登录用户、语言/时区）、**非线程安全对象的线程隔离**（曾用于 `SimpleDateFormat`，但新代码应直接用线程安全的 `java.time`，见 java-basics s2-4）、**连接/事务绑定**（Spring `TransactionSynchronizationManager` 就用 ThreadLocal 把当前线程和 DB 连接绑一起）。

## 二、结构：Thread → ThreadLocalMap → (弱引用key, value)（★★★★★）

关键在数据存哪：**不在 ThreadLocal 对象里，而在每个 `Thread` 对象的 `threadLocalMap` 字段里**。

```flow
Thread 对象
  └─ ThreadLocalMap table[]   (开放地址法，非链表)
        Entry extends WeakReference<ThreadLocal>   ← key = ThreadLocal（弱引用）
        value = 你放的值                            ← 强引用
```

- **key 用弱引用**：当外部不再有强引用指向某个 ThreadLocal 变量时，GC 能把这个**弱引用 key 回收成 null**——否则只要线程活着（如线程池核心线程永不死），这个 Entry 会永远拽着一个本应销毁的 ThreadLocal。弱引用 key 正是给"回收后清掉残留"留了个突破口。
- **value 用强引用**：key 变 null 后，`Entry(null, value)` 里的 **value 仍被这条线程强引用着，GC 回收不掉** → 若该线程长期存活（线程池），这些"僵尸 value"就**泄漏**了。

## 三、泄漏与"必须 remove"（★★★★★）

```java
// 例子目的：展示 ThreadLocal 唯一可靠的防泄漏写法——try/finally 中强制 remove
TL.set(v);               // 当前线程存入副本，建立 entry→value 强引用
try {
    // 使用 v ...        // 同线程内后续 TL.get() 拿回 v
} finally {
    TL.remove();     // ★ 铁律：用完立即 remove，切断 entry→value 的强引用
}
// 正确使用结果：任务结束时 value 引用被断，即使线程长期存活（池化）也不泄漏、不串数据
// 错误用法：只 set() 不 remove() → 核心线程不死，弱引用 key 回收后剩僵尸 value 堆积→ 老年代缓慢增长 OOM，且下个任务读到残留值
// 错误用法：把 set() 写在 try 外、remove() 写在 try 内 → set 后一抵就抛异常跳过 remove，同样泄漏
```

- `ThreadLocalMap` 只在 `set/get/rename` 时**顺带清理**一部分 key==null 的"脏 entry"（启发式 expunge），**并不保证及时**——线程不结束又不碰 map，脏 value 就一直在。
- 所以**不能指望弱引用 + 惰性清理**，必须**显式 `remove()`**：它把 entry 的 key、value 都断开，是唯一可靠的防泄漏手段。尤其**线程池场景**：核心线程几乎不死，不 remove 会持续累积泄漏，且会**串数据**（下个任务 get 到上个任务的残留值！）。
- **跨线程池/子线程不自动传递**：父线程设的 ThreadLocal，子线程看不到（各自 map）。异步/MDC 场景要用 `InheritableThreadLocal`（仅创建子线程时复制）或阿里 `TransmittableThreadLocal`（线程池复用下也能透传，呼应 java-basics s1-1 不可变线程安全）。

## 四、为什么 key 设计成弱引用（★★★★☆，高频追问）

反向想：若 key 是**强引用**，只要线程活着，"Thread → map → Entry → key(ThreadLocal) + value"整条都在，**即使外部早已没有对该 ThreadLocal 的引用，它也永不回收**，泄漏更严重。用弱引用让"外部无强引用时 key 能被回收为 null"，从而 map 的惰性清理能识别这些 null-key 脏项。**弱引用不是为了防 value 泄漏（value 仍泄漏），而是为了让 key 可回收、给清理提供线索。** value 泄漏最终还得靠 `remove()`。

## 五、动手题

1. 在线程池里跑两个任务：任务 A `tl.set("A")` 不 remove，任务 B 直接 `tl.get()`，观察 B 拿到"A"（串数据）；加上 `remove()` 修复。
2. 写一段循环不断 `new ThreadLocal<大对象>()` + `set` 但从不 remove、在长生命周期线程里跑，结合堆分析观察 value 堆积。
3. 用 `InheritableThreadLocal` 验证子线程能继承、但**线程池复用**的线程不会重新继承，理解为何需要 TransmittableThreadLocal。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 线程池里读到"上一个请求"的用户/traceId | 用完没 `remove()`，线程复用串数据 |
| 老年代缓慢增长、疑似泄漏 | 长命线程 + ThreadLocal 从不 remove，僵尸 value 堆积 |
| 子线程拿不到父线程上下文 | ThreadLocal 不跨线程；需 Inheritable/TTL，且池化线程更麻烦 |
| 以为弱引用能自动清 value | 弱引用只管 key；value 强引用需 remove 才断 |
| `SimpleDateFormat` 用 ThreadLocal 仍偶发错 | 真正该换成不可变线程安全的 `java.time`（见 s2-4） |

## 七、关联技术栈

- **向前**：不可变线程安全对象 ↔ java-basics s1-1/s1-4；`java.time` 替代 SDF ↔ java-basics s2-4
- **横向**：虚拟线程下"百万线程各挂大 ThreadLocal → 内存膨胀" ↔ java-modern s2-1，解药是 Scoped Values ↔ s2-2
- **框架**：Spring 事务/请求上下文绑定用 ThreadLocal ↔ spring-core/spring-mvc；MDC 日志链路 ↔ 测试/可观测
- **底层**：ThreadLocalMap 的引用类型（弱/软/强）↔ jvm 分区 GC 与引用

## 八、本节小结

ThreadLocal 一句话：**"每线程一份私有副本"以空间换并发，数据存在 `Thread.threadLocalMap` 里，key 弱引用、value 强引用。** 由此两条铁律：**① 用完必 `remove()`（防泄漏 + 防线程池串数据）；② 跨线程不自动传递（池化下尤甚，需 Inheritable/TTL/ScopedValue）。** 别把它当"共享变量管理工具"，也别指望弱引用替你清 value。

下一节锁优化与无锁并发——分段/读写锁、伪共享与 `@Contended`、无锁队列思想。
