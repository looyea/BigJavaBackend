# 线上调优方法论

> 本节难度：★★★★★
> 重要程度：★★★★★
> 学习产出：把前几节的内存/类加载/GC 原理收敛成一套**可复制的调优方法论**——先立 SLA 指标（P99 停顿、吞吐、内存 footprint），再做**容量规划**（由分配速率与晋升速率反推各代大小），然后用**统一 GC 日志 + 监控指标**观测，最后**单变量**迭代验证。记住几条铁律：**默认 G1 不是错、90% 的服务不需要"调 GC"而是需要"改代码 / 加内存 / 治泄漏"**；调优没有基线与对照组就是玄学；容器里 `-Xmx` ≠ 容器内存。电商大促、金融低延迟撮合、电力长周期采集各自的取舍落点在这节收敛。

## 一、先纠正心态：什么才叫"调优"

调优不是背一堆 `-XX:` 参数往生产上堆。真正的调优是**在明确约束下，用最小改动换取指标改善，并能证明它真的改善了**：

1. **有目标**：P99 RT < 100ms？吞吐最大化？还是别被容器 OOMKilled？
2. **有基线**：改动前的 GC 日志、RT 分布、CPU/内存曲线。
3. **有对照**：**单变量**——一次只改一个参数，同负载同环境跑对比。
4. **可回滚**：参数进配置中心/镜像，改动有版本。

> 90% 的"GC 问题"根因不在 GC 参数，而在：泄漏、对象分配速率过高、缓存无上限、序列化产生海量临时对象。**先治代码，再动参数。**

```bash
# 例子目的：给一个通用 Spring Boot 微服务一份"稳妥起手式"参数（JDK 17 + G1）
java -XX:+UseG1GC \
     -Xms4g -Xmx4g \                        # 堆固定大小，避免运行期扩缩抖动（错误用法：容器里把 -Xmx 设成等于容器 memory limit→ 堆外 Metaspace/线程栈/直接内存没留余量→被 cgroup OOMKilled，JVM 自己却不报 OOM）
     -XX:MaxGCPauseMillis=150 \             # 软停顿目标，贴合 P99 预算（正确：取业务 RT 目标的 1/2~1/3；错误：拍脑袋设 10ms→回收不足反而更慢，见 s2-2）
     -XX:+HeapDumpOnOutOfMemoryError \      # OOM 时自动落堆转储（正确：给事后 MAT 分析留证据；错误：不设且 -XX:+ExitOnOutOfMemoryError 直接退→现场全无，只能重现）
     -XX:HeapDumpPath=/data/dumps \         # dump 落到持久卷（错误：落容器临时层→Pod 重启即丢）
     -Xlog:gc*,gc+heap=debug,safepoint:file=/logs/gc-%t.log:time,uptime,level,tags:filecount=5,filesize=50m \ # 统一日志框架并轮转（正确：JDK9+ 一律用 -Xlog；错误：照抄旧版的 -XX:+PrintGCDetails -XX:+PrintGCDateStamps→JDK17 直接忽略或告警，日志格式还和解析工具对不上）
     -jar app.jar
# 正确使用结果：GC 日志按 50MB×5 轮转、OOM 自动出 dump、停顿目标与 RT 预算挂钩，指标可被 GCViewer/GCEasy 解析
```

## 二、容量规划：用数据算，别拍脑袋

**先测两个速率**（压测或线上采样）：**分配速率**（Eden 增长 MB/s）和**晋升速率**（Old 增长 MB/min）。

```flow
对象分配速率(MB/s) ──▶ 定 Young 大小 ──▶ 控 Young GC 间隔(别太密<10s 也别太疏)
存活/晋升速率(MB/min) ──▶ 定 Old 大小 ──▶ Full GC 周期可接受吗？
存活率(存活/分配) ──▶ 验证"低存活率"假设是否被你的代码打破
```

**估算式**：`Young GC 间隔 ≈ Eden容量 / 分配速率`。想让 Young GC 落在 10~30 秒一次，就把 Eden 设成 `目标间隔 × 分配速率`。**堆总量**不是越大越好——堆越大，一次 Full GC 要扫描/整理的工作量越大、STW 越长，且进程启动慢、内存成本高。

## 三、参数分层：一次只动一层

把参数分三层，逐层确认，避免"一改十几个参数、坏了不知谁的锅"：

| 层 | 内容 | 原则 |
| --- | --- | --- |
| L0 内存尺寸 | `-Xms/-Xmx`、`-XX:MaxMetaspaceSize`、`-XX:MaxDirectMemorySize`、`-Xss` | **最高频事故源**；容器用 `MaxRAMPercentage` |
| L1 收集器与目标 | `UseG1GC/UseZGC`、`MaxGCPauseMillis` | 默认 G1 起手，按 s2-2 选型 |
| L2 诊断开关 | `-Xlog`、`HeapDumpOnOutOfMemoryError`、`-XX:+ExitOnOutOfMemoryError` | **生产建议常开**（开销很小），出事才有证据 |

```bash
# 例子目的：非堆内存也要显式设上界，否则它们才是"看不见的 OOM"
-XX:MaxMetaspaceSize=512m \     # 元空间上限（正确：设了才会在失控时抛 OOM: Metaspace 而非吃光宿主内存；错误：完全不设 + 动态代理/热部署狂生成类→Metaspace 无限膨胀拖垮机器，见 s1-1）
-XX:MaxDirectMemorySize=1g \    # 直接内存上限（正确：约束 Netty/NIO 堆外 buffer；错误：不设且 Netty 池化 buffer 配错→堆外 OOM 而 -Xmx 还很空，堆转储里却看不到这些字节）
-Xss512k                        # 每线程栈大小（正确：海量线程/虚拟线程载体线程场景适当调小省内存；错误：设太小→稍深递归即 StackOverflowError）
```

## 四、GC 日志：调优的"黑匣子"

**不读 GC 日志就调优 = 闭眼开车。** JDK 9+ 统一用 `-Xlog`（gc / gc+heap / safepoint 三个 tag）。关键要看：

- **单次停顿时长与分布**（找最差的那几次，对齐业务 P99）。
- **GC 频率**：Young 是否过密（Eden 太小 / 分配太高）、Full 是否过频（晋升太快 / 泄漏）。
- **回收后堆占用**：Full GC 后 Old 是否显著下降——**降不下来 = 泄漏或活对象真这么多**（见 s3-1）。
- **晋升曲线**：每次 Young GC 后 Old 的增量趋势。

> 工具：把日志丢进 **GCEasy / GCViewer** 自动出吞吐、停顿分布、"是否建议换收集器"。**别手搓正则读日志。**

## 五、Full GC 排查决策树

```flow
Full GC 频繁/停顿长
 ├─ 看 GC 日志：每次 Full GC 类型触发原因(Heap Dump 触发? System.gc? 元空间? 晋升失败? to-space exhausted?)
 ├─ 触发原因是 System.gc()/RMI → -XX:+DisableExplicitGC 前先查是否依赖它释放堆外(结合 s1-1 DirectMemory)
 ├─ 原因是 Metadata/GC overhead/Reserved → 分别是类加载泄漏、堆真不够
 ├─ Full GC 后 Old 不降 → 疑似内存泄漏 → 走 s3-2：HeapDump + MAT 支配树
 ├─ Full GC 后 Old 大幅下降 → 不是泄漏，是分配/晋升太快 → 治代码(减少临时对象/加大Young/换收集器)
 └─ G1 to-space exhausted → 堆偏小 / IHOP 太高 / Mixed 回收不及时 → 加大堆或下调 IHOP
```

## 六、观测闭环：监控指标驱动，而非出事后救火

把这几条接入 Prometheus/Grafana 常态化盯（呼应构建运维可观测）：

- **GC 时间占比**（吞吐）：> 5%~10% 就该警惕。
- **最大/ P99 单次停顿**：对齐 RT SLA。
- **老年代占用趋势**：锯齿平稳=健康；**只涨不落=泄漏**（先于 OOM 报警）。
- **分配速率 / 晋升速率**：突变常对应新上线的代码或大促流量。

## 七、容器里的 JVM（高频踩坑）

- **感知 cgroup 限额**：JDK 8u191+/10+ 默认容器感知，`-XX:MaxRAMPercentage=60` 让堆随容器规格伸缩，别写死 `-Xmx` 迁 Pod 就崩。
- **堆外要留余量**：容器内存 = 堆 + Metaspace + 线程栈(native) + 直接内存 + JIT CodeCache + GC 结构。**`-Xmx` 顶满 limit 必被 OOMKilled**。
- **CPU limit 影响 GC 线程数**：G1/ZGC 并发线程按可见核数算，limit 太小会拖慢并发回收。

## 八、场景取舍：电商 / 金融 / 电力

- **电商大促**：分配速率暴涨、缓存对象多。优先**治临时对象与无界缓存**、加大 Young 稳住分配、G1 + 合理 IHOP，别让 Mixed 赶不上晋升；容量按峰值 QPS 的分配速率预留。
- **金融撮合/风控**：P99/P999 延迟是生命线，宁可牺牲吞吐也要压停顿 → **ZGC**；固定大堆、预留足够核给并发回收。
- **电力长周期采集/边缘网关**：设备内存受限、进程要跑数月不重启。重点在**防泄漏**（有界缓存、`MaxMetaspaceSize` 上界、堆趋势监控），小堆 G1 甚至 Parallel，稳定性 > 极致性能。

## 九、动手题

1. 只改 `-XX:MaxGCPauseMillis` 一个变量（200→20→100），同压测脚本跑三遍，用 GCEasy 对比停顿分布与 GC 占比，写结论。
2. 把一个服务容器 `-Xmx` 从"= limit"改成 `MaxRAMPercentage=60`，观察是否还 OOMKilled、`kubectl describe` 里的退出原因变化。
3. 压测中统计 Eden 增长 MB/s，按"目标 Young GC 间隔 15s"反推 Eden 应设多大，改 `-Xmn`/`NewRatio` 验证。

## 十、本节小结

调优方法论一句话：**先定 SLA → 用分配/晋升速率做容量规划 → 起手只锁 L0 内存尺寸 + 默认 G1 + 打开诊断日志 → 观测 GC 时间占比/停顿/老年代趋势 → 单变量迭代并留对照组**。铁律：**默认不是错、九成问题在代码不在参数、Full GC 后 Old 不降就去查泄漏（s3-2）、容器里堆外必须留余量**。下一节进入实操排查手册——OOM / CPU 飙高 / 频繁 Full GC 从现象到定位的完整命令链。
