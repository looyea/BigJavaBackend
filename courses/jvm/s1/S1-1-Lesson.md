# 运行时数据区与方法区演进

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：画出 JVM 运行时数据区的完整地图，分清**线程私有**（程序计数器、虚拟机栈、本地方法栈）与**线程共享**（堆、方法区）；说清每个区存什么、会不会 `StackOverflowError` / `OutOfMemoryError`、用哪个参数控制；讲透**方法区从"永久代 PermGen"到"元空间 Metaspace"的演进因果**（JDK 8 为何把类元数据挪到本地内存）；并理解**直接内存（Direct Memory）**为什么游离于 `-Xmx` 之外、为何是 netty/NIO 高性能 IO 的关键也是 OOM 隐蔽源。这是所有 GC 与调优讨论的地基。

## 一、全景地图：五大区域 + 直接内存

```flow
线程私有：程序计数器 PC | 虚拟机栈(栈帧: 局部变量表/操作数栈/动态链接/返回地址) | 本地方法栈
线程共享：堆 Heap(实例/数组, GC 主战场) | 方法区(类元信息/运行时常量池/静态变量/JIT 代码)
堆外：    直接内存 Direct Memory(NIO DirectByteBuffer, 不受 -Xmx 约束)
```

| 区域 | 线程 | 存什么 | 溢出异常 | 关键参数 |
| --- | --- | --- | --- | --- |
| 程序计数器 | 私有 | 当前字节码行号 | **唯一不 OOM** | — |
| 虚拟机栈 | 私有 | 栈帧 | `StackOverflowError` / `OOM` | `-Xss` |
| 本地方法栈 | 私有 | native 调用 | `StackOverflowError` / `OOM` | — |
| 堆 | 共享 | 对象实例、数组 | `Java heap space` | `-Xms/-Xmx` |
| 方法区(元空间) | 共享 | 类元数据、常量、静态 | `Metaspace` / `heap space` | `-XX:MaxMetaspaceSize` |
| 直接内存 | 共享 | 堆外缓冲区 | `Direct buffer memory` | `-XX:MaxDirectMemorySize` |

## 二、程序计数器：最小的、唯一不灭的区

每个线程一个 PC，记录**当前正在执行的字节码指令地址**（分支/循环/异常跳转靠它定位）；调用 native 方法时值为 undefined。因为生命周期极短、内容极小，**它是 JVM 里唯一不会发生 OOM 的区域**。线程切换后回来要接着执行，PC 就是"读到哪了"的书签。

## 三、虚拟机栈：栈帧与两种溢出

线程私有，每次方法调用压入一个**栈帧**，存局部变量表、操作数栈、动态链接、方法返回地址。

```java
// 例子目的：用无终止递归制造栈帧堆积，直观虚拟机栈的 StackOverflowError 与 -Xss 的边界
public class StackOverflowDemo {
    static int depth = 0;
    static void recurse() { depth++; recurse(); }   // 每调一次压一个栈帧，局部变量 depth 使帧不为空；无终止条件
    public static void main(String[] args) {
        try { recurse(); }
        catch (StackOverflowError e) { System.out.println("栈深度到达上限 depth=" + depth); } // 正确使用结果：抛出 StackOverflowError，被捕获，JVM 不崩、进程还在
        // 错误认知：以为栈溢出=堆内存不够→ 加大 -Xmx 完全无效；栈溢出该调 -Xss（每线程栈大小），或用迭代替代深递归
    }
    // 错误用法：线程数爆炸(如成千上万平台线程)导致各线程申请栈空间总量超物理内存→ 抛 OutOfMemoryError: unable to create new native thread(这是"创建不出线程"，与递归 StackOverflowError 是两码事)
}
// 关键点：递归太深→ StackOverflowError；线程太多撑爆栈总量→ OOM。前者降深度/加 -Xss，后者减并发线程数(或上虚拟线程)。
```

`-Xss` 越大，单线程能递归越深，但每个线程占的内存越多、能同时存活的线程越少——**栈大小是"深度"与"并发数"的权衡**。

## 四、堆：GC 的主战场

存放几乎所有对象实例和数组，线程共享，是垃圾回收的核心区域。逻辑上分代（Young: Eden + Survivor、Old），G1 之后物理上分成等大的 **Region**（见 s2）。参数 `-Xms`（初始）`-Xmx`（最大）；生产常设二者相等避免运行时扩容抖动。堆满且回收腾不出空间 → `java.lang.OutOfMemoryError: Java heap space`。

## 五、方法区：从永久代到元空间（演进是重点）

方法区是**规范上的概念**（存类元信息、运行时常量池、静态变量、JIT 编译代码），**实现**经历了两次搬家：

```flow
JDK 7 及以前：永久代 PermGen —— 在"堆"里，用 -XX:PermSize/MaxPermSize，大小固定、难调、是 OOM 高发区
JDK 8+：元空间 Metaspace —— 移到"本地内存(堆外 native)"，-XX:MetaspaceSize(触发GC阈值)/MaxMetaspaceSize
```

**为什么取消永久代**：

1. 永久代大小难定——设小了频繁 `OutOfMemoryError: PermGen space`（大量反射/动态代理/CGLIB 生成的类挤在里面），设大了浪费且从堆借不了。
2. Full GC 回收永久代效率低、条件苛刻。
3. 为与 JRockit 合并、统一 HotSpot。搬到本地内存后，**类元数据可随需要增长，只受物理内存限制**（仍可用 `MaxMetaspaceSize` 封顶防失控）。

```java
// 例子目的：用自定义类加载器反复加载同一个类制造类元数据堆积，复现元空间 OOM（JDK 8+）
// 正确用法：同一个类用同一个 ClassLoader 只加载一次 → 元空间稳定不涨
class Loader extends ClassLoader { }        // 每 new 一个 Loader 就是一个独立的类加载器命名空间
// 错误用法：循环中 new Loader().loadClass("MyBean") 加载同名类却不释放旧的 ClassLoader
//   → 不同 ClassLoader 加载的同名类是"不同的类"，各自在元空间留一份类元数据，旧 Loader 被强引用拖住无法卸载
//   → 抛 java.lang.OutOfMemoryError: Metaspace
// 修复：设 -XX:MaxMetaspaceSize 兜底 + 排查类加载器泄漏(强引用 Chain: 静态 Map/线程/缓存 持有旧 ClassLoader)；呼应 jvm s3-2 泄漏定位
```

> 顺带：**静态变量、运行时常量池**早在 JDK 7 就从永久代挪进了**堆**；**即时编译后的本地代码（CodeCache）**一直是独立于堆/方法区的原生内存区，CodeCache 满会导致"不再生成 JIT 代码、退回解释执行"，性能骤降。

## 六、直接内存：高性能 IO 的双刃剑

NIO 用 `ByteBuffer.allocateDirect` 在**堆外（native）**分配缓冲区，避开"Java 堆→内核缓冲区"的一次复制，配合 `sendfile`/零拷贝大幅提升 IO 吞吐（呼应 netty 的 `ByteBuf` 池化与直接内存）。

```java
// 例子目的：分配直接缓冲区并演示它不受 -Xmx 约束、泄漏时抛 Direct buffer memory OOM
java.nio.ByteBuffer buf = java.nio.ByteBuffer.allocateDirect(64 * 1024); // 堆外分配，不占堆，故 -Xmx 再小也分得动
buf.put((byte)1); buf.flip();                                            // 像普通 Buffer 一样读写(双指针见 netty s2-2)
// 正确使用结果：IO 少一次堆↔堆外拷贝，吞吐高；内存由 Cleaner 在 Buffer 被 GC 时间接释放堆外部分
// 错误用法：只靠 -Xmx 估算总内存、忽略堆外 → 堆没满但堆外无限增长，抛 java.lang.OutOfMemoryError: Direct buffer memory
// 错误用法：netty 未配对 release / 未开 MemoryLeakDetector → 直接内存泄漏(堆内存却看着正常)，须 -XX:MaxDirectMemorySize 显式封顶 + 用泄漏检测定位
```

**关键认知**：直接内存**不受 `-Xmx` 管，只受 `-XX:MaxDirectMemorySize`（默认约等于堆最大）**；它是 OOM 时最容易被漏算的一块——堆 dump 里看不到它，得用 NMT（`-XX:NativeMemoryTracking`）排查（见 s3）。

## 七、动手题

1. 用 `-Xss128k` 跑第三节的递归 demo，记录 `depth` 上限；改 `-Xss512k` 再跑，验证栈大小与可递归深度的正相关。
2. `-XX:MaxMetaspaceSize=32m` 跑一个反复用新 `ClassLoader` 加载同名类的循环，复现 `OutOfMemoryError: Metaspace`；`jstat -gcmetacapacity` 观察。
3. 写个只 `allocateDirect` 不释放、堆很小的循环，验证堆没 OOM 而直接内存先炸，体会"堆外不受 -Xmx"。
4. `java -XX:+PrintFlagsFinal -version` 找出你机器上各区域的默认大小。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| `StackOverflowError`（深递归/JSON 自引用） | 栈帧超 `-Xss`，非堆问题，别加 `-Xmx` |
| `unable to create new native thread` | 线程数超系统/内存承受，减线程或用虚拟线程 |
| `OutOfMemoryError: Metaspace` | 类加载器/动态代理泄漏，类元数据只增不减 |
| `Direct buffer memory` OOM 但堆正常 | 堆外内存未封顶/未释放，`-Xmx` 管不到它 |
| 升级后老 `MaxPermSize` 参数报错 | JDK 8 起永久代废除，应改 `MaxMetaspaceSize` |

## 九、关联技术栈

- **向下**：GC 如何回收堆各区 ↔ jvm s2-1；Region 化 ↔ s2-2
- **排障**：栈/元空间/直接内存三类 OOM 的现场定位 ↔ jvm s3-1、s3-2；NMT 查堆外 ↔ s3-1
- **框架**：CGLIB/动态代理/热部署产生大量类 → 元空间压力 ↔ spring-core AOP
- **IO**：直接内存与零拷贝、netty `ByteBuf` 池化 ↔ netty s2-2、s3-2
- **容器**：`-Xmx` 与 cgroup limit、堆外一起算进容器内存 ↔ 构建运维/Docker JVM 感知

## 十、本节小结

运行时数据区按"**线程私有（PC/虚拟机栈/本地方法栈）vs 共享（堆/方法区）+ 堆外直接内存**"记最清楚：**PC 唯一不 OOM；栈溢出看 `-Xss` 不是 `-Xmx`；堆是 GC 主场；方法区从堆内的永久代迁到本地内存的元空间（JDK 8），只为让类元数据能弹性增长、摆脱难调的固定区；直接内存游离于 `-Xmx` 之外，是零拷贝的引擎也是被漏算的 OOM 源。** 记住每个区"归谁、放什么、哪个参数管、炸了报什么"——这是谈 GC 和调优之前必须打平的地图。

下一节类加载机制与双亲委派——加载器分层、以及 SPI/Tomcat 为何要破坏双亲委派。
