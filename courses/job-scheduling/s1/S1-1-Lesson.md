# 定时任务的演进与分布式调度架构

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：理解单机定时方案的缺陷，掌握中心化调度（XXL-Job）与去中心化（ElasticJob）两种架构模型及适用场景。

## 一、单机方案的演进与问题

### 1.1 从 Timer 到 Quartz

| 方案 | 机制 | 局限 |
|------|------|------|
| `java.util.Timer` | 单线程串行，异常即终止 | 不可恢复、精度差 |
| `ScheduledExecutorService` | 线程池，异常不杀线程 | 仍单 JVM、无持久化 |
| Quartz | JDBC JobStore 持久化 + Cron | 单机集群需 DB 抢锁、管理复杂 |

```java
// 目的：ScheduledExecutorService——最简单的单机定时
ScheduledExecutorService pool = Executors.newScheduledThreadPool(2);
pool.scheduleAtFixedRate(() -> {
    // 错误用法：任务抛异常 → 本周期后不再触发（JDK 文档明确说明）
    // 结果：需 try-catch 包住任务体
    log.info("执行对账任务");
}, 0, 5, TimeUnit.MINUTES);  // 输出：每 5 分钟触发
```

### 1.2 单机的核心痛点

- **单点故障**：进程挂 → 任务丢失。
- **水平扩展难**：多实例重复触发 → 需要分布式锁。
- **无可视化管理**：改 Cron 需重启；失败无告警。

## 二、中心化调度：XXL-Job

```text
┌─────────────┐   调度请求(HTTP)   ┌────────────────┐
│  Admin 调度中心  │ ──────────────────→ │ Executor 执行器(业务应用) │
│ (可集群部署)    │ ←────────────────── │ 注册回调日志/心跳    │
└─────────────┘   注册+回调          └────────────────┘
        ↕ DB(MySQL) 存储任务/路由/日志
```

```java
// 目的：Executor 端声明一个 JobHandler——Admin 触发时执行此方法
@XxlJob("orderCloseHandler")
public void orderClose() {
    // 说明：XxlJobHelper.getJobParam() 取 Admin 配置的任务参数
    String param = XxlJobHelper.getJobParam();  // 输出：如 "minutes=30"
    int minutes = Integer.parseInt(param.split("=")[1]);
    orderService.closeUnpaid(minutes);           // 结果：关闭超 30min 未支付订单
    // 错误用法：抛异常不捕获 → Admin 标记执行失败 → 根据重试策略再次触发
}
```

**路由策略**：第一个 / 轮询 / 随机 / 一致性哈希 / 忙碌机 / 故障转移。

## 三、去中心化调度：ElasticJob

```text
ElasticJob 无独立调度 Server，所有协调走 ZooKeeper/Registry：
实例启动 → 注册自身 → 通过 ZK 选举 Leader → Leader 负责分片分配 → 实例按分片号执行
```

```java
// 目的：ElasticJob 3.x 实现 SimpleJob
public class ReconcileJob implements TypedJob {
    @Override
    public void execute(ShardingContext ctx) {
        // 说明：ctx.getShardingItem() = 当前实例被分配的分片号(0-based)
        int shard = ctx.getShardingItem();       // 输出：如 0/1/2/3
        // 结果：按分片号处理对应 DB 分表数据——天然水平扩展
        dbShard[shard].reconcile();
    }
}
// 错误用法：分片数 < 实例数 → 部分实例无分片可执行 → 资源浪费
```

## 四、两种架构对比

| 维度 | 中心化(XXL-Job) | 去中心化(ElasticJob) |
|------|-----------------|---------------------|
| 调度 | Admin 统一触发 | 各实例自主（ZK 协调） |
| 依赖 | MySQL + Admin 服务 | ZK/Registry |
| 可视化 | 内置 Admin UI | 需外挂 Dashboard |
| 适用 | 中小团队 / 任务量 < 万级 | 大规模分片并行 / 已有 ZK |

## 五、关联技术

- 云原生定时：K8s CronJob + Argo Workflows
- 电力行业：采集任务百万级分片 → ElasticJob
- 电商日切/对账：XXL-Job 路由 + 失败重试 + 钉钉告警
- Spring `@Scheduled` + ShedLock（轻量级分布式锁防重）
