# 进程/内存/CPU/IO 四件套与 Top/vmstat

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能用 top/vmstat/pidstat/iostat 四条命令定位"机器慢"属于 CPU、内存、IO 还是负载问题，读得懂 %wa/%st/Load/RSS/cache 等关键指标，并建立一套排障肌肉记忆的顺序。

## 一、先分类再定位：USE 方法

一台"变慢"的 Linux 机器，资源瓶颈只可能是 CPU、内存、磁盘 IO、网络四类。USE 法对每类问三个问题：**Utilization 使用率 / Saturation 饱和度 / Errors 错误**。本节覆盖前三类（网络在下一节），标准动作顺序是：

```text
图目的：Linux 资源排障的最小闭环命令序列——从上到下逐层缩小怀疑面
uptime / dmesg -T        # 先看整体负载与内核报错（目的：10秒定性）
top -1                    # 看是 %us(用户) / %sy(内核) / %wa(IO等) / %st(被宿主机偷) 哪种
vmstat 1                  # 看 r(运行队列)/b(阻塞)/si,so(换页)/cs(上下文) 的持续趋势
iostat -x 1               # 定位到 IO 后看 %util、await、avgqu-sz
pidstat -d 1 / -u 1       # 最后落到"是哪个进程"
```

## 二、CPU：不止看使用率

`top` 里几个关键列的含义与判断：

- `%Cpu(s): us sy ni id wa st`：**wa 高**=在等磁盘/网络 IO（多半不是 CPU 瓶颈）；**sy 高**=系统调用/上下文切换/中断异常多；**st 高**=虚拟机被宿主机超卖偷走时间（云环境常见，找运维不是找代码）；**us 高**=才真是应用计算重。
- Load average（`uptime` 的 1/5/15 min）：**load 要除以核数**才是饱和度。8 核 load=8 是满载，load=30 意味着大量任务在排队（可能是 IO 阻塞的 D 状态进程，而非 CPU 不够）。
- 上下文切换：`vmstat` 的 `cs` 列飙升 + `sy` 高，常见于线程过多、锁竞争、频繁系统调用——Java 场景可用 `pidstat -w` 看具体进程自愿/非自愿切换。

## 三、内存：cache 不是_used_

读 `free -h` 最容易犯的错是把 `buff/cache` 当成占用：

```bash
# 目的：正确判断"内存到底够不够"，而不是被 free 的可用列误导
free -h
#   total  used  free  buff/cache  available
# Linux 会把空闲内存拿去做页缓存，available 才是"可立即给新进程用"的真实余量
# 错误读法：看到 cache 占 20G 就以为内存耗尽 → 结果：盲目扩容或乱 drop_caches
echo 3 > /proc/sys/vm/drop_caches   # 反例：生产随意清缓存会让 IO 短时暴涨，别当日常操作

# 关键看这两处：
vmstat 1          # si/so 持续非零 = 正在换页(swapping)，内存真的不够
dmesg -T | grep -i "out of memory"   # OOM Killer 杀了谁：定位被回收的进程
```

Java 进程还要区分 **RSS（常驻物理内存）** 与堆大小：`top` 的 RES 列 > -Xmx 通常正常（含元空间、堆外、线程栈），真正泄漏看 RSS 持续单调增长 + GC 后不回落。

## 四、磁盘 IO：iostat 三件套

`iostat -x 1` 里判断磁盘是否瓶颈，主要看三个：

| 指标 | 含义 | 危险信号 |
|------|------|---------|
| `%util` | 设备有活干的时间占比 | 接近 100% 且非 NVMe（NVMe 并行使 %util 失真） |
| `await` | 平均 IO 响应时间(ms) | 显著高于设备本身延迟（SSD 应 <1ms，云盘看基准） |
| `avgqu-sz` | 平均队列深度 | 持续 >1 说明请求在排队（饱和度） |

**反例**：`%util=99%` 就断言磁盘满负荷——对多队列的 NVMe/云盘，util 会轻松到 100% 而其实远未到能力上限，必须结合 `await` 与设备基准判断。

## 五、落到进程：别再只靠 top

```bash
# 目的：从"机器慢"精确到"哪个进程/哪块盘/哪个线程"
pidstat -u 1 5        # 结果：按进程看 CPU，%usr/%system/%iowait 分列，比 top 更聚焦
pidstat -d 1 5        # 按进程看读写 KB/s，揪出日志刷屏或全表扫描的元凶
iotop -oP             # 只显示正在做 IO 的进程，定位 iostat 指认的高 await 设备是谁在用
# 错误做法：只看 top 第一列 %CPU 排序 → 异常表现：真正的 iowait 元凶 CPU 很低被排在后面
top -H -p <pid>       # 看线程级 CPU，Java 配合 printf '%x' 转十六进制去 jstack 找对应线程
```

## 六、关联技术

本节是"由外看进程"，进 Java 进程内部用 [Arthas 方法级观测](../../arthas/s1/S1-1-Lesson.md) 与 [Async-Profiler 火焰图](../../async-profiler/s1/S1-1-Lesson.md)；网络与磁盘日志定位脚本在下一节 [网络、磁盘与日志定位脚本](S1-2-Lesson.md)；容器里 `top` 读数受 cgroup 限制要在 K8s 语境重看 [Kubernetes 可观测](../../kubernetes/s1/S1-1-Lesson.md)。
