# CPU/alloc/lock 与 Wall 模式采样

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：能按"要回答什么问题"选对 async-profiler 的采样事件，而不是只会默认 CPU 模式。async-profiler 用 `-e` 切换事件：`cpu`（默认，基于 perf_events/itimer 采"在 CPU 上跑"的栈，找计算热点）、`alloc`（追踪对象分配，定位"谁在疯狂 new、TLAB 溢出"，找 GC 压力来源）、`lock`（采偏向锁/重量级锁的等待，找锁竞争与同步瓶颈）、`itimer`（无 perf_events 权限时的兜底时钟模式）。**Wall（wall-clock）模式**按真实墙上时间采样，把"阻塞、IO、sleep、等锁"这些不占 CPU 的时间也算进来——这是它和 cpu 模式的本质差异：cpu 模式看不见"在等"的耗时，wall 能看见等待，专治"CPU 不高但接口很慢"（下游 IO、锁等待、线程池排队）。要点：cpu 火焰图找的是"算得多的地方"，wall 火焰图找的是"等得久的地方"，两者结论可能完全不同；alloc 图看分配量而非耗时，别当 CPU 热点读；容器里常无 perf 权限需退 itimer。识破"接口慢只采 cpu 图看不到 IO 等待""用 alloc 图去找 CPU 热点""lock 事件在小样本下噪声大就下结论"等坑。

## 一、按问题选事件：cpu / alloc / lock

```bash
# 目的：不同瓶颈要换不同采样事件, 选错事件等于问错问题
./asprof -e cpu  -d 30 -f cpu.html  $PID   # 说明：找计算热点(在 CPU 上跑的栈), 默认事件
./asprof -e alloc -d 30 -f alloc.html $PID # 说明：追踪对象分配, 定位疯狂 new / TLAB 溢出-> 找 GC 压力源
./asprof -e lock -d 30 -f lock.html $PID   # 结果：采锁等待, 定位 synchronized/偏向锁升级的竞争点
# 反例：只想找接口慢的原因却只采 cpu ❌ 若慢在 IO/锁等待, cpu 图几乎空白, 应改用 wall
```

## 二、cpu 模式 vs Wall 模式：算得多 ≠ 等得久

```text
图目的：cpu 与 wall 两种采样对"耗时"的可见范围差异
cpu  : 只在"线程占用 CPU"时采样 —— 看得见计算热点, 看不见 阻塞/IO/sleep/等锁 的时间
wall : 按真实墙上时间周期性采所有线程栈 —— 看得见 等待(IO/锁/排队/sleep), 专治"CPU 不高但很慢"
判读 : 计算型瓶颈看 cpu 图宽帧; 延迟型(下游慢、锁等)瓶颈看 wall 图宽帧
容器 : 无 perf_events 权限时 cpu 需退化为 itimer 时钟模式, 精度略降但可用
```

## 三、wall 模式抓"等待"

```bash
# 目的：CPU 不高但接口 P99 很高时, 用 wall 把 IO/锁等待的耗时暴露出来
./asprof -e wall -t -d 30 -f wall.html $PID   # 说明：-e wall 采真实时间, -t 分线程便于看线程池排队
# 结果：wall 图里最宽的往往是 socketRead/等锁/线程池 take, 指向下游 IO 或锁而非本地计算
# 反例：把 alloc 事件图当 CPU 热点读 ❌ alloc 宽帧代表"分配量大"不代表"占 CPU 久", 语义不同 ❌ 应按事件选图
```

## 四、坑与底线

- **先定"问什么问题"再选事件**：算得多→cpu，分配多→alloc，锁竞争→lock，等得久→wall；一张图只回答一类问题，别混着解读。
- **接口慢先考虑 wall**：CPU 使用率不高但延迟高，几乎一定是 IO/锁/排队在等，cpu 模式看不见，应切 wall 再看线程维度。
- **小样本别下结论**：lock/alloc 在采样时长或频次不足时噪声大，需拉长窗口或多采几次，稳定出现的宽帧才可信。

## 五、关联课程

火焰图横纵轴含义、宽帧/塔形怎么读见 [火焰图怎么看与常见瓶颈](../s1/S1-1-Lesson.md)；安全点采样偏差对 cpu 事件的影响与低开销采样实践见 [安全点采样偏差与线上低开销实践](../s1/S1-3-Lesson.md)；在 Arthas 里用 profiler 命令联动 dashboard/vmtool 做整体诊断见 [火焰图、JVM 仪表盘与诊断联动（关联）](../../arthas/s1/S1-3-Lesson.md)；锁竞争排查可对照线程池与阻塞队列的等待来源。
