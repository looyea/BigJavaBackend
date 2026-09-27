# Java 22-25：Loom/Panama 收口

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：看清 21 之后的"特性流水线"把三大长期工程收尾到哪——**Project Panama 的 FFM API（替代 JNI，Java 22 转正）**、**Project Loom 的结构化并发 + Scoped Values 走向定型**、**Project Valhalla 的值类/原始类型模式进入预览前奏**。建立"哪些已能上生产、哪些还在预览/被撤回"的判断力，并理解 Java 演进背后的**项目制（Project-based）与预览机制**——这正是 s3-3"渐进、务实"取向的最新注脚。

## 一、FFM API：和 JNI 说再见（★★★★★，已转正）

**Java 22 最大落地红利**是 **Foreign Function & Memory API（Project Panama，JEP 454）正式转正**。它统一并取代了割裂多年的两套老技术：

- **JNI**：调用本地 C/C++ 函数——样板多、易崩 JVM、无法沙箱。
- **`sun.misc.Unsafe` + DirectByteBuffer**：手工管理堆外内存——危险、非公开 API。

FFM 用一套 **`Linker` + `MemorySegment` + `Arena`（内存作用域）** 的现代 API 同时解决"调外部函数"和"管堆外内存"：

```java
// 例子目的：用 FFM API 调 C 库 strlen，全程无 JNI、内存由 Arena 自动回收
try (Arena arena = Arena.ofConfined()) {                 // Arena 管控本地内存生命周期，出作用域即释放
    MemorySegment str = arena.allocateFrom("hello world");   // 把 Java 字符串写入本地内存（以 \0 结尾）
    long len = (long) LINKER.downcallHandle(
            SYMBOL, FunctionDescriptor.of(JAVA_LONG, ADDRESS))   // 描述签名：返回 long、入参一个地址
        .invokeExact(str);          // 类型化调用，无需手写 JNI 胶水
    System.out.println(len);        // 正确用例输出：11（"hello world" 的长度，strlen 不算末尾 \0）
}
// 正确用法结果：invokeExact 返回 11，Arena 关闭后本地内存自动释放，不依赖 GC 及时回收
// 错误用法：FunctionDescriptor 声明的返回类型与真实 strlen 不符（如写成 JAVA_INT）→ invokeExact 抛 WrongTypeException
// 错误用法：Arena 关闭后继续访问其中的 MemorySegment → 抛 IllegalStateException（段已失效，避免野指针）
```

- **`Arena`（作用域）** 管生命周期，出了 try 自动释放，杜绝堆外泄漏；`ofConfined/ofShared/ofGlobal` 控制线程可见性。
- **比 JNI 更安全**（越界/错误调用抛异常而非直接崩 JVM）、**比 Unsafe 更受控**、性能可与 C 媲美。
- **谁用**：高性能存储/编解码、调 GPU/加解密硬件库、向量计算——**多数业务不直接写，但依赖它的库（Netty、Lucene、序列化框架）在换底层**。呼应 graalvm/spring-native 分区。

## 二、Loom 收尾：结构化并发与 Scoped Values（★★★★☆，走向定型）

上一节 s2-1 的虚拟线程是主角，22-24 继续把配套件**一轮轮预览、逐步收敛**：

- **结构化并发（StructuredTaskScope）**：21→24 多次预览、API 反复调整（`ShutdownOnFailure`/`Joiner` 语义演进），截至本教材编写时**仍未最终转正**——是"长期打磨"的典型。落地务必对齐所用 JDK 版本文档。
- **Scoped Values（Java 23 起多轮预览）**：面向不可变、可继承、有作用域的上下文传递，**替代 ThreadLocal 在虚拟线程场景的膨胀问题**（呼应 s2-1 坑 2）。后续引入"**约束作用域 Memory-Confined Scopes**"实现堆外/上下文的安全共享。
- **`synchronized` 钉住修复（JDK 24, JEP 491）**：JVM 已能在同步方法/块中阻塞时**不再钉住载体线程**，让 s2-1 的头号坑大幅缓解（极端 pinning 仍存，但日常无需再为其改写）。

> 这条线证明：**虚拟线程不是"发布即完美"，而是靠后续多个版本把周边补齐**。架构上该升级就升级，但别把预览 API 写进核心链路。

## 三、Valhalla 前奏：值类与原始类型模式（★★★★☆，预览中）

**Project Valhalla** 追求"像对象一样编程、像基本类型一样高效"，进展到 22-25 进入**可见但未完工**阶段：

- **原始类型模式（Primitive Types in Patterns，22 起多轮预览）**：让 `switch`/instanceof 能对 `int` 等做模式匹配与解构，是值类的语法铺垫。
- **生成式元编程（Generative Metaprogramming / Code Snippets，23 起预览）**：允许在运行时把"代码片段"当作一等值传递、编译期生成代码（`CodeModel`），为未来更轻量的元编程铺路；**同为预览、离生产尚远**，与 s3-2 的 APT/Lombok 是同问题的不同解。
- **值类 / 值对象（Value Classes & Primitives，JDK 24 首次预览 JEP 492）**：无身份（identity-free）的对象——两个等值的值对象可共享同一内存、去掉对象头/引用间接层，`Optional`/`record`/`LocalDate`/`java.time` 等小对象未来内存与速度都受益（呼应 s3-3 Optional、s2-4 java.time）。
- **现状**：仍是预览、需 `--enable-preview`，且受 class-file/CCS（紧凑对象头）协同限制，**尚未面向业务生产**。学习重点是"理解它要解决什么（小对象开销）"，而非追用。

## 四、预览机制与"被撤回的教训"（★★★☆☆）

Java 用 **Preview / Incubator（`--add-modules`/`--enable-preview`）** 在"快速演进"与"不破坏兼容"之间搭缓冲：特性先以预览发布、收集反馈、可能改语义、多轮后才转正。

- **正面案例**：模式匹配、record 都经过多轮预览打磨。
- **被撤回案例**：**String Templates（`STR."{x}"`）在 22/23 两度预览后被官方撤回重新设计**——因社区对设计方向争议大。这是 s3-3"克制、宁缺毋滥"取向的鲜活体现：**Java 宁愿收回一个已发布的预览特性，也不愿把一个有争议的 API 固化进 25 年历史包袱。**

> **工程纪律**：预览特性**不进核心生产链路**（每次大版本可能语义变更、且 class 文件绑大版本）；用发行版节奏（21→25 跨 LTS）规划升级，别为追单版本非 LTS 特性打乱长期支持策略（呼应 s1-1"只认 LTS"）。

## 五、动手题

1. 用 FFM API（JDK 22+）写一个调用 C 标准库 `strlen` 或 `getpid` 的最小 demo，体会 `Linker/MemorySegment/Arena` 相比 JNI 的简洁与安全。
2. 在一个虚拟线程服务里，把一个"缓存型大对象 ThreadLocal"改造成 `ScopedValue`，对比内存与继承行为。
3. 开启 `--enable-preview`，试写一段对 `int` 做 switch 模式匹配（原始类型模式预览）的代码，感受 Valhalla 铺路方向；记录它必须锁 JDK 版本这一约束。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 依赖的库在升级 JDK 后 native 崩溃 | 仍在用旧 JNI/Unsafe，未随 FFM 迁移或库未适配 |
| 用了预览 API，小版本升级后编译/运行行为变 | 预览语义未稳定 + class 绑大版本 |
| 堆外内存涨、难定位泄漏 | 自管 `MemorySegment` 未用 `Arena` 作用域约束释放 |
| 结构化并发代码在 21↔24 间反复改 | 该 API 多轮预览、语义演进，勿锁死写法 |

## 七、关联技术栈

- **向前**：虚拟线程/钉住/ThreadLocal ↔ 本节上一节 s2-1；Optional/java.time 未来受益值类 ↔ s3-3/s2-4；LTS 选型 ↔ s1-1
- **横向**：FFM 替代 Unsafe/JNI ↔ 高性能中间件（Netty/Lucene）底层演进、jvm 分区（对象内存布局/CCS）
- **向后**：GraalVM/原生镜像对这些底层 API 的支持 ↔ graalvm 分区（已填）

## 八、本节小结

22-25 的主线是**"收尾与铺路"**：**FFM API 已转正，是本轮唯一该立刻关注的生产力（多数经库间接受益）；结构化并发/Scoped Values/synchronized 解钉正在逐步补齐 Loom 生态；Valhalla 值类仍预览、看懂方向即可别硬上。** 全程贯穿 Java 的预览机制与"宁可撤回也不固化争议 API"的克制哲学。

至此 java-modern 分区完成：从 9 的模块化、17 的结构现代化，到 21 的并发革命、22-25 的收口——一条"渐进务实"的语言演进主线。下一阶段进入 juc，把虚拟线程背后"被绕开但仍是根基"的并发内核补全。
