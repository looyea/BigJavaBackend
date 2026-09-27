# 分片、幂等与失败补偿 · 面试题

## 题 1：分片数如何确定？设太多或太少有什么影响？

- 太多（>> 实例数）：每实例处理多个分片 → 调度触发间隔内执行不完 → 任务堆积。
- 太少（< 实例数）：部分实例空闲 → 资源浪费；但单个分片数据量太大可能超内存。
- 经验：分片数 = 数据总量 / 单片可处理量，保证每片在触发间隔内完成。

## 题 2：幂等键设计包含哪些维度？为什么不能只用 JobId？

JobId + 日期 + 分片号：
- 只用 JobId → 不同日期/分片的数据被判定为"重复"。
- 只用日期 → 同一天的不同分片冲突。
- 分片广播场景每个分片独立幂等，必须包含分片维度。

## 题 3：补偿 Job 与失败重试的区别？

| 维度 | 失败重试 | 补偿 Job |
|------|----------|----------|
| 时机 | 同步——Admin 立即再次触发 | 异步——独立 Cron 定时扫描 |
| 范围 | 同一任务同一分片 | 可跨任务（如扫描主+子任务） |
| 次数 | 有限（retryCount） | 持续直到人工确认 |
| 场景 | 临时性故障（网络抖动） | 持久性故障（下游 Bug、数据异常） |

## 题 4：分片广播模式下 Admin 如何传递分片参数？

```java
// 目的：Admin 向每个 Executor 实例发触发请求时附带不同参数
// HTTP Body: { "jobId":5, "shardIndex":2, "shardTotal":10, "executorParam":"..." }
// 结果：Executor 端通过 XxlJobHelper.getShardIndex() 获取
// 说明：分片广播 = Admin 对组内所有存活实例各发一次 HTTP，参数中 shardIndex 递增
```

## 题 5：日切"全量成功才能标记完成"如何实现？

```java
// 目的：所有分片 DONE 后才推进日切状态
@XxlJob("reconcileDoneCheck")
public void checkAllDone() {
    // 说明：此 Job 在主 Job 之后触发（Admin 设依赖 or 延迟 Cron）
    long incomplete = logRepo.countByDateAndStatusNot(today, "DONE");
    if (incomplete == 0) {
        settleService.markDayComplete(today);  // 结果：标记完成 → 解锁下游
    } else {
        XxlJobHelper.handleFail("还有 " + incomplete + " 分片未完成");  // 输出：告警
    }
}
// 错误用法：不等全部完成就标记 → 部分数据缺失 → 对账不平
```

## 题 6：高可用部署时 Executor 如何防重复执行？

XXL-Job 路由策略选一个 Executor 执行（非广播场景），天然不重复。分片广播场景由 Admin 确保每个 shardIndex 只下发一次。若 Admin 集群本身重复下发（极端时钟问题）→ Executor 侧幂等兜底。
