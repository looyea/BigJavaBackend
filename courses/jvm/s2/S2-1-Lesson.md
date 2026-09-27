# 垃圾判定与回收算法

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：说清 JVM **为什么用可达性分析而非引用计数**（循环引用）；列出 **GC Roots** 到底有哪些；分清**强/软/弱/虚**四种引用的回收时机与用途（缓存、`ThreadLocalMap` key、`Cleaner`）；掌握三大**回收算法**（标记-清除 / 标记-复制 / 标记-整理）各自的碎片、吞吐、停顿权衡与它们在**分代**里的分工；理解**分代假说**、**卡表/记忆集 + 写屏障**如何把"跨代引用"扫描成本压下来；并知道**安全点（Safepoint）**为什么是"GC 停顿"的前提。是理解 G1/ZGC（下一节）的地基。

## 一、谁还活着：引用计数 vs 可达性分析

**引用计数**（每个对象记被引用数，归零即回收）实现简单、可即时回收，但**解决不了循环引用**——A↔B 互相引用，外部已无人用，计数却始终 >0，永不回收。Java 因此不用它。

**可达性分析**：从一组 **GC Roots** 出发，沿"引用边"遍历，遍历不到（不可达）的对象即垃圾。

```java
// GC Roots 常见来源：
//  - 虚拟机栈中各帧的局部变量表里正在引用的对象（活着的方法参数/局部变量）
//  - 方法区静态字段引用的对象、运行时常量池引用
//  - JNI（本地方法栈）引用
//  - 已加载的 Class 对象、类加载器本身
//  - 活跃的 Thread 对象、被 synchronized 持有的锁对象
```

## 二、四种引用强度：强 > 软 > 弱 > 虚

| 引用 | 回收时机 | 典型用途 |
| --- | --- | --- |
| 强 `Object o` | 永不因内存回收（宁可 OOM） | 普通引用 |
| 软 `SoftReference` | **内存不足时**才回收 | 内存敏感缓存（图片、热点数据） |
| 弱 `WeakReference` | **下一次 GC 即回收**（只要只被弱引用） | `ThreadLocalMap` 的 key、`WeakHashMap` |
| 虚 `PhantomReference` | 随时，`get()` 恒 null | 配合 `ReferenceQueue`/`Cleaner` 做堆外资源释放 |

```java
// 例子目的：用 Weak/Soft/Phantom 引用直观"四种引用各自何时被回收"
import java.lang.ref.*;
Object strong = new Object();          // 强引用只要 strong 还在，对象绝不回收（哪怕 OOM 也不清）
SoftReference<byte[]> soft = new SoftReference<>(new byte[1<<20]); // 软引用：内存吃紧时才允许被清
WeakReference<Object> weak = new WeakReference<>(new Object());    // 弱引用：下一次 GC 就清(get() 随后变 null)
Object referent = new Object();
ReferenceQueue<Object> rq = new ReferenceQueue<>();
PhantomReference<Object> phantom = new PhantomReference<>(referent, rq); // 虚引用：get() 恒 null，回收时入队通知，用于释放堆外资源
referent = null;                        // 切断强引用；此时只剩 phantom 引用它
System.gc();                            // 提示回收（正确用法：生产别依赖显式 GC 调优，此处仅为观察）
// 正确使用结果：weak.get() 回收后为 null；soft 在内存充足时仍在、紧张时被清；phantom 使 rq 收到一个待处理项(Cleaner 就靠这个)
// 错误用法：拿 SoftReference 当"业务必需数据"的缓存却没有回源逻辑 → 被 GC 清掉后拿 null 引发 NPE/逻辑错
// 错误用法：以为 ThreadLocalMap key 是弱引用就"不会泄漏 value" → value 仍是强引用，仍需 remove（呼应 juc s3-1）
```

> `finalize()` 已被 JDK 9 起废弃、JDK 18 起 deprecated for removal：执行时机不确定、可能拖慢回收、有 resurrect 风险；清理资源用 `try-with-resources` 或 `Cleaner`（虚引用）。

## 三、三大回收算法

```flow
标记-清除 Mark-Sweep：     标记存活→清除未标记。  缺点：内存碎片（连续大块分配难）
标记-复制 Copy：           把存活对象复制到另一块空闲区，整块秒清。 缺点：浪费一半空间、存活率高时复制成本大
标记-整理 Mark-Compact：   存活对象向一端移动、边界外全清。 无碎片，但移动对象+更新引用开销高(STW 长)
```

**为什么这样切**：复制算法"按存活比例收费"——若一块区里大部分是垃圾（Young 代对象朝生夕死），复制少量存活极划算；整理算法适合存活率高、又不想像清除那样留碎片的 Old 代。

## 四、分代假说与"空间分配担保"

**弱分代假说**：绝大多数对象朝生夕灭。**强分代假说**：熬过越多次 GC 的对象越难死。据此堆分 **Young（Eden + S0 + S1）** 与 **Old**：

- 新对象在 Eden；Eden 满 → **Minor GC**（复制存活到 Survivor，年龄+1，在 Survivor 间来回拷贝）。
- 年龄达阈值（默认 15，`-XX:MaxTenuringThreshold`）或 Survivor 放不下 → **晋升 Old**。
- Old 满 → **Major/Full GC**（标记-整理，慢、STW 长）。
- 一次 Minor 后剩余空间不足担保大对象晋升 → 可能直接触发 Full GC（"空间分配担保失败"）。

```java
// 例子目的：用静态集合无限持有对象，直观"看似该回收却因引用链到 GC Root 而不回收"→ 堆 OOM
static final java.util.List<Object> LEAK = new java.util.ArrayList<>(); // 静态字段是 GC Root
void handle(Object req) { LEAK.add(req); }   // 每个请求对象都被这条强引用链拽住：LEAK(Root)→list→req
// 错误用法：把请求级对象放进静态/长生命周期集合却从不移除 → 处理完仍可达、永不回收 → 老年代持续增长 → java.lang.OutOfMemoryError: Java heap space
// 正确用法：需要缓存时用 WeakHashMap/SoftReference 或设大小上限 + 淘汰策略(LRU)，别让引用链挂到 Root
```

## 五、卡表与写屏障：跨代引用怎么不扫全 Old

Young GC 时，若有 Old 对象引用了 Young 对象（**跨代引用**），这些 Old 引用也要当 Roots。全扫 Old 太慢 → 引入 **卡表（Card Table）**：把堆切成固定大小（如 512B）的"卡"，用一个字节数组标记"脏卡"（该卡内有 Old→Young 引用）。

- **写屏障（write barrier）**：每次给对象字段赋值后，一小段 JIT 生成的代码把对应卡标脏。Minor GC 只扫脏卡，避免遍历整个 Old。
- **记忆集（Remembered Set）**：G1 每个 Region 维护"谁指向我"的 RSet，本质是更精细的跨区引用管理，同样是写屏障维护（见 s2-2）。

```java
// 例子目的：点出"赋值即触发写屏障标脏卡"这一隐蔽成本，解释为何频繁写引用型字段会拖累 GC
o.field = other;   // 正确写法本身没问题；但每次引用赋值 JVM 都会插入写屏障把卡标脏（错误认知：以为赋值零成本）
// 影响：写屏障是 G1/ZGC 停顿模型的关键开销来源之一；大量引用写入(如大数组元素搬动)会放大 GC 成本，调优时要看 GC 日志里的引用处理时间
```

## 六、安全点 Safepoint：停顿的前提

GC（及偏向撤销、线程挂起等）需要在**所有线程都停在"可枚举根"的安全位置**时才动手——这些位置就是安全点（方法返回、循环回边、异常跳转等处插入的"poll 点"）。

- 有"可suspend点"却迟迟不到 → **长时间不进安全点**（如无 count 调节的超密循环、被 JIT 优化掉循环变量的计数循环）会拉长 STW。
- `-XX:+PrintSafepointStatistics` / `-Xlog:safepoint` 可排查"哪些线程拖慢了安全点"（呼应 s2-3、s3-1）。

## 七、动手题

1. 用 `WeakReference` 包一个对象、切断强引用后 `System.gc()`，验证 `get()` 变 null；再对 `SoftReference` 在设小堆下观察内存紧张时被清。
2. 写第四节 `LEAK` 静态列表累加大对象、`-Xmx64m` 复现堆 OOM，再用 `WeakHashMap`/LRU 上限修复。
3. 加 `-Xlog:gc*,safepoint` 跑一段密集引用赋值 + 密循环，观察 GC 日志里的脏卡处理与"到达安全点耗时"。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 明明没人用了却不回收、堆涨 | 对象仍挂在静态集合/缓存/线程等 GC Root 引用链上（泄漏） |
| Full GC 又长又频繁 | 大对象直接进 Old、或担保失败；Old 用标记-整理 STW 久 |
| Minor GC 也不快 | 存活对象多，复制成本大；Survivor 太小来回拷 |
| 频繁引用赋值后 GC 时间上升 | 写屏障标脏卡多，Root 扫描/引用处理变重 |
| 偶发超长 STW | 有线程迟迟不进安全点（密循环/巨方法），拖住全局停顿 |

## 九、关联技术栈

- **向下**：这些机制如何在 G1/ZGC 里演化 ↔ jvm s2-2；GC 日志字段解读与调优 ↔ s2-3、s3-1
- **向前**：引用类型 ↔ ThreadLocal 弱引用 key（juc s3-1）、`Cleaner`/堆外释放（netty、s1-1 直接内存）
- **排障**：静态集合泄漏的支配树定位 ↔ jvm s3-2
- **容器/内存**：分代 Region 大小与堆规划 ↔ s2-3 容量规划

## 十、本节小结

判定死活用**可达性分析**（引用计数搞不定循环引用）：从 **GC Roots** 到不了的就是垃圾；引用分**强软弱虚**四档，对应"绝不回收 / 缺内存才回收 / 下次 GC 就回收 / 仅通知释放"。回收算法**清除留碎片、复制按存活收费适合 Young、整理无碎片但 STW 重适合 Old**，分代正是把三者用在最划算的地方。**卡表 + 写屏障**用"标脏卡、只扫脏卡"避免跨代引用扫全 Old，**安全点**是一切 STW 停顿的前提。**而"该回收却不回收"的头号元凶，是对象仍被挂在通向 GC Root 的静态集合/缓存/线程引用链上。**

下一节直面停顿模型：G1 / ZGC / Shenandoah——Region、 Mixed GC、着色指针与读/写屏障。
