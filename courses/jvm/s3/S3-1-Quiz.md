# 小测验 · OOM / CPU 飙高 / 频繁 Full GC 排查手册

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. 服务器上某 Java 进程 CPU 飙高，定位到"具体是哪一行代码"的标准命令链是？（15分）

- A. `top` → `kill -9` 重启
- B. `top -Hp <pid>` 找线程 TID → `printf "%x" TID` → `jstack <pid>` 里按 `nid=0x<hex>` 找栈
- C. `jmap -dump` 直接看堆
- D. `netstat` 看连接

> 答案：B
> 解析：CPU 高要落到线程级。`top -Hp` 拿到十进制 TID，转 16 进制才能对上 `jstack` 里的 `nid=0x...`，从而定位栈帧。A 毁灭现场，C 是内存手段，D 无关。

### 2. `OutOfMemoryError: Direct buffer memory` 最需要的取证手段是？（15分）

- A. 抓堆 dump 用 MAT 看支配树
- B. 加大 `-Xmx`
- C. 查堆外直接内存用量（`Bits.reserved` / Netty 池），它不在堆 dump 里
- D. 调小 `-Xss`

> 答案：C
> 解析：直接内存在**堆外**，`-Xmx` 管不到、堆 dump 里也看不到（呼应 s1-1）。要查 `MaxDirectMemorySize`、NIO/Netty buffer 是否释放。A 只能查堆内，B/D 方向错误。

### 3. 【多选】关于排查命令的代价与用法，正确的有哪些？（20分）

- A. `jmap -histo:live` 会先触发一次 Full GC 再统计，生产大堆代价很高
- B. `-XX:+HeapDumpOnOutOfMemoryError` 建议生产常开，开销可忽略，OOM 时自动留证
- C. `jstat -gcutil` 采样几次即可下结论，无需看趋势
- D. Arthas `profiler`（async-profiler）以非阻塞采样出火焰图，适合线上找 CPU 热点

> 答案：ABD
> 解析：C 错——`jstat` 要看**多次采样的趋势**（O 是否只涨不落、FGC 是否持续增），单点无意义。A/B/D 均为正确的代价认知与用法。

### 4. 判断：只要出现频繁 Full GC，就一定说明存在内存泄漏。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：要看 **Full GC 后老年代占用是否下降**。不降才疑似泄漏；若大幅下降但很快又爬满，往往是分配/晋升太快（海量临时对象），应治代码而非认定泄漏。

### 5. 填空题：`OutOfMemoryError` 的三大高频后缀分别是 ______（堆内）、______（类元数据膨胀）、______（堆外 NIO/Netty）。（15分）

> 答案：Java heap space / Metaspace / Direct buffer memory

### 6. 线上某服务每隔几分钟就 Full GC、偶发超时。说出你的完整排查路径与每步要得到的证据。（25分）

> 参考答案：
> - `jps` 定位进程；`jstat -gcutil <pid> 1000 N` 看 O 老年代趋势与 FGC/FGCT，判断 Full GC 后 Old 降不降
> - 结合 GC 日志（`-Xlog:gc*`）看每次 Full GC 触发原因：System.gc()/元空间/晋升失败/to-space exhausted
> - Old 不降 → 疑似泄漏 → `jmap -dump` 或 Arthas `heapdump --live`（知 STW 代价、先摘流量）→ MAT 分析（s3-2）
> - Old 下降但快又满 → 分配过快 → `top -Hp`+`jstack` 或 Arthas `profiler` 火焰图找高频分配点，治代码/加大 Young
> - 全程确保启动参数已配 `HeapDumpOnOutOfMemoryError`、统一 GC 日志，证据可复现
