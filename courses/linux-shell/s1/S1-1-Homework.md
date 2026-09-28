# 进程/内存/CPU/IO 四件套与 Top/vmstat · 作业

## 作业 1：制造四类瓶颈并观测（动手题）

**目标**：亲手造出 CPU、内存、IO、负载四类"病灶"，验证每条命令的信号。

**任务**（在测试机/容器，勿在生产）：
1. CPU：`stress-ng --cpu 4 --timeout 60s`，用 `top` 看 %us、`vmstat` 看 r 列；
2. IO：`fio --name=w --rw=randwrite --bs=4k --size=1G --iodepth=32` 压一块盘，`iostat -x 1` 记 await/avgqu-sz/%util，再解释 NVMe 上 %util 为何失真；
3. 内存：`stress-ng --vm 2 --vm-bytes 1G` 触发换页，`vmstat` 看 si/so、`dmesg -T` 找 OOM；
4. iowait 型高负载：`dd if=/dev/zero of=/tmp/f bs=1M count=2048 conv=fdatasync` 期间看 top 的 %wa 与 load，验证"load 高但 %us 不高"。

**验收标准**：四类各贴一张关键指标截图并写一句话结论；能说清"同样是 load 高，CPU-bound 与 IO-bound 在 top/vmstat 上的区别"。

**参考解法要点**：IO-bound 现象是 %wa 高 + b 列(阻塞)>0 + r 未必高；CPU-bound 是 %us/%sy 高 + r>核数。

## 作业 2：CPU 飙高定位到代码行（工程题）

背景：一个 Spring Boot 服务 CPU 常年 90%+。

**任务**：完整走一遍定位链路：`top` 找 pid → `top -H -p <pid>` 找最烧 CPU 线程 tid → `printf '%x\n' <tid>` 转十六进制 → `jstack <pid>` 里搜该 nid → 指出热点栈帧（如某死循环/正则回溯/序列化）。写一份"从 %CPU 到一行代码"的操作 SOP，并标注每步命令。

**验收标准**：SOP 可直接交接给新人执行；说明"如果最忙线程是 GC 线程而非业务线程，结论该怎么变"（转向内存/堆调优而非业务代码）；给出至少两条常见误判（被 %st、被 %wa 误导）。

## 作业 3：读数陷阱清单（分析题）

针对以下"错误结论"，各写一句纠正：① "free 里 cache 占 80% 内存，要扩容"；② "%util 到 100% 磁盘坏了"；③ "load=4 就是 CPU 不够"；④ "top 里 RES 比 -Xmx 大说明内存泄漏"。**验收标准**：每条给出正确判断依据（available / await+基准 / 除以核数 / RSS 含元空间堆外且要看增长趋势）。
