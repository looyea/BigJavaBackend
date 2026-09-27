# 作业题 · 运行时数据区与方法区演进

> 作业不判分，做完对照参考答案自查。全部在 JDK 17 上验证。

## 作业 1：亲手区分两类栈相关错误（必做）

1. 写一个无终止递归方法，运行观察 `StackOverflowError`；分别在 `-Xss128k` 与 `-Xss1m` 下打印递归到达的深度，验证栈大小与可递归深度的关系。
2. 写一个不断 `new Thread(...).start()` 的循环（不启动太多也可用极小 `-Xss` 触发），观察 `OutOfMemoryError: unable to create new native thread`，注释说明它与"递归栈溢出"的区别（一个是单线程帧太多，一个是线程总量太大）。

**参考答案要点**：`StackOverflowError` 调 `-Xss`/减深度；`unable to create new native thread` 减并发线程数或改用虚拟线程，二者成因不同。

## 作业 2：元空间增长观测（必做）

用 `-XX:MaxMetaspaceSize=32m` 启动一个不断用 `new ClassLoader(){}` 加载同一个类的循环。

1. 每轮打印 `Management.getMemoryPoolMXBean("Metaspace Compatibility").getUsage().getUsed()`（或用 `jstat -gcmetacapacity <pid>`）观察元空间占用只增不减，最终 `OutOfMemoryError: Metaspace`。
2. 注释解释为什么"不同 ClassLoader 加载的同名类"会被当作不同的类、各占一份元数据。

## 作业 3：直接内存不受 -Xmx 约束（必做）

写一个循环只 `ByteBuffer.allocateDirect(1<<20)` 并保留引用、不释放。堆设 `-Xmx32m`（很小）。

1. 验证在堆 OOM 之前，先抛 `OutOfMemoryError: Direct buffer memory`。
2. 加 `-XX:MaxDirectMemorySize=64m` 观察更早封顶，说明堆外内存要单独纳入容量规划（尤其容器里，堆 + 堆外 + 栈 + 元空间要一起算进 cgroup limit）。

## 作业 4：查默认值（选做）

运行 `java -XX:+PrintFlagsFinal -version`，找出 `StackSize`(-Xss)、`MaxHeapSize`、`MetaspaceSize`、`MaxDirectMemorySize` 在你机器上的默认值，列表记录并解释"为什么生产建议 `-Xms=-Xmx`"。
