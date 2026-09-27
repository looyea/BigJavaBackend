# 实际面试题 · 堆转储分析与内存泄漏定位

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。考的是"你真打开过 MAT 吗、能不能从 dump 走到代码行"，纸上谈兵一眼被看穿。

## 题 1：给你一个 .hprof，你怎么定位泄漏？说说 MAT 的使用。

**期望时长**：2~3 分钟

**答题要点**：

- **Leak Suspects** 报告先看，常直接给"Top 占内存对象 + 占比"。
- **Dominator Tree** 按 **Retained Heap** 降序，找"Shallow 很小、Retained 巨大"的持有者（多半是无界集合/静态字段）。
- **Histogram** 看类实例数分布。
- 对可疑对象 **Path to GC Roots（exclude weak/soft/phantom）**，把强引用链一路点到自己的代码行。

**追问链**：

1. 为什么看 Retained 不看 Shallow？→ Retained 才是"回收它能释放多少"，泄漏看的是谁 holds 住一大片。
2. 支配树（Dominator Tree）依据是什么？→ A 支配 B ⟺ 根到 B 的所有路径都必经 A；删 A，B 子树即成垃圾。

## 题 2：Java 里常见的内存泄漏有哪些？

**答题要点**：五大现场——

- 静态 `Map/List`/无界缓存只增不清；
- ThreadLocal 不 `remove()`（线程池核心线程长期存活，僵尸 value 堆积，呼应 juc s3-1）；
- 监听器/回调注册不注销；
- 未关闭的资源（流/连接/ResultSet）；
- `equals/hashCode` 写错的键放进 HashMap 删不掉。

**追问链**：这些泄漏的共性是什么？→ 对象逻辑上"该死了"，但**仍挂在一条通往 GC Root 的强引用链上**（静态字段、活跃线程、集合元素都是 Root），所以可达、不回收。

## 题 3：只有一张 dump，某业务对象一堆，怎么判断是不是泄漏？

**答题要点**：

- 单张难定论——可能只是"在途请求的正常对象"。
- 更可靠：**间隔一段时间、负载相似再抓一张做 Histogram 差分**，Δ 持续为正的自定义类才是嫌疑，再追引用链。
- 结合监控：老年代占用**只涨不落**、Full GC 后 Old 不降（呼应 s3-1）。

**追问链**：怎么在没 MAT 时快速粗筛？→ `jcmd GC.class_histogram` / Arthas `vmtool --getInstances` 看实例数 Top，锁定可疑类后再 dump 精分析。

## 题 4：`jmap -dump:live` 的 live 有什么问题？生产 dump 要注意什么？

**答题要点**：

- `:live` 会**先触发一次 Full GC**、只导存活对象——扰动现场、丢掉临时对象，还多花一次 GC。
- 任何 heap dump 都 **STW**，耗时随堆增大；生产大堆要**先摘流量/错峰**，别手抖制造二次事故。
- 最稳的是**事前配** `-XX:+HeapDumpOnOutOfMemoryError`，OOM 瞬间自动留证。

**追问链**：为什么建议生产常开 HeapDumpOnOOM？→ 开销可忽略，却不配就会"重启后现场全无、只能等下次复现"。

## 题 5：ThreadLocal 泄漏，MAT 里你怎么追出来？

**答题要点**：

- 先看 Histogram 里 value 类型实例数异常。
- 对某个 value **Path to GC Roots 但 exclude 弱/软引用**，链尾落在 `Thread → ThreadLocalMap.Entry(null-key, value) → value`——因为 key 是弱引用（可被清成 null），**value 是强引用**，线程不死就一直拽着。

**追问链**：

1. key 用弱引用不就不泄漏了吗？→ 不，弱引用只让 key 可回收，value 仍强引用，唯一解药是 `remove()`。
2. 为什么线程池里更严重？→ 核心线程几乎不死，`Entry` 的僵尸 value 持续累积，还串数据（呼应 juc s3-1）。
