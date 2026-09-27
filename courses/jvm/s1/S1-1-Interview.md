# 实际面试题 · 运行时数据区与方法区演进

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。答题要展示"你知道机制的边界"，而不是背名词。

## 题 1：JVM 运行时内存分为哪几块？哪些线程私有、哪些共享？

**期望时长**：90 秒

**答题要点**：

- 线程私有：程序计数器、虚拟机栈、本地方法栈。
- 线程共享：堆、方法区（HotSpot 里 JDK 8 后 = 元空间）。
- 额外：直接内存（堆外，规范上不属于运行时数据区但实战必考）。

**追问链**：

1. 哪块不会 OOM？→ 程序计数器；栈可能 `StackOverflowError`，也可能 `unable to create new native thread`。
2. 静态变量存哪？→ JDK 7 起随类信息进**堆**（对象镜像的一部分），不再在永久代。

## 题 2：StackOverflowError 和 OutOfMemoryError 有什么区别？

**答题要点**：

- `StackOverflowError`：单线程栈帧深度超过 `-Xss`（典型无终止递归）。
- `OutOfMemoryError`：某块内存耗尽——堆 `Java heap space`、元空间 `Metaspace`、栈总量 `unable to create new native thread`、堆外 `Direct buffer memory`。

**追问链**：递归爆栈能靠加 `-Xmx` 解决吗？→ 不能，那是堆参数；栈看 `-Xss`，但加大 `-Xss` 会减少可并发存活线程数，治本是改迭代/降深度。

## 题 3：说说永久代到元空间的演进，为什么 JDK 8 要取消永久代？

**答题要点**：

- 永久代在堆内、大小固定、难调，反射/CGLIB 类一多就 `PermGen OOM`，Full GC 回收它效率低。
- 元空间用本地内存，类元数据可弹性增长，只受物理内存限制，`MaxMetaspaceSize` 兜底。
- 历史：与 JRockit 合并、统一运行时。

**追问链**：元空间会不会 OOM？→ 会，`OutOfMemoryError: Metaspace`，典型是类加载器泄漏（不同 ClassLoader 加载同名类各占一份元数据、旧 Loader 被强引用无法卸载）。热部署、Groovy/动态代理场景高发。

## 题 4：直接内存是什么？为什么说它是"隐蔽的 OOM 源"？

**答题要点**：

- NIO `allocateDirect` 在堆外 native 分配，减少一次堆↔内核拷贝，配合零拷贝提吞吐（netty 大量用）。
- 不受 `-Xmx` 约束，只看 `-XX:MaxDirectMemorySize`；堆 dump 看不到它，容易漏算。
- 释放靠 `Cleaner` 在 Buffer 被 GC 时触发，若堆压力大 GC 少，堆外可能迟迟不回收。

**追问链**：容器里怎么算内存？→ 堆 + 元空间 + 各线程栈(-Xss×数) + CodeCache + 直接内存一起才等于进程 RSS，只按 `-Xmx` 设 limit 会被 OOMKilled（呼应 Docker JVM 感知、`MaxRAMPercentage`）。

## 题 5：CodeCache 满了会怎样？

**答题要点**：

- CodeCache 存 JIT 编译的本地代码，独立于堆/元空间的原生内存区。
- 满了后 JVM 停止编译、新代码退回解释执行，性能断崖；可调 `ReservedCodeCacheSize`、开 `-XX:+UseCodeCacheFlushing`。
- 大量动态生成/加载方法的框架（反射、字节码增强）易把它撑满。
