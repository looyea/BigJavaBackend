# 进程/内存/CPU/IO 四件套与 Top/vmstat · 面试题

## 题 1：服务器很慢，你的排查套路是什么？

- USE 法按 CPU/内存/IO/网络四类各看 使用率/饱和度/错误；动作序列：uptime+dmesg 定性 → top 分类（%us/%sy/%wa/%st）→ vmstat 看趋势（r/b/si,so/cs）→ iostat 定位磁盘 → pidstat/top -H 落到进程与线程。
- 强调"先分类再深挖"：不同 top CPU 列指向完全不同的下一步（wa→IO 线，st→基础设施，us→进 Arthas/火焰图看代码）。
- 加分：说清"定位到资源类别后才进 Java 内部"，外部指标和 JVM 工具是接力不是二选一。

## 题 2：load average 高一定意味着 CPU 不够吗？

- 不一定。load 含"运行 + 不可中断(D 状态)"任务，D 状态多是等 IO；所以 IO 打满也会把 load 抬高而 %us 很低。
- 判读：load 要除以核数看饱和度（8 核 load 8 满载），再回 top 看是 %us 高（CPU-bound，r 高）还是 %wa 高 + b 列>0（IO-bound）。
- 追问"1/5/15 怎么看"：三值趋势判断是突发还是持续，15 高 1 低=正在缓解，三者都高=持续过载。

## 题 3：free 内存看着不够了，要不要扩容？

- 先看 available 不看 free/cache：buff/cache 是可回收页缓存，available 充足就无需慌。
- 真信号：si/so 持续非零（在换页）、available 逼近 0、dmesg 出现 OOM Killer。
- Java 补充：RES 大于 -Xmx 正常（元空间/堆外/线程栈），泄漏判据是 RSS 单调涨且 GC 后不回落——别把正常常驻当泄漏。

## 题 4：iostat 里 %util=100% 是不是磁盘到极限了？

- 对老式单队列磁盘近似成立；对 NVMe/云盘（多队列并行）%util 失真，能轻松 100% 却远未到能力上限。
- 真判据：await 显著高于设备基准延迟（SSD 亚毫秒、云盘看 SLA）+ avgqu-sz 持续>1，说明请求在排队。
- 加分：进一步用 iotop -oP / pidstat -d 找是哪个进程（日志刷屏、全表扫描、GC swap 常是元凶）。

## 题 5：一个 Java 进程 CPU 100%，怎么定位到具体代码？

- `top -H -p <pid>` 找最高 CPU 线程的十进制 tid → `printf '%x' <tid>` → `jstack`/Arthas `thread <nid>` 匹配栈帧 → 定位死循环、正则回溯、频繁序列化、自旋锁。
- 若最忙线程是 GC 线程：结论转向堆/内存调优（G1 频繁 Mixed GC、Full GC）而非业务代码——先看 GC log。
- 加分：提 Arthas `thread -n 5`（最忙线程）、`profiler`/async-profiler 火焰图能直接给出热点方法占比，比手动 jstack 更全面。

## 题 6：容器里 top/vmstat 读数为什么"不对"？

- 容器共享宿主内核，`top` 看到的是宿主全量 CPU/内存而非 cgroup 配额，除非做了 lxcfs/cgroup-aware 包装。
- 正确姿势：看 cgroup 限制 `/sys/fs/cgroup/.../memory.limit_in_bytes`、K8s 侧 `kubectl top pod`、以及 JVM 需 `-XX:+UseContainerSupport` 感知 limit 设堆。
- 追问"CPU 被限流"：看 cgroup `cpu.stat` 的 nr_throttled/throttled_time——request/limit 配窄会导致周期性 throttle，表现为"没用满却卡"，这是纯宿主机视角看不到的坑。
