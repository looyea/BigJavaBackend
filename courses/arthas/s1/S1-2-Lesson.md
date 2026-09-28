# 热更新、反编译与线上排查

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：会用 jad/sc/mc/retransform 完成"看线上真实字节码—改逻辑热止血"的闭环并清楚其红线边界；能用 thread 命令族把 CPU 飙高、死锁、线程池耗尽三类经典事故在 Arthas 里走完定位路径。

## 一、jad / sc / mc：先看清楚"线上跑的到底是什么"

排查版本漂移的第一步是放弃"我以为的代码"，直视**运行时真正加载的字节码**：

```shell
# 目的：反编译内存中生效的类（不是磁盘 jar），终结"到底部署了哪个版本"的扯皮
jad --source-only com.bigjava.order.OrderService > /tmp/OrderService.java
# 说明：sc -d 先确认要反编译的是哪个 classLoaderHash 加载的版本（多加载器并存时必须指定）
sc -d com.bigjava.order.OrderService | grep -E 'classLoaderHash|code-source'
# 反例：不指定加载器直接 jad，多版本共存时反编译出"另一份"，据此改代码越改越错
# 结果：拿到与运行时一致的源码底稿，作为热修复的编辑基线
```

改完的 `.java` 用 `mc /tmp/OrderService.java -d /tmp` 以**目标类的类路径**现场编译出 `.class`——mc 的意义就在于复用应用自身的依赖与类加载器，javac 裸编译在内嵌类/私有依赖上大概率失败。

## 二、retransform：热止血的能与不能

```shell
# 目的：把新编的 class 替换回运行中的类，立即生效，不重启
retransform --classLoaderHash 2c99961c /tmp/OrderService.class
# 说明：多个同名类被不同加载器使用时必须指定 hash，否则替换错对象；retransform -l 列清单、-d 删除某次替换
# 结果：`retransform success, size: 1, classes: ...`，新逻辑对后续调用即时生效
```

红线边界（面试必考）：retransform 基于 JVM Redefinition 能力，**只能改方法体**——不能增删字段/方法、不能改类继承关系、不能改注解与签名；改了静态初始化也未必按预期重跑。所以它是"发布通道阻塞时的止血钳"，不是部署方式：热修内容必须走事后补发与审计，否则配置中心一重启，线上跑的就是没人认账的代码。加字段、换依赖、改接口签名，老老实实发版。

## 三、线程三连：CPU 高、死锁、池耗尽

```text
图目的：三类线程事故在 Arthas 中的最短判定路径
CPU 飙高    → thread -n 3 直接列出最忙三个线程及栈（省掉 top -H 换算 16 进制 nid 的手艺活）
死锁        → thread -b 一步找出互相持锁的线程对，打印各自持有什么、等谁
池耗尽/堵    → thread --state WAITING|BLOCKED 统计分布，配合上一节 trace 看谁把池占住了
❌ 反例：CPU 高先无脑 jstack 十几份慢慢翻——thread -n 3 十秒给出嫌疑人，jstack 留档做证据即可
```

典型链条：`thread -n 3` 抓到热点线程栈顶是正则回溯/超大 String.split → 上节 trace/watch 确认数据形态 → 修不动就 retransform 止血；栈顶是 `Unsafe.park` 且在等业务锁 → `thread -b` 或看锁对象；大量 `WAITING on condition` 集中在连接池获取 → 是下游慢传导，不是线程问题本身。机器层证据（哪类资源打满）先按 [进程/内存/CPU/IO 四件套与 Top/vmstat](../../linux-shell/s1/S1-1-Lesson.md) 分流，Arthas 只负责 JVM 内部这一层。

## 四、收尾与留痕纪律

`retransform -l` 确认现场还挂着几份替换、事故闭环后是否已由正式发布覆盖；`stop` 复位全部增强（增强与热修一并还原——**先确认新代码已进发布列车再 stop**）；jad/mc/retransform 的每一步输出存档进事故单。热修的完整生命周期是：取证 → 止血 → 补发 → 验证 stop 后行为一致，缺一环都算事故没关闭。

## 五、关联课程

方法级慢调用下钻在 [方法级观测与调用链耗时](S1-1-Lesson.md)；thread -n 找到热点方法后要全局证据，用 [火焰图怎么看与常见瓶颈](../../async-profiler/s1/S1-1-Lesson.md)（Arthas 内置的 profiler 命令即封装它）；把"演练注入的故障"与"热修止血预案"结合的验证方式见 [实验设计与 K8s 故障类型](../../chaos/s1/S1-1-Lesson.md)；压测中复现线程池问题的负载环境在 [并发模型、思考时间与 TPS/RT 解读](../../jmeter/s1/S1-2-Lesson.md)。
