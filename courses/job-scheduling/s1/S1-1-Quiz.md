# 定时任务的演进与分布式调度架构 · 小测

### 1. java.util.Timer 的核心缺陷是？（6分）

- A. 不支持 Cron 表达式
- B. 任务抛未捕获异常后整个 Timer 终止
- C. 无法指定延迟
- D. 只能执行一次

> 答案：B
> 解析：Timer 单线程串行调度，任何一次 execute 抛异常即终止后续所有计划任务。

### 2. XXL-Job 中 Admin 与 Executor 的通信方式是？（6分）

- A. TCP 长连接
- B. HTTP REST 调用
- C. gRPC 双向流
- D. 共享文件目录

> 答案：B
> 解析：Admin 通过 HTTP 向 Executor 发触发请求，Executor 通过 HTTP 回调注册/日志。

### 3. ElasticJob 的分片项由谁决定？（6分）

- A. 配置文件写死
- B. Leader 选举出的实例根据 ZK 协调分配
- C. 人工在 Dashboard 指定
- D. 随机分配

> 答案：B
> 解析：ElasticJob 去中心化，Leader 实例负责根据 sharding-total-count 和存活实例计算分配方案。

### 4. Quartz JDBC JobStore 解决的核心问题是？（6分）

- A. 提高 Cron 解析性能
- B. 任务信息持久化——JVM 重启后不丢失已调度的触发计划
- C. 支持多机并行执行
- D. 减少线程创建

> 答案：B
> 解析：RAMJobStore 重启丢失；JDBC JobStore 存 DB 实现持久化，但集群性能受限（抢锁）。

### 5. XXL-Job 的路由策略"故障转移"含义是？（6分）

- A. 任务执行失败后重试
- B. 向第一个心跳正常的执行器发请求
- C. Admin 自身多节点容灾
- D. Executor 自动降级

> 答案：B
> 解析：路由策略决定 Admin 选哪个 Executor 实例；故障转移=依次检查心跳，选第一个在线节点。

### 6. 定时任务框架防止"重复执行"的本质需求是？（6分）

- A. 减少 CPU 消耗
- B. 多实例部署时同一触发点只能有一台执行
- C. 避免 Cron 配置错误
- D. 缩短执行时间

> 答案：B
> 解析：集群下所有实例都监听 Cron → 不加锁/调度中心则多机同时触发 → 重复执行。

### 7. ShedLock 的工作原理是？（6分）

- A. 基于 ZooKeeper Watcher
- B. 在共享存储（DB/Redis）上获取带 TTL 的锁，只有拿到锁的实例执行
- C. 修改 Cron 表达式确保只一个实例匹配
- D. 通过 IP 白名单

> 答案：B
> 解析：ShedLock 用 DB 表或 Redis key 作为锁；`@Scheduled` 触发时先 lock()，失败则跳过。

### 8. 以下属于 XXL-Job 特性的有（多选）？（9分）

- A. 内置 Admin 可视化管理台
- B. 支持 GLUE 模式在线编辑脚本
- C. 基于 ZooKeeper 去中心化选举
- D. 支持任务依赖 DAG 编排

> 答案：A、B
> 解析：C 是 ElasticJob 的特征；D 不是 XXL-Job 原生功能（需借助工作流引擎或二次开发）。

### 9. 关于 ElasticJob 说法正确的是（多选）？（9分）

- A. 无中心化 Server，实例间对等
- B. 必须依赖 ZooKeeper 或注册中心
- C. 支持分片广播（每个实例处理一个分片）
- D. 内置 Web 管理台无需额外部署

> 答案：A、B、C
> 解析：D 错——ElasticJob 需独立部署 elasticjob-dashboard 或集成 third-party UI。

### 10. 简答题：从电商日切场景出发，设计一套分布式调度方案并解释为什么选择它。（40分）

- 要点1：需求——每日凌晨对全量订单分表做对账，20 张分表需并行处理
- 要点2：选择 ElasticJob 分片模型——sharding-total-count=20，每个分片对应一张表
- 要点3：幂等——对账结果写入日切流水表，唯一键=日期+分片号，重复执行不产生多余数据
- 要点4：失败补偿——单分片失败只重试该分片，不影响其他已完成分片；超 3 次告警人工介入
- 要点5：监控——接入 Prometheus + Grafana 看板展示各分片耗时与状态

> 答案：见要点
> 解析：日切核心诉求是"水平扩展+独立容错"，ElasticJob 天然分片并行满足。
