# JVM 的容器资源感知

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：理解 JVM 如何读取 cgroup 内存/CPU limit 来决定堆与线程数，掌握 MaxRAMPercentage 的正确用法，能定位并根治容器里 Java 进程被 OOMKilled 的经典事故。

## 一、事故原型：容器 limit 512m，JVM 却按宿主 16G 算堆

```bash
# JVM 默认堆 = 物理内存的 1/4（-XX:MaxRAMPercentage=25%）。老版本 JVM 看不到 cgroup limit，读的是宿主总内存
docker run -d --memory=512m shop-order:1.0
# 宿主 16G → JVM 把堆上限算成 4G，远超容器 512m → 一旦堆涨到 512m 触发 cgroup OOM Kill，退出码 137
# 异常表现：服务反复 CrashLoop，日志最后一条往往没有 OutOfMemoryError —— 因为是被内核 SIGKILL，不是 JVM 自己 OOM
```

## 二、翻版本：UseContainerSupport 让 JVM 认 cgroup

```bash
# Java 8u191+/10+ 默认开启容器感知，堆计算改用 cgroup limit 而非宿主内存
java -XX:+UseContainerSupport -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|ActiveProcessorCount'
# 结果：limit=512m 时 MaxHeapSize ≈ 512m×25% = 128m（仍可能太小，需下面显式设置）
# 说明：低于 8u191 的老 JVM 不认容器，必须升级或手动 -Xmx 钉死，别无脑交给默认比例
```

## 三、正确设堆：MaxRAMPercentage 而非固定 -Xmx

```bash
# 目的：让堆随容器 limit 弹性伸缩——同一镜像在 512m/1G/2G 规格下自动适配，无需为每档写死 -Xmx
java -XX:MaxRAMPercentage=60 -XX:InitialRAMPercentage=60 -jar /app.jar
# 60% 经验值：留 40% 给 元空间/线程栈/堆外/Netty direct buffer/GC 开销（JVM 内存 ≠ 堆）
# 反例一：-Xmx512m 但容器也 512m → 堆外一加就爆（堆只占容器一部分，容器 limit 覆盖全进程 RSS）
# 反例二：MaxRAMPercentage=90 → 几乎不留堆外余量，高峰期 metaspace/direct 一涨即 OOMKilled
```

## 四、非堆内存：容易被 OOMKilled 忽略的大头

```text
图目的：容器 limit 要罩住 JVM 全部内存，堆只是其中一块。
进程 RSS = 堆(Heap) + 元空间(Metaspace) + 线程栈(-Xss×线程数) + Code Cache + GC/JIT 结构 + 堆外(NIO/Netty DirectByteBuffer)
结果：Netty/gRPC 应用堆外可能占数百 MB，堆设到 limit 的 80% 几乎必被杀（示例：堆 800m 的 gRPC 服务在 1G 容器里被 OOMKilled，真凶是 direct buffer）。
```

```bash
# 治理组合：限堆 + 限堆外 + 让 JVM 在物理 OOM 前主动抛异常而非被 SIGKILL
java -XX:MaxRAMPercentage=50 \
     -XX:MaxDirectMemorySize=128m \
     -XX:+ExitOnOutOfMemoryError \
     -XX:MaxMetaspaceSize=256m -jar /app.jar
# 说明：ExitOnOutOfMemoryError 让容器"干净退出并被编排层重启"，优于僵持在半死状态（异常：OOM 后线程池损坏但进程不退出）
```

## 五、CPU 感知：GC 线程与 availableProcessors

```bash
java -XX:+UseContainerSupport -version 2>&1
nproc                                        # 容器内看到的核数（受 --cpus 影响的是 quota 不是 nproc）
# JVM 用 availableProcessors 决定 GC 线程/ForkJoinPool 并行度：默认取宿主核数会创建过多线程
# 结果：--cpus=1 但 nproc=16 → GC/线程池按 16 起，被 CGroup 限到 1 核时大量线程排队，throttle 剧增、GC 停顿变长
# 处理：显式 -XX:ActiveProcessorCount=1（老 JVM），或升级让容器 CPU quota 正确折算
```

- 关键取舍：CPU limit 卡太紧会让 GC 线程被限流反而拖长 STW——高并发低延迟服务慎用极小 CPU limit（说明：这也是 s1-1 里"CPU 是限流不是杀死"在 Java 上的具体代价）。

## 六、关联技术

- CGroup 内存/CPU 语义见 s1-1；ENTRYPOINT exec 形式让 java 成 PID 1 才能收到 SIGTERM 见 s1-2/s2-3。
- K8s 里 request/limit 与探针如何和这套 JVM 参数配合，见 kubernetes s1-3、s3-1（OOMKilled 与驱逐的编排视角）。
