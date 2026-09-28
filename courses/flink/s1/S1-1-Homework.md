# 流处理模型、窗口与事件时间 · 作业

## 作业 1：实现"每商品每 5 分钟点击量"

- 目标：跑通 keyBy + 事件时间滚动窗口 + 增量聚合的最小闭环。
- 任务：从 Kafka 读点击日志，`keyBy(itemId)`，用 `TumblingEventTimeWindows.of(Time.minutes(5))`，以 `aggregate` 增量计数并把 `(itemId, windowEnd, count)` 下发到下游；为记录分配事件时间戳。
- 验收标准：同一商品的状态只落在其分区、并行度生效；输出按 5 分钟对齐不重叠；不缓存窗口全量元素（用增量聚合）。
- 参考解法要点：优先 aggregate/reduce 而非 ProcessWindow 全量缓存；时间戳从数据字段取。

## 作业 2：会话窗口统计用户在线时长

- 目标：用 Session 窗口按活动间隙聚合用户行为。
- 任务：`keyBy(userId)` 后用 `EventTimeSessionWindows.withGap(Time.minutes(30))` 聚合每次会话的事件数与首末时间；分析一个用户"30 分钟无操作即切会话"的行为；对比如果用滚动窗口会得到什么错误结论。
- 验收标准：会话边界由活动间隙决定而非固定钟表；跨窗口边界的连续行为被正确合入同一会话；说明滚动/滑动为何不适合"会话"语义。
- 参考解法要点：Session 依赖水位线推进关窗；gap 是"静默多久算结束"，与统计周期无关。

## 作业 3：处理乱序与迟到数据

- 目标：让乱序环境下的窗口结果既及时又不丢数。
- 任务：为作业 1 加 `WatermarkStrategy.forBoundedOutOfOrderness(Duration.ofSeconds(10))` 与 `allowedLateness(Time.minutes(1))`，并用 `sideOutputLateData` 收集超晚数据到侧输出流；构造一批乱序/迟到样本，观察窗口触发次数与迟到侧输出。
- 验收标准：乱序在 10s 内不丢；迟到但在 lateness 内会触发窗口更新；更晚数据进入侧输出可另行补算；能解释三者（watermark/allowedLateness/sideOutput）分工。
- 参考解法要点：允许乱序度决定 watermark 落后多少；allowedLateness 是"关窗后再等多久"；侧输出是最后兜底。
