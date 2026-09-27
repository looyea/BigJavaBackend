# 线程池七参数与执行流程 · 作业

> 不判分，对照参考要点自查。

## 作业 1：执行流程可视化（必做）

配 `core=2, max=4, 队列=new ArrayBlockingQueue<>(3)`，自定义 ThreadFactory 打印线程名，连续提交 12 个各 sleep 2s 的任务。根据日志标注：哪几个建核心、哪几个排队、哪几个扩非核心、哪几个被拒绝。

**参考要点**：1-2 核心；3-5 入队（队列容量3）；6-7 扩非核心到 max=4；8 起队列满且达 max → 拒绝。验证"核心→队列→最大→拒绝"。

## 作业 2：Executors OOM 复现（必做）

用 `Executors.newFixedThreadPool(2)` 疯狂提交大任务但不消费，观察 `LinkedBlockingQueue` 无限堆积直至内存涨；改手动 `new ThreadPoolExecutor(2, 2, 0, MS, new ArrayBlockingQueue<>(100), new ThreadPoolExecutor.CallerRunsPolicy())` 对比。

**参考要点**：无界队列 + 有限消费 → 队列膨胀 OOM；有界 + 拒绝策略把压力显性化/回压，可控。

## 作业 3：拒绝策略选型（必做）

为三类任务各选拒绝策略并说明：① 支付对账（绝不能丢）；② 用户行为埋点（可丢但要计数）；③ 实时行情快照（只要最新）。

**参考要点**：①自定义 handler 落库/MQ 兜底 + 告警，绝不 Discard；②CallerRuns 或 Discard 但记数，容忍丢；③DiscardOldestPolicy 丢旧留新。

## 作业 4：线程数估算与压测（选做）

给定"每任务 80% 时间在等 DB IO、20% 在算"、机器 8 核，估算 IO 密集初始线程数，再用线程池监控（activeCount/queueSize/completedTaskCount）压测调优，说明最终值怎么来。

**参考要点**：≈ 核数×(1+等待/计算)=8×(1+4)=40 起点；靠压测看队列是否堆积、CPU 是否打满、下游是否过载收敛；线程多≠快（受 DB 连接池约束）。

## 作业 5：submit 异常去哪了（必做）

`executor.submit(() -> { throw new RuntimeException("x"); })` 不抛到主线程；对比 `execute` 直接抛。说明 submit 把异常封进 Future，只有 `get()` 才以 `ExecutionException` 暴露，给出统一异常处理做法。

**参考要点**：submit→FutureTask 捕获异常存起来；execute 未捕获会走线程 UncaughtExceptionHandler；生产要么 get()、要么给池配 ThreadFactory 的异常处理/包装日志。
