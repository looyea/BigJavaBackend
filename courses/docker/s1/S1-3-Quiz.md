# JVM 的容器资源感知 · 小测

### 1. 容器 limit=512m，老版本 JVM（无容器感知）默认堆按什么算？（6分）

- A. 容器 limit 的 1/4
- B. 宿主物理内存的 1/4
- C. 固定 256m
- D. 不分配堆

> 答案：B
> 解析：老 JVM 读宿主总内存，算出远超容器 limit 的堆（结果：一涨就撞 cgroup 被杀）。

### 2. 让 JVM 读取 cgroup limit 而非宿主内存的关键参数是？（6分）

- A. -Xmx
- B. -XX:+UseContainerSupport
- C. -XX:MaxPermSize
- D. -XX:+UseCGroupMemoryLimitForHeap（8u191 前旧参数）

> 答案：B
> 解析：8u191+/10+ 默认开启的正是 UseContainerSupport（D 是早期未合入默认时的临时开关）。

### 3. 生产推荐用 -XX:MaxRAMPercentage 而非固定 -Xmx 的理由是？（6分）

- A. 百分比更省内存
- B. 同一镜像在不同 limit 规格下堆自动适配，无需每档改参数
- C. -Xmx 已废弃
- D. 百分比能提高 GC 效率

> 答案：B
> 解析：镜像一次构建多档部署，堆随容器 limit 弹性变化（结果：配置漂移减少）；A/C/D 均不实。

### 4. 堆设成接近容器 limit（如 90%）最可能的后果是？（6分）

- A. 完全没问题
- B. 堆外（元空间/线程栈/DirectBuffer/GC）一涨就 OOMKilled
- C. JVM 启动失败
- D. GC 变快

> 答案：B
> 解析：容器 limit 罩的是整个进程 RSS，堆只是一部分；不留堆外余量必被内核杀（异常表现：退出码 137）。

### 5. 容器里 Java 进程被 OOMKilled 时的典型退出码是？（6分）

- A. 0
- B. 1
- C. 137
- D. 143

> 答案：C
> 解析：137=128+9（SIGKILL），是 cgroup OOM；143=128+15（SIGTERM）是正常终止信号（错误预期：把 137 当成代码异常排查半天）。

### 6. 被 OOMKilled 时日志常常没有 OutOfMemoryError，原因是？（6分）

- A. 日志级别不够
- B. 进程被内核 SIGKILL，JVM 来不及抛任何异常
- C. JVM 吞掉了异常
- D. 日志没挂载

> 答案：B
> 解析：SIGKILL 不可捕获，直接终止（结果：靠 JVM 异常定位失效，要看 docker inspect 的 OOMKilled 字段）。

### 7. Netty/gRPC 应用在 1G 容器里堆设 800m 仍被杀，真凶多是？（6分）

- A. Metaspace
- B. 堆外 DirectByteBuffer 未被计入堆
- C. 类加载器泄漏
- D. GC 算法

> 答案：B
> 解析：NIO/Netty direct buffer 属堆外、不吃 -Xmx 但吃容器 RSS（治理：MaxDirectMemorySize 显式限 + 压低堆占比）。

### 8. 关于 JVM 的 CPU 容器感知，正确的有（多选）（9分）

- A. availableProcessors 决定 GC 线程与 ForkJoinPool 并行度
- B. 感知失效按宿主核数起线程，容器被限核时大量线程排队
- C. CPU limit 卡太紧会拖长 GC 停顿（STW）
- D. 加 CPU limit 一定能降低 P99 延迟

> 答案：ABC
> 解析：A/B 是线程数踩坑链；C 是限流对 GC 的副作用；D 错误——CPU limit 过小反而因 throttle 拉高延迟（异常表现与"变慢"难区分）。

### 9. 下列哪些属于 JVM 进程总内存（容器 limit 要罩住的）？（多选）（9分）

- A. 堆（Heap）
- B. 元空间（Metaspace）
- C. 线程栈与 Code Cache
- D. DirectByteBuffer 等堆外

> 答案：ABCD
> 解析：容器 limit 覆盖进程 RSS 全部：堆+元空间+线程栈+CodeCache+GC/JIT 结构+堆外，只算堆是 OOMKilled 的头号误判。

### 10. 简答题：服务在 K8s 里反复 CrashLoopBackOff，怀疑内存问题，请给出从 JVM 与容器两侧协同的完整排查与修复方案。（40分）

- 要点1：先定性——`kubectl describe pod` 看 Last State 是否 OOMKilled、退出码是否 137，区分"JVM 自己 OOM（有异常栈）"与"被内核杀（无栈）"（目的：两条完全不同的修复路线）。
- 要点2：查 limit 与堆配置：进容器 `java -XX:+PrintFlagsFinal -version | grep MaxHeapSize`，看实际堆是否远大于/接近 limit（异常用例：limit 512m、堆 4G=老 JVM 未开容器感知，先确认 UseContainerSupport 与镜像 Java 版本≥8u191）。
- 要点3：看全进程内存构成：jcmd/NMT 或 -XX:NativeMemoryTracking=summary 输出非堆占用，判断 Metaspace/线程数/DirectBuffer 是否失控（结果：堆外是常被漏掉的大头）。
- 要点4：修复内存策略：设 -XX:MaxRAMPercentage 留足堆外余量（如 50~60%），配 MaxDirectMemorySize/MaxMetaspaceSize 上限，加 +ExitOnOutOfMemoryError 让 JVM 在物理 OOM 前干净退出。
- 要点5：修复编排侧：K8s 的 requests 要接近真实用量、limits 给堆外留头寸（说明：limit=堆是经典错误），并配 readiness 避免流量打到启动中/即将被杀的实例（关联 kubernetes s1-3/s3-1）。
- 要点6：验收与防复发：压测下 RSS 峰值 ×1.2< limit，OOMKilled 计数为 0；把 JVM 参数纳入镜像/JVM 启动脚本模板评审，杜绝"-Xmx≈limit"写法再次流入生产。

> 答案：见要点
