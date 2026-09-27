# 实际面试题 · OOM / CPU 飙高 / 频繁 Full GC 排查手册

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。这类题面试官要听的是**一条清晰的排查主线 + 命令落点 + 代价意识**，不是零散名词。

## 题 1：线上 CPU 100%，你怎么查？

**期望时长**：2 分钟

**答题要点**：

- `top -Hp <pid>` 找到进程内占用最高的线程 TID（十进制）→ `printf "%x"` 转 16 进制 → `jstack <pid>` 里搜 `nid=0x<hex>` 定位栈帧。
- 抓**多份 jstack 对比**，栈帧长期不变才是真热点。
- 若高 CPU 线程是 `GC threads`/`VM Thread`，说明不是业务代码而是 GC 疯狂回收 → 转"频繁 Full GC"排查。

**追问链**：

1. 有 Arthas 怎么更快？→ `thread -n 5` 直接列最忙线程栈，`thread -b` 找阻塞/死锁，免手工换算。
2. 千万不可做什么？→ 别 `kill -9` 毁灭现场；先取证再重启。

## 题 2：OOM 有哪几种？分别怎么定位？

**答题要点**：按 `OutOfMemoryError` **后缀**分类：

- `Java heap space` / `GC overhead limit`：堆内，heap dump + MAT，看 Full GC 后 Old 降不降判泄漏。
- `Metaspace`：类元数据膨胀（动态代理/CGLIB/热部署），查类加载、设 `MaxMetaspaceSize`。
- `unable to create new native thread`：线程数爆或 OS 限制，数线程、查线程池与 `ulimit/nproc`。
- `Direct buffer memory`：堆外，**堆 dump 看不到**，查 `MaxDirectMemorySize`/Netty 池/`Bits.reserved`。

**追问链**：`heap space` 和 `Direct buffer` 抓的东西一样吗？→ 不一样，前者抓堆 dump，后者堆外要查别的路径，加大 `-Xmx` 对后者无益。

## 题 3：频繁 Full GC 一定是内存泄漏吗？怎么确认？

**答题要点**：

- 不一定。核心判据是 **Full GC 后老年代占用是否显著下降**。
- 不降 → 疑似泄漏 → heap dump + MAT。
- 降下去但很快又满 → 分配/晋升太快（海量临时对象/缓存太大）→ 火焰图找分配点、治代码、加大 Young。

**追问链**：

1. G1 频繁 Full GC 特殊诱因？→ **to-space exhausted**（没空 Region 承接晋升），加大堆或调 IHOP。
2. 怎么确认是谁触发的 Full GC？→ 看 GC 日志触发原因；疑似 `System.gc()` 就 `jstack` 抓调用栈。

## 题 4：`jmap`、`jstack`、heap dump 在生产用有什么代价？

**答题要点**：

- `jmap -histo:live` **会触发一次 Full GC**，大堆上代价极高。
- `jmap -dump` / Arthas `heapdump` 会 **STW** 且耗时随堆增大，大堆应先摘流量/错峰，必要时 `--live` 减小文件。
- `jstack` 相对轻，但要抓多份对比才有意义。

**追问链**：为什么建议 `-XX:+HeapDumpOnOutOfMemoryError` 提前配？→ OOM 瞬间才有自动留证，事后重启就没了；开销可忽略，属"生产常开"的诊断开关。

## 题 5：服务每隔几天必 OOM，重启就好，怎么根治？

**答题要点**：

- "重启就好 + 周期性复现"是**慢泄漏**典型特征——重启只是清空堆，没解决引用链挂住 GC Root 的问题。
- 抓两次不同时刻的 heap dump 做**差异对比**（MAT 支配树 / 泄漏疑犯报告），定位持续增长的对象类型与到 GC Roots 的路径。
- 常见根因：无界缓存、未 `remove()` 的 ThreadLocal、注册不注销的监听器、静态集合（呼应 s2-1、juc s3-1）。

**追问链**：怎么在没 dump 的情况下先缩小范围？→ 监控老年代占用趋势（只涨不落）、`jstat -gcutil` 采样、`jcmd GC.class_histogram` 看实例数 Top，定位可疑类后再 dump 精确分析。
