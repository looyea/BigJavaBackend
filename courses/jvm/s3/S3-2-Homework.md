# 作业题 · 堆转储分析与内存泄漏定位

> 作业不判分，做完对照参考答案自查。需安装 Eclipse MAT（或用 `jhat`/`jhsdb` 粗看）。全部在 JDK 17 上验证。

## 作业 1：无界缓存泄漏定罪（必做）

写一个 `static final Map<String, byte[]> CACHE = new HashMap<>()`，循环 `CACHE.put(UUID, new byte[1<<16])` 从不清理，`-Xmx128m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=./d.hprof` 跑出 OOM。

用 MAT 打开：① 看 Leak Suspects 是否指向你的 `CACHE`/`HashMap`；② Dominator Tree 里它的 Shallow 与 Retained 各多大、说明什么；③ 对它 Path to GC Roots 看链尾是不是那个 `static` 字段。注释写三步结论。

**参考答案要点**：`CACHE` Shallow 极小但 Retained 近乎占满整堆；根是"静态字段=GC Root"（呼应 s1-1、s2-1）。

## 作业 2：ThreadLocal 泄漏现场（必做）

线程池里任务 A `TL.set(大对象)` 后不 `remove()`，反复提交使核心线程长期存活。dump 后：先看 Histogram 里 value 类型实例数异常，再对该 value 做 **Path to GC Roots（exclude weak/soft/phantom）**，观察链尾落在 `Thread → ThreadLocalMap.Entry → value`。

注释解释为什么"排除弱引用"后仍能追到 value（key 是弱引用可被清、value 是强引用需 remove 才断，呼应 juc s3-1）。

## 作业 3：两张 dump 差分（必做）

在稳定压力下，间隔 5 分钟抓 `dump1.hprof`、`dump2.hprof`。用 MAT 的 Compare Basket 对两张 Histogram 求差，按"Number of Objects Δ"排序，找出 Δ 持续为正的自定义业务类，再对它定位引用链。

注释说明"为什么单张 dump 容易误杀在途请求对象、两张差分更可靠"。

## 作业 4：`equals/hashCode` 导致的"删不掉"（选做）

定义一个字段可变的类作为 `HashMap` 的 key，put 后修改参与哈希的字段再试图 remove，观察移除失败、map 只增不减。dump 后在 MAT 里表现为同类实例异常多却无明显持有链。

注释说明这属于现场⑤，并给出修复（key 用不可变类 / record）。

## 作业 5：修复并回归验证（选做）

给作业 1 的缓存换成 Caffeine（`maximumSize` + `expireAfterWrite`），同负载重跑并再抓 dump，验证 Retained 不再单调增长。

**参考答案要点**：有界 + 过期后老年代占用趋稳，Leak Suspects 不再命中该缓存——完成"定位→修复→回归"闭环。
