# 进程/内存/CPU/IO 四件套与 Top/vmstat · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. top 中 `%wa`（iowait）持续偏高，最可能的瓶颈是？（6分）

- A. CPU 算力不足
- B. 进程在等待磁盘/网络 IO 完成
- C. 内存不足在换页
- D. 上下文切换过多
> 答案：B
> 解析：iowait 是 CPU 空闲且有未完成块 IO 的时间占比，指向 IO 瓶颈而非 CPU；应转向 iostat 排查。

### 2. `st`（steal）列很高，说明？（6分）

- A. 内核态消耗大
- B. 虚拟机被宿主机超卖、CPU 时间被其它 VM 抢占
- C. 用户进程太忙
- D. nice 优先级进程占用
> 答案：B
> 解析：steal 只在虚拟化环境出现，是容量问题要找基础设施方，改应用代码无济于事。

### 3. 8 核机器 load average=16，合理判断是？（6分）

- A. 完全健康
- B. 运行队列饱和（约 2 倍核数在排队），可能 CPU 不足或大量 D 状态 IO 阻塞
- C. 内存不足
- D. 磁盘坏了
> 答案：B
> 解析：load 要除以核数看饱和度；16/8=2 明显排队，需进一步区分是 CPU-bound 还是 iowait 导致的不可中断进程堆积。

### 4. `free -h` 中 buff/cache 占用很大，正确理解是？（6分）

- A. 内存快耗尽需扩容
- B. 页缓存可被回收，应看 available 列判断真实可用
- C. 发生了内存泄漏
- D. swap 在用
> 答案：B
> 解析：Linux 用空闲内存做缓存加速 IO，available 才是可立即分配的量；把 cache 当 used 是经典误读。

### 5. 判断系统"正在换页（内存真不够）"最直接的数据来自？（6分）

- A. `top` 的 VIRT 列
- B. `vmstat 1` 的 si/so 持续非零
- C. `free` 的 total
- D. `ps` 的 RSS
> 答案：B
> 解析：si（swap in）/so（swap out）持续非零才是真在换页，伴随可用内存告急；VIRT 含映射不代表实际占用。

### 6. 对 NVMe/云盘，仅凭 `iostat` 的 `%util≈100%` 判断磁盘瓶颈为什么不充分？（6分）

- A. %util 单位错误
- B. 多队列并行设备 %util 会失真，需结合 await 与队列深度及设备基准
- C. NVMe 没有 await
- D. util 只对网络有效
> 答案：B
> 解析：%util 假设设备串行，对高并发块设备不再可靠；await 明显超基准 + avgqu-sz 高才是真饱和。

### 7. 已用 iostat 指认某进程读写异常，下一步最精准定位"哪个线程在烧 CPU"的命令组合是？（6分）

- A. `top` 直接看
- B. `top -H -p <pid>` 找高 CPU 线程，`printf '%x'` 转十六进制再去 jstack 匹配
- C. `free`
- D. `df -h`
> 答案：B
> 解析：线程级 top -H 拿到十进制 tid，转十六进制对应 Java 线程 nid，是 CPU 飙高定位到代码行的标准链路。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于 vmstat 各列，正确的有？（9分）

- A. `r` 是等待运行的进程数，长期超过核数说明 CPU 饱和
- B. `b` 是不可中断睡眠（多等 IO）的进程数
- C. `cs` 飙升配合 `sy` 高常指向线程/锁/系统调用风暴
- D. `id` 是正在做 IO 的时间占比
> 答案：ABC
> 解析：D 错——vmstat cpu 行的 `id` 是 CPU 空闲百分比，不是 IO 时间；ABC 描述正确。

### 9. （多选）以下哪些是"内存问题"而非"误报"的可靠证据？（多选）（9分）

- A. `dmesg` 出现 Out of memory: Kill process
- B. RSS 随时间单调增长且 GC 后不回落
- C. free 的 cache 很大但 available 充足
- D. si/so 持续非零
> 答案：ABD
> 解析：C 是正常页缓存不是问题；A 被 OOM Killer 杀、B 泄漏特征、D 真在换页，都是内存吃紧的实锤。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 一台跑 Spring Boot 的云主机报警"很卡"，请按顺序写出你的 Linux 侧排障动作、每步看什么指标、以及如何据结果分流到 CPU/内存/IO 三类结论。（40分）

> 参考答案：
- 要点1：定性——`uptime` 看 load/核数、`dmesg -T` 看 OOM/硬件报错，10 秒判断"排队严重度与是否有内核级异常"；
- 要点2：`top` 分类——%us 高走 CPU 应用线，%sy 高查上下文/中断，%wa 高转 IO 线，%st 高找基础设施；
- 要点3：`vmstat 1` 趋势——r 持续>核数=CPU 饱和；si/so≠0=内存换页；cs 暴涨=线程/锁；
- 要点4：IO 分支——`iostat -x 1` 看 await/avgqu-sz/%util 判设备饱和，`iotop -oP` 找进程；
- 要点5：内存分支——`free -h` 看 available 非 cache，RSS 增长 + GC 后不回落判泄漏，dmesg 确认 OOM；
- 要点6：落地到进程/线程——`pidstat -u/-d`、`top -H -p` + 转十六进制进 jstack，并说明"外部指标定位到哪类资源后再进 Arthas/火焰图看代码"。
