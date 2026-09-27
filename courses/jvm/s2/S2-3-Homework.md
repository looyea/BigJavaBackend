# 作业题 · 线上调优方法论

> 作业不判分，做完对照参考答案自查。全部在 JDK 17 上验证。

## 作业 1：为微服务写"起手式"参数并自检（必做）

给一个 4C8G 容器里的 Spring Boot 服务写一份 JVM 参数，要求：G1、`MaxGCPauseMillis` 与你设定的 P99 目标挂钩、开启统一 GC 日志并轮转、OOM 自动落堆转储到持久卷、用 `MaxRAMPercentage` 而非写死 `-Xmx`。

注释逐条说明每个参数解决什么问题、以及如果设错会踩什么坑（对照课程 §一、§三、§七）。

**参考答案要点**：`-XX:+UseG1GC -XX:MaxRAMPercentage=60 -XX:MaxGCPauseMillis=150 -Xlog:gc*,safepoint:file=...:filecount=5,filesize=50m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/data/dumps`。

## 作业 2：容量规划实算（必做）

压测得到：Eden 增长约 200 MB/s，希望 Young GC 每 15 秒一次；晋升速率约 30 MB/min，能容忍 1 小时一次 Full GC。

要求：算出 Eden 应设多大、Old 至少多大，写清推导（用课程 §二 估算式）。再解释为什么"堆不是越大越好"。

**参考答案要点**：Eden ≈ 15s × 200MB/s = 3000MB ≈ 3G；Old 需容纳 60min × 30MB/min = 1800MB 晋升 + 现有活对象 + 安全余量 → 至少 ~2.5G，故整堆合理取 6~8G。堆越大 Full GC 越久、启动越慢、成本越高。

## 作业 3：读一份 GC 日志下结论（必做）

用课程 §一 参数跑一个"分配高 + 有界缓存"程序，导出 gc.log 丢进 GCEasy/GCViewer，记录：GC 时间占比、最大单次停顿、Full GC 次数与触发原因。

注释写出：若"Full GC 后 Old 显著下降"与"几乎不降"各说明什么、下一步分别怎么处理（对照 §五 决策树）。

## 作业 4：容器 OOMKilled 复现与修复（选做）

在 K8s（或 docker）里把 `-Xmx` 设成等于容器 memory limit、并让程序多用直接内存，观察 Pod 被 `OOMKilled`（`describe` 显示 exit 137）；改成 `MaxRAMPercentage=60` 后复测。

注释解释"JVM 没报 OutOfMemoryError 却被杀"的原因（堆外内存计入 cgroup）。

## 作业 5：单变量调优实验报告（选做）

固定压测脚本，只改 `-XX:MaxGCPauseMillis`（200 / 20 / 100）三档，各跑一轮，整理成表格对比停顿分布与吞吐，写一段结论说明为什么"设 20ms 不一定比 200ms 好"。

**参考答案要点**：过小软目标→G1 只收少量 Region→回收不足→GC 更密甚至退化 Full GC，吞吐反降；证明必须单变量 + 基线 + 对照。
