# OOM / CPU 飙高 / 频繁 Full GC 排查手册

> 本节难度：★★★★★
> 重要程度：★★★★★
> 学习产出：把前面所有 JVM 原理**收敛成一张可照着敲的命令排查表**。掌握"现象 → 分类 → 采样 → 定位 → 结论"的完整链路：**OOM 先看错误后缀定位是堆内还是堆外**；**CPU 飙高用 `top -Hp` 找线程号转 16 进制再到 `jstack` 里定位栈**；**频繁 Full GC 用 `jstat -gcutil` + GC 日志 + dump 三连**。会用 `jps/jstat/jmap/jstack/jcmd` 与 **Arthas**（`dashboard/thread -n/heapdump/profiler`）联动，并知道每个命令的**代价与禁忌**（`jmap -histo:live` 会触发 Full GC、生产大堆 `jmap -dump` 会长时间 STW）。电商大促抖动、金融网关 CPU 打满、电力设备频繁 Full GC，都按这套路径出结论。

## 一、通用三板斧：先定位进程，再分类现象

任何 JVM 线上问题，第一步都是**拿到 pid、判断现象类别**，别一上来就 dump。

```bash
# 例子目的：现场取证的标准命令链——从找进程到抓线程栈与堆趋势
jps -l                          # 列出所有 Java 进程 pid + 主类名（正确：先确认到底要排哪个进程；错误：把 JVM 自身的 JPS/GC 日志同名进程搞混，抓错对象）
top -Hp <pid>                   # 看该进程内"每个线程"的 CPU（正确：定位到吃 CPU 的 TID，十进制；错误：只看整核 top，被 GC/JIT 线程和真正的应用热点线程混淆）
printf "%x\n" <TID>             # 把线程号转 16 进制（正确：jstack 里线程名是 nid=0x<hex>，必须转；错误：拿十进制去 jstack 里 grep，永远找不到）
jstack <pid> > jstack.log       # 抓线程栈（正确：CPU 高/疑似死锁先抓；错误：对已经卡死的进程反复抓却不同时抓多份做对比）
jstat -gcutil <pid> 1000 10     # 每 1 秒打印一次各代占比与 GC 次数，共 10 次（正确：看 O 老年代是否只涨不落、FGC 是否狂增、FGCT 累计耗时；错误：采样太少下结论）
jcmd <pid> GC.heap_info         # 堆分区概况（正确：JDK 9+ 首选、比 jmap 轻；错误：沿用被移除的 jmap -heap 在部分版本失效）
# 正确使用结果：几秒钟内得到"哪个线程吃 CPU / 老年代是否持续爬升 / Full GC 频次"三条主线证据，再决定要不要 dump
```

## 二、OOM：先看错误后缀，再决定抓什么

`OutOfMemoryError` 后面那段**不是废话，它就是诊断地图**——不同类型根因、抓取手段完全不同：

| 错误后缀 | 大概率根因 | 首查手段 |
| --- | --- | --- |
| `Java heap space` | 堆内活对象超 `-Xmx`：泄漏 或 真的这么大 | heap dump + MAT（见 s3-2） |
| `GC overhead limit exceeded` | 98% 时间在 GC 却只回收 2%，堆濒满 | 同上，先确认 Full GC 后 Old 不降 |
| `Metaspace` | 类元数据膨胀：动态代理/字节码/CGLIB/热部署狂生成类 | `jcmd GC.class_stats`/`classloader -table`，限制 `MaxMetaspaceSize` |
| `unable to create new native thread` | 线程数爆（未池化、每请求起线程）或 OS `nproc`/`ulimit` 限制 | 数线程、看 `Xss`、查线程池配置（呼应 juc s2-1） |
| `Direct buffer memory` | 堆外 NIO/Netty buffer 超 `MaxDirectMemorySize` | **堆 dump 里看不到**！要查 `Bits.reserved`/Netty 池 |
| `Request 'java.lang.Thread...' ... Stack` / `StackOverflowError` | 递归过深 / 栈帧过大 | 看栈里重复帧（呼应 s1-1） |

```bash
# 例子目的：让"下次 OOM 自动留下堆转储"——现场取证最重要的一步，务必在启动参数里就配好
-XX:+HeapDumpOnOutOfMemoryError \         # OOM 时自动 dump 堆（正确：生产常开，开销可忽略；错误：不设→OOM 后进程已重启，现场全无，只能等下次复现）
-XX:HeapDumpPath=/data/dumps/heap.hprof \ # 落持久卷（错误：路径不存在/权限不足→想抓抓不到；容器临时层→Pod 重启即丢）
-XX:+ExitOnOutOfMemoryError               # OOM 后干净退出交给编排重启（正确：避免半死不活状态持续对外服务；错误：与 HeapDumpOnOOM 组合时先 dump 再退，别写成只退不 dump）
```

> **口诀**：`heap space`/`Metaspace`/`Direct buffer` 是三大高频后缀，**分别对应堆、类元数据、堆外**——先按后缀决定"抓堆 dump 还是查类加载/直接内存"，别一上来只盯着 `-Xmx` 加多大。

## 三、CPU 飙高：`top -Hp` → 16 进制 → `jstack` 定位

```flow
top 看整机 → top -Hp <pid> 看进程内线程 → 找到高 CPU 线程 TID(十进制)
     → printf "%x" TID 得 nid → jstack <pid> 里 grep "nid=0x<hex>" → 定位到具体栈帧
```

分三种情况给结论：

- **高 CPU 线程是应用线程栈**：栈里在算什么就是它——死循环、正则回溯、频繁序列化、加解密集合操作。抓 2~3 份 `jstack` 对比，栈帧不变即"钉死"在热点。
- **高 CPU 线程名是 `GC threads`/`VM Thread`/`C2 CompilerThread`**：说明不是业务代码而是 **GC 在疯狂回收（→ 转 四、频繁 Full GC）** 或 JIT 编译风暴（刚启动/大量匿名类）。
- **`JVM 线程很多但都低占用`**：可能是上下文切换/锁竞争，用 Arthas `thread -b` 直接找**阻塞死锁**。

## 四、频繁 Full GC：`jstat` + GC 日志 + dump 三连

```bash
# 例子目的：判断"Full GC 到底是不是泄漏"的最小证据链
jstat -gcutil <pid> 1000 10   # 关注 O(老年代%)、FGC(Full GC 次数)、FGCT(Full GC 累计耗时)（正确：O 每次 Full GC 后几乎不降 → 泄漏；O 降下去又慢慢爬 → 分配/晋升太快）
# Arthas 版：不改启动参数、线上直接看趋势与对象分布
heapdump --live /tmp/heap.hprof   # 抓堆转储（正确：--live 只 dump 存活对象、文件更小；错误：不加 --live 大堆 dump 巨慢且文件爆炸；两者都会 STW，生产要先评估、优先错峰或摘流量）
profiler start --event cpu        # Arthas 内置 async-profiler 火焰图定位 CPU 热点（正确：非阻塞采样，适合线上找热点方法；错误：把采样时长开太久拖慢节点）
profiler stop --format html --file /tmp/flame.html   # 停止并出 HTML 火焰图，直观看哪个方法栈占比最宽
# 正确使用结果：30 秒内确定"Full GC 后 Old 不降=泄漏 / Old 下降但很快又满=分配过快"，并拿到可分析的证据文件
```

**决策路径**（与 s2-3 决策树一致，这里给命令落点）：

- Full GC 后 Old **不降** → 泄漏 → heap dump + MAT（转 s3-2）。
- Full GC 后 Old **下降但很快又满** → 分配/晋升太快 → 火焰图 + `jstack` 找高频分配点，治代码/加 Young。
- GC 日志看到 **`to-space exhausted`（G1）/ `concurrent mode failure`（旧 CMS）** → 回收赶不上晋升 → 加大堆或调 IHOP/换收集器。
- Full GC 由 **`System.gc()`** 触发 → `jstack` 找调用栈，确认是否有人显式调用或 RMI 定时触发，再决定 `DisableExplicitGC`（注意它可能影响堆外释放，见 s1-1）。

## 五、Arthas：不重启、不改参数的线上诊断利器

| 命令 | 用途 | 注意 |
| --- | --- | --- |
| `dashboard` | 一屏看线程/内存/GC | 只读、安全 |
| `thread -n 5` | 最忙的 5 个线程栈 | 定位 CPU 高比手动 top+jstack 更快 |
| `thread -b` | 直接找出**阻塞/死锁**的持锁线程 | 锁竞争首选 |
| `heapdump [--live] f.hprof` | 抓堆转储 | 会 STW，大堆慎用/摘流量后 |
| `profiler start/stop` | async-profiler 火焰图 | CPU/alloc 热点 |
| `jad/sc/retransform` | 反编译/热更新 | 呼应 arthas 包 s1-2，改字节码要极度谨慎 |

## 六、动手题

1. 写一个死循环空转程序，用 `top -Hp`→`printf %x`→`jstack` 三步定位到那行循环。
2. 造一个 `static List` 无界增长的 OOM 程序，配 `-XX:+HeapDumpOnOutOfMemoryError`，跑出 heap space OOM 并用 `jstat -gcutil` 观察 O 只涨不落。
3. 用 Arthas `thread -n`、`thread -b` 分别抓一个 CPU 打满和一个死锁的现场，对比 `jstack` 手搓流程的差异。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| CPU 100% 但业务没死循环 | 大概率是 **GC 线程**在疯狂回收 → 转"频繁 Full GC"排查 |
| OOM 后重启就"好了"、几天又复现 | 慢泄漏没定位，重启只是清空堆 → 必须 dump + MAT |
| `jmap -histo:live` 一跑服务就卡 | 它**触发 Full GC** 后才统计，生产大堆代价极高 |
| 加了 `-XX:+DisableExplicitGC` 后堆外 OOM | 某些库靠 `System.gc()` 触发堆外 buffer 回收，禁用后积压（见 s1-1） |
| 频繁抓 jstack 却看不出问题 | 只抓一份；应**间隔抓多份对比**，栈帧长期不变才说明"钉死" |

## 八、关联技术栈

- **向前**：运行时数据区/直接内存 ↔ s1-1；类加载与 Metaspace ↔ s1-2；GC 算法与收集器选型 ↔ s2-1/s2-2；调优方法论 ↔ s2-3
- **后续**：堆转储 MAT 深度分析 ↔ s3-2
- **工具**：Arthas 方法级观测与热更新 ↔ arthas 包；线程池打满 `unable to create native thread` ↔ juc s2-1
- **框架/运维**：容器内存与探针重启 ↔ 构建运维；慢调用链路定位 ↔ 可观测

## 九、本节小结

线上 JVM 排障是一条固定链路：**`jps` 定位进程 → 按 OOM 后缀/`top -Hp`+`jstack`/`jstat -gcutil` 给现象分类 → 用最小代价取证（多份 jstack、GC 日志、必要时 heap dump/火焰图）→ 出结论**。三大铁律：**① `HeapDumpOnOutOfMemoryError` 必须在启动参数里提前配好；② `jmap -histo:live`/`jmap dump` 有 STW 代价、生产先摘流量；③ Full GC 后 Old 不降 = 泄漏、交给 s3-2 的 MAT。** Arthas 让"不重启、不改参数"就能看线程/堆/火焰图，是这套流程的加速器。下一节堆转储分析——把 dump 文件变成"谁泄漏了多少"的定论。
