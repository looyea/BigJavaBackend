# 作业题 · OOM / CPU 飙高 / 频繁 Full GC 排查手册

> 作业不判分，做完对照参考答案自查。全部在 JDK 17 + Linux/WSL 上验证（Arthas 需能 attach）。

## 作业 1：CPU 飙高三步定位（必做）

写一个 `while(true){}` 空转线程 + 若干正常线程，启动后用 `top -Hp <pid>` 找到占用最高的 TID，`printf "%x"` 转 16 进制，再到 `jstack <pid>` 里按 `nid=0x<hex>` 定位到那行循环。

注释记录三步命令与输出，并说明"为什么必须转 16 进制"（jstack 用 nid 十六进制命名）。

## 作业 2：制造并取证一次 heap space OOM（必做）

写一个 `static List<byte[]>` 每次 `add(new byte[1<<20])` 从不清理的程序，配：

```
-Xmx128m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=./heap.hprof -Xlog:gc*:file=gc.log:time,uptime
```

跑出 `OutOfMemoryError: Java heap space`，观察：① 是否自动生成 heap.hprof；② `jstat -gcutil` 里 O 是否只涨不落、FGC 持续增。注释解释"重启就好但几天又复现"为何是慢泄漏典型特征。

## 作业 3：Direct buffer OOM 与堆 dump 的盲区（选做）

用 `ByteBuffer.allocateDirect` 在循环中分配、配 `-XX:MaxDirectMemorySize=32m` 触发 `Direct buffer memory` OOM。尝试用堆 dump/MAT 分析，验证"里面看不到这些堆外字节"。

注释说明这类 OOM 正确的取证方向（`Bits.reserved`、Netty 池、`MaxDirectMemorySize`）。

## 作业 4：Arthas 与 jstack 手搓流程对比（必做）

同一 CPU 打满进程，分别用：① `top -Hp`+`jstack`；② Arthas `thread -n 5`。再对一个死锁程序用 `thread -b` 直接找持锁线程。

注释对比两者效率与所需前置条件（Arthas 免重启免改参数、jstack 需手工换算）。

## 作业 5：频繁 Full GC 定性（选做）

用作业 2 的泄漏程序，用 `jstat -gcutil` 连续采样，判断"Full GC 后 Old 降不降"，据课程决策树给出"泄漏 vs 分配过快"的结论，并说明下一步该抓什么证据。

**参考答案要点**：Old 每次 Full GC 后几乎不降 → 判为泄漏 → 抓 heap dump 交 MAT（作业衔接 s3-2）。
