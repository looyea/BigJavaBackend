# JVM 的容器资源感知 · 面试题

## 题 1：Java 服务在容器里莫名被杀，日志没有 OutOfMemoryError，怎么定位？

1. 先看退出码与 OOMKilled：`docker inspect`/`kubectl describe` 见 137+OOMKilled → 是被内核 SIGKILL，不是 JVM 自身 OOM（异常栈缺失正是线索而非谜团）。
2. 再比堆与 limit：进容器 `PrintFlagsFinal` 看 MaxHeapSize 是否超/接近 limit，判断容器感知是否生效（Java 版本、UseContainerSupport）。
3. 最后看整进程 RSS 构成：NMT/`jcmd VM.native_memory`，堆外（线程栈/Metaspace/DirectBuffer）是不是真凶（结果：绝大多数"没 OOM 却被杀"都是堆外被漏算）。

## 题 2：为什么推荐 MaxRAMPercentage 而不是写死 -Xmx？

- 弹性：同一镜像在 512m/1G/2G 规格下堆随 limit 自动缩放，避免"每档写一个 -Xmx"的配置漂移（示例：K8s HPA 改规格时堆无需重新调参）。
- 前提：JVM 必须认 cgroup（8u191+/10+），否则百分比对着的是宿主内存，适得其反（错误预期：老 JVM 上也开百分比 → 依旧按宿主算）。
- 加分：Initial 与 Max 设同值避免堆动态伸缩抖动（G1/容器场景常见做法）。

## 题 3：容器 limit 到底要罩住 JVM 的哪些内存？

```text
图目的：一句话——limit 管进程 RSS，堆只是 RSS 的一块。
RSS = Heap + Metaspace + 线程栈(Xss×数) + CodeCache + GC/JIT 结构 + DirectByteBuffer + glibc arena 等
错误做法：limit = 堆（把 -Xmx 设成等于 limit）→ 堆外一涨即 OOMKilled
正确做法：堆占 limit 的 50~60%，其余留给非堆，并对可量部分设上限（MaxDirectMemorySize/MaxMetaspaceSize）
```

## 题 4：+ExitOnOutOfMemoryError 有什么用？为什么不默认更好？

- 作用：JVM 抛 OOME 时立即退出进程（结果：容器干净重启，而非线程池半死不活地继续接流量）。
- 配合编排：配合 K8s restartPolicy 与 readiness，OOM 后快速自愈，避免"僵尸实例"拖垮上游（说明：把不可恢复状态交给编排层，比进程内硬撑更稳）。
- 权衡：会丢当场 dump，重要服务可换 `-XX:+HeapDumpOnOutOfMemoryError` 先落盘再退（题外追问：两者可并用）。

## 题 5：CPU limit 设太小，对 Java 有什么特殊伤害？

- GC 停顿变长：GC 线程与业务线程抢被限到极小的 CPU 配额，STW 期被 throttle 拉长（异常：延迟毛刺却查不到应用代码问题）。
- 线程过多：availableProcessors 感知失效按宿主核起线程池/连接池，实际只有 1 核 → 大量上下文切换与排队。
- 答法：低延迟服务宁可给 CPU requests 保证 + 放宽 limit，也别把 limit 卡到 0.1 核（示例：`--cpus=0.5` 下 P99 明显恶化）。

## 题 6：Docker 和 K8s 都要设内存 limit，语义一致吗？

- 底层一致：最终都落到 cgroup 内存上限，超限都是 OOMKill/137，与 s1-1 模型一致。
- 差异在层级与驱逐：K8s 还有 requests（调度依据）与节点级驱逐（Eviction），limit 设不当影响调度与 QoS（见 kubernetes s3-1）。
- 统一心法：JVM 参数只认"我这个进程的 cgroup 上限"，无论这上限由 docker -m 还是 K8s limits 设定（说明：所以同一镜像两侧都能跑，关键是感知生效 + 留堆外余量）。
