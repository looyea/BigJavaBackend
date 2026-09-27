# 作业题 · ThreadLocal 与内存泄漏

> 作业不判分，做完对照参考答案自查。全部要求手写并能在 JDK 17+ 编译运行。

## 作业 1：亲手复现"线程池串数据"（必做）

用 `Executors.newFixedThreadPool(1)`（单线程，保证两个任务复用同一线程），定义一个 `ThreadLocal<String> CTX`：

1. 任务 A：`CTX.set("user-A")`，睡眠 100ms，**故意不 remove**。
2. 任务 B：直接 `CTX.get()` 并打印。

要求：观察 B 打印出 `user-A`（残留值），在注释里写清原因；然后在任务 A 的 `finally` 里加 `CTX.remove()`，验证 B 得到 `null`。

**参考答案要点**：核心线程不死，`Thread.threadLocalMap` 里的 value 跨任务存活，未 remove 即被下个复用该线程的任务读到——这就是"串数据"。

## 作业 2：traceId 上下文过滤器（必做）

模拟 Web 请求链路：写一个 `TraceContext`，内部用 `ThreadLocal<String>` 存 traceId，提供 `set/get/clear`。再写一段"提交任务到线程池"的代码，分别在子线程中打印 traceId：

1. 用普通 `ThreadLocal` → 子线程打印 `null`。
2. 改用 `InheritableThreadLocal` → 子线程仍可能拿到"创建池时"的旧值，而非提交任务时的值。
3. 用装饰 `Runnable`（提交前捕获父线程 traceId、任务内 set、结束 clear）或 `TransmittableThreadLocal` 修复。

要求：注释解释为什么 `InheritableThreadLocal` 在线程池下不靠谱。

## 作业 3：非线程安全对象的隔离 vs 换代（选做）

1. 用 `ThreadLocal<SimpleDateFormat>` 封装一个 `formatDate`，两个线程并发调用，验证不抛异常。
2. 然后把 `SimpleDateFormat` 换成 `DateTimeFormatter`（不可变、线程安全），去掉 `ThreadLocal`，验证同样安全且更简单。

**参考答案要点**：`ThreadLocal` 是历史包袱下的隔离手段；新代码优先用不可变线程安全对象（`java.time`），从根上避免共享可变状态与"忘 remove"风险。

## 作业 4：泄漏观察实验（选做）

在一个常驻线程里循环 `ThreadLocal<byte[]>` 的 `set(new byte[1<<20])` 但从不 `remove`，把外部 ThreadLocal 强引用置空，触发 GC 后用 `jmap -histo` 或 MAT 观察 `[B`（byte 数组）实例堆积，对照课程"key 弱引用被回收、value 强引用留存"的结论。
