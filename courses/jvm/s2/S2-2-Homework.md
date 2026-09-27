# 作业题 · G1 / ZGC / Shenandoah

> 作业不判分，做完对照参考答案自查。全部在 JDK 17 / JDK 21 上验证。

## 作业 1：G1 vs ZGC 停顿与吞吐对比（必做）

写一个不断分配短命对象 + 少量大对象的内存压力程序，分别用 `-XX:+UseG1GC` 与 `-XX:+UseZGC -XX:+ZGenerational`（JDK 21）运行，都加 `-Xlog:gc*:file=gc.log:time,uptime,level,tags`。

要求：从日志提取"最大单次停顿"与"GC 总耗时占比"，注释说明你观察到 ZGC 单次停顿更平、但 GC 时间占比更高（读屏障 + 并发回收抢 CPU）的取舍。

**参考答案要点**：G1 偶有数十~百 ms 停顿、吞吐更高；ZGC 停顿常 <1ms、吞吐略低。没有"全能冠军"，选型看要吞吐还是要停顿。

## 作业 2：MaxGCPauseMillis 反效果复现（必做）

同一 G1 程序，先 `-XX:MaxGCPauseMillis=100` 跑一遍，再改成 `-XX:MaxGCPauseMillis=5` 跑一遍，对比 GC 次数、是否出现 `to-space exhausted` 或 Full GC。

注释解释：为什么软目标设太小反而让回收跟不上分配、停顿总体更差。

**参考答案要点**：预算太小→每轮只收极少 Region→堆持续高位→更频繁 GC 甚至退化 Full GC；证明 `MaxGCPauseMillis` 是"软目标 + 自适应挑 Region 数"，不是硬保证。

## 作业 3：确认发行版的收集器可得性（必做）

在你使用的 JDK 上执行 `java -XX:+UseShenandoahGC -version` 与 `java -XX:+UseZGC -version`，记录哪个报 `Unrecognized VM option`。

结合 Oracle JDK / OpenJDK（Temurin/Corretto 等）差异，注释说明为什么生产选型前必须先确认所用发行版支持哪些收集器。

**参考答案要点**：Shenandoah 在 OpenJDK 构建里、Oracle JDK 通常不含；照抄别人配置可能直接启动失败。

## 作业 4：G1 大对象（Humongous）观察（选做）

用 `-XX:+UseG1GC -XX:G1HeapRegionSize=8m -Xlog:gc+heap=debug` 跑一个反复分配 >4MB（超过 Region 一半）byte[] 的程序，观察 Humongous Region 的分配与回收。

注释说明：Region 设得过小会让"一般大的对象"都变成 Humongous、加剧碎片与回收压力。

## 作业 5：为两类业务写选型方案（选做）

分别针对：① 4C8G 的 Spring Boot 订单微服务；② 64C256G 的实时风控/撮合服务。写出你选的收集器与关键参数，并用一段话论证（吞吐/停顿/成本三方面）。

**参考答案要点**：①G1（默认即对，`MaxGCPauseMillis` 取 100~200ms、Xms=Xmx）；②ZGC（大堆低延迟，`-XX:+UseZGC -XX:+ZGenerational`、固定大堆、预留足够核给并发回收）。
