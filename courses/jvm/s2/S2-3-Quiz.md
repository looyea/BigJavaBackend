# 小测验 · 线上调优方法论

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. 关于"何时该调 GC"，最符合方法论的立场是？（15分）

- A. 上线前先把二十几个 `-XX:` 参数堆满，越全越好
- B. 默认 G1 起手，先立 SLA 与基线，多数问题优先改代码/加内存/治泄漏，单变量迭代验证
- C. 只要把 `-Xmx` 调到最大就不会有 GC 问题
- D. 调优只看平均停顿，不看 P99

> 答案：B
> 解析：方法论核心是"有目标、有基线、单变量、可回滚"，且九成 GC 表象问题根因在代码（泄漏/分配过高），不是靠堆参数解决。A/C/D 都是反模式。

### 2. JDK 9+ 开启 GC 与 safepoint 日志的正确参数是？（15分）

- A. `-XX:+PrintGCDetails -XX:+PrintGCDateStamps`
- B. `-Xlog:gc*,safepoint:file=gc.log:time,uptime,level,tags`
- C. `-XX:+LogGC -XX:GCLog_file=gc.log`
- D. `-verbose:gc -XX:+PrintGCTimeStamps`

> 答案：B
> 解析：JDK 9 起统一日志框架用 `-Xlog`。A/D 是 JDK 8 旧标志（新版被忽略或告警，格式还和 GCEasy/GCViewer 对不上），C 是杜撰参数会启动失败。

### 3. 【多选】容器化部署 JVM，下列哪些做法正确？（20分）

- A. 用 `-XX:MaxRAMPercentage` 让堆随容器规格伸缩，而非写死 `-Xmx`
- B. `-Xmx` 直接设成等于容器 memory limit，把内存全给堆
- C. 堆外要留余量：Metaspace、线程栈、直接内存、CodeCache、GC 结构都不在 `-Xmx` 内
- D. 容器 CPU limit 会影响 GC 并发线程数，limit 过小可能拖慢并发回收

> 答案：ACD
> 解析：B 错——`-Xmx` 顶满 limit 会让堆外内存无处可放，进程被 cgroup **OOMKilled**（JVM 自己不报 OutOfMemoryError）。A/C/D 均为容器 JVM 常见正确实践。

### 4. 判断：堆（`-Xmx`）设置越大，服务性能越好。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：堆过大→单次 Full GC 扫描/整理工作量越大、STW 越长、进程启动慢、内存成本高；还可能挤占容器限额触发 OOMKilled。堆大小应由分配/晋升速率做容量规划算出来，不是越大越好。

### 5. 填空题：容量规划主要测两个速率——______（Eden 增长 MB/s）与______（Old 增长 MB/min）；估算式 `Young GC 间隔 ≈ ______ / 分配速率`。（20分）

> 答案：分配速率 / 晋升速率（存活速率） / Eden 容量

### 6. 发现某服务频繁 Full GC，说出你的排查路径，并解释"Full GC 后老年代占用是否下降"分别指向哪类结论。（20分）

> 参考答案：
> - 看 GC 日志的 Full GC 触发原因：System.gc()/RMI、元空间达上限、晋升失败/to-space exhausted、Heap Dump 触发等，先分类
> - Full GC 后 Old 不下降：疑似内存泄漏或活对象确实这么多 → 落 HeapDump 用 MAT 支配树定位泄漏疑犯
> - Full GC 后 Old 大幅下降：不是泄漏，是分配/晋升太快 → 治代码（减少临时对象、给缓存设上限）、加大 Young、必要时换收集器
> - 全程用 `-XX:+HeapDumpOnOutOfMemoryError`、老年代占用趋势监控（只涨不落=泄漏）配合定位
