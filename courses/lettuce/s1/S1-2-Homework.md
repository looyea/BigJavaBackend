# 作业题 · 连接池、Cluster/Sentinel 与异步/响应式 API

> 作业不判分，做完对照参考答案自查。需要 Lettuce 6.x + 本地 Redis（Cluster/Sentinel 题需相应拓扑，docker 起最省事）。

## 作业 1：pipeline 三版计时（必做）

```java
// 例子目的：1000 个 GET 用三种写法各跑 10 轮取均值
// 版1：sync 循环逐个 get                        // 基线：≈1000 次 RTT（预期最慢，本地回环也不低于版3一个量级）
// 版2：async 默认 autoFlush，循环 get 后 allOf   // 错误用法：命令逐条即时发出，RTT 重叠有限，收益远小于版3
// 版3：autoFlushCommands(false) → 循环入队 → flushCommands() → 统一收  // 正确使用结果：≈1 次 RTT + 顺序执行，三者最快
```

注释贴三版耗时，并验证版3期间 `ss -tnp` 始终只有 1 条连接。

## 作业 2：MGET vs pipeline vs Lua 选型实测（必做）

同一批 500 个 key：① 按槽分组 MGET；② 作业1版3 的 pipeline；③ 写一个 Lua 脚本循环 `redis.call('GET', KEYS[i])` 返回表。记录三版耗时并回答：**为什么 Lua 版反而可能最慢？**

**参考答案要点**：Lua 脚本在单线程里逐条 GET，省了 RTT 但把 500 次执行压进**一次命令的执行时间**，阻塞其它请求；MGET/pipeline 由服务端排队分摊。脚本内重循环是反模式。

## 作业 3：failover 收敛对比（必做）

Cluster 3 主 3 从压测中 `kill -9` 一个主，A 组默认 `ClusterClientOptions`、B 组开 `validateTopologyOnRedirect(true)+adaptiveRefresh`，分别统计业务报错（MOVED/连接失败）持续秒数。

注释记录两组的 `master_link_status` 变化时间线（呼应 redis s1-2 哨兵/Cluster failover 流程）。

## 作业 4：Sentinel 自动跟随（选做）

一主两从+三哨兵，`RedisURI.withSentinelMasterId("mymaster")` 建连接，`kill -9` 主库，抓 Lettuce DEBUG 日志里 `+switch-master` 事件与连接重建过程；期间持续 GET 统计错误窗口。

**参考答案要点**：客户端无需池、无需自研监听；错误窗口≈哨兵故障转移时长（秒级），远小于默认拓扑刷新周期。

## 作业 5：池配置审计（选做）

找出你司/示例工程 Spring Boot 配置里的 `lettuce.pool.*`，对照课文判断：MUX 还是 POOL 生效？max-wait 是否配了？有没有"配了池却根本没用到"的僵尸配置？

**参考答案要点**：`shareNativeConnection=true`（默认）且无事务/阻塞操作时池配置基本不生效——僵尸配置要清理，避免误导后人以为并发靠池撑。
