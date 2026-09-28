# JVM 的容器资源感知 · 作业

## 作业 1：复现经典 OOMKilled 事故

**目标**：亲手制造"堆超容器 limit"并观察证据。

1. 用支持容器感知的镜像起 `--memory=256m` 的 Java 进程，不加任何 -Xmx，用 `stress`/循环分配让它涨堆 → `docker inspect` 确认 OOMKilled=true、退出码 137（输出：inspect 片段）。
2. 模拟老 JVM 行为：显式 `-Xmx512m`（超 limit）重复一次，对比崩溃速度（结果：理解"读宿主内存算堆"为何在容器里致命）。
3. 记录 `java -XX:+PrintFlagsFinal -version | grep MaxHeapSize` 在有/无 `--memory` 下的差异（验收：能说出 UseContainerSupport 生效的直接证据）。

## 作业 2：非堆内存定量

**目标**：证明 limit 不止要罩堆。

1. 起一个 256m limit 容器，写程序疯狂开线程（不占堆），观察 RSS 增长到被杀（输出：线程栈耗尽配额，堆没用多少也被 137）。
2. Netty/gRPC 或ByteBuffer 分配 direct memory，加/不加 `-XX:MaxDirectMemorySize` 对比（异常用例：无上限时堆外吃光 limit；有上限时抛 OOM 可定位）。
3. 用 `-XX:NativeMemoryTracking=summary` + `jcmd ... NMT detail` 列真实内存构成表，写进笔记（说明：NMT 只统计 JVM 内部，glibc arena 等仍需 RSS 对比）。

## 作业 3：定一套生产 JVM 参数模板

**目标**：输出可复用的容器化 Java 服务启动参数。

1. 按 s1-2 最终镜像写出启动命令：MaxRAMPercentage/InitialRAMPercentage、MaxDirectMemorySize、MaxMetaspaceSize、ExitOnOutOfMemoryError、UseContainerSupport，每项附一行"为什么是这个值"（验收：limit 与预期 RSS 峰值有 ≥20% 余量）。
2. 反例自检：模板里是否出现 `-Xmx=limit`、MaxRAMPercentage=90、无堆外上限——逐项划红纠正（错误用例治理）。
3. 补一段 CPU 说明：本服务 `--cpus` 设多少、GC 线程数怎么估，throttle 出现后如何观察（示例：`--cpus=0.5` 下高吞吐是否反而变慢）。
