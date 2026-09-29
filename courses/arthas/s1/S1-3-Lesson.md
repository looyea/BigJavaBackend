# 火焰图、JVM 仪表盘与诊断联动（关联）

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能把 Arthas 从"单点看一个方法"升级到"全局体检 + 热点定位 + 内存诊断"的联动排查。**dashboard** 一屏给线程/内存/GC/CPU 总览，先判断问题域（是 CPU 高、GC 频繁还是线程阻塞）；**jvm / memory / thread** 分别下钻运行时参数、堆区占用、最忙线程栈；**profiler** 命令内置 async-profiler，在线低开销产出 CPU/alloc/lock 火焰图，宽帧即热点，替代"装 agent + 重启"的重排查；**vmtool / heapdump / ognl** 处理内存侧——按类实例直方图、找引用链、必要时 dump 堆给 MAT 分析。诊断"联动"的关键是把三者串成一条链：dashboard 发现某线程池 CPU 高 → thread 定位到具体栈 → profiler 火焰图确认热点函数 → 若怀疑对象堆积用 vmtool 看实例数、heapdump 找泄漏根。要点：profiler 要 start/stop 成对、低占空比，别常驻高频导出；heapdump 会 STW、生产慎用且导到隔离机分析。识破"火焰图把 JIT 编译栈当业务热点""不看 dashboard 直接 dump 全量堆导致长时间 STW""vmtool 强转实例改了线上状态"等坑。

## 一、dashboard 全局体检，先定问题域

```bash
# 目的：不改代码在线诊断, 先看全局再下钻, 避免一上来就 dump 堆
dashboard                       # 说明：线程/内存/GC/CPU 一屏总览, 判断问题属于哪一类
jvm                             # 说明：看运行时参数、GC 收集器、启动类路径, 核对配置是否符合预期
thread -n 3                     # 结果：列出最忙 3 个线程的栈, 快速抓 CPU 飙高的元凶
# 反例：不看 dashboard 直接 heapdump 全量堆 ❌ 触发长时间 STW 拖垮线上, 应先定域再针对性诊断
```

## 二、profiler：在线产火焰图定位热点

```bash
# 目的：内置 async-profiler, 低开销产出 CPU/alloc/lock 火焰图, 宽帧即热点
profiler start --event cpu      # 说明：默认 cpu 事件, 也可 alloc 看分配、lock 看锁竞争
# ...让被怀疑的接口跑一段(建议 10~30s 短窗口)...
profiler stop --file /tmp/flame.html  # 结果：产出火焰图, 定位自旋/序列化/正则等热点函数
profiler status                 # 说明：确认是否仍在采样, 防止 start 后忘记 stop 常驻开销
# 反例：start 后不 stop 且高频导出 ❌ 采样+落盘开销叠加拖慢线上, 必须成对且低占空比
```

## 三、内存侧联动：vmtool / heapdump

```text
图目的：从"发现问题"到"定位根因"的诊断链路及各命令分工
dashboard(定域) → thread(定位线程栈) → profiler(火焰图确认热点函数)
若对象堆积: vmtool getInstances 看某类实例数/直方图 → 找可疑集合
确需全量分析: heapdump 导堆给 MAT 看引用链(会 STW, 生产慎用、导到隔离机)
关键: arthas 的 profiler 与独立 async-profiler 同引擎, 结论可互相印证
```

## 四、坑与底线

- **profiler start/stop 必须成对**：用短窗口、低占空比采样，`profiler status` 收尾确认已停，别把诊断开销变成长期负担。
- **heapdump 是有 STW 的重操作**：生产优先用 dashboard/vmtool 轻量定位，确需 dump 再择机、导到隔离环境用 MAT 分析，避免在业务机上翻找大文件。
- **火焰图要结合 safe-point 语义读**：JVM 栈里的 JIT/编译帧、内核帧不是业务热点，联动 async-profiler 的原理小节剔除采样偏差后再下结论。

## 五、关联课程

火焰图怎么读、宽帧/塔形代表什么见 [火焰图怎么看与常见瓶颈](../../async-profiler/s1/S1-1-Lesson.md)；采样事件 cpu/alloc/lock 与 Wall 模式的差异见 [CPU/alloc/lock 与 Wall 模式采样](../../async-profiler/s1/S1-2-Lesson.md)；安全点导致的采样偏差与低开销实践见 [安全点采样偏差与线上低开销实践](../../async-profiler/s1/S1-3-Lesson.md)；先用 trace/watch 做方法级耗时定位的基础承接 [方法级观测与调用链耗时](../s1/S1-1-Lesson.md)；反编译与热更新在定位后如何临时验证见 [热更新、反编译与线上排查](../s1/S1-2-Lesson.md)。
