# 读写分离与复制延迟治理

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：能画出主从复制三条链路（异步/半同步/组复制）与延迟的四个来源；用 GTID/位点一致性判定实现"读到不低于上次版本"的会话保证；为不同业务给出容忍度分级方案（强制读主/延迟阈值路由/缓存兜底）；说清代理层（ProxySQL/MySQL Router）与应用层路由的取舍与从库故障摘除机制。

```flow
例子目的：一次"写后读旧"事故的时间线——写提交、binlog 传输、从库回放三者与用户刷新赛跑
主库: 事务提交(位点 mysql-bin.0007:4200) -> binlog dump 线程: 传 3MB 大包(网络耗时+60ms)
从库: SQL 线程排队(单线程回放大事务) -> 应用: 读从库命中回放前旧数据(用户投诉)
治理点1: 读路由先查从库 Seconds_Behind + 位点 >= 4200 才放行
治理点2: 写会话标记 pin 主库 2s
```

## 一、延迟的四个来源（治理先定位）

MySQL 主从复制延迟由四段叠加，各自药方不同：

1. **传输**：binlog dump→网络→IO 线程落 relay log——大包/带宽/跨机房 RTT；
2. **排队回放**：SQL 线程串行性（旧版本单线程）——大事务（一次 UPDATE 50 万行）把回放卡成分钟级；MySQL 5.7+ MTS 库级/写集并行（`binlog_transaction_dependency_tracking=WRITESET`）大幅缓解但仍有依赖串行点；
3. **从库负载**：从库本身在被报表/读流量压榨，回放线程抢不到 CPU/IO；
4. **DDL**：从库执行 online DDL 期间回放停摆（gh-ost/pt-osc 走影子表路径绕开）。

**度量口径**：`Seconds_Behind_Master` 是"IO 队列空时 SQL 线程落后主库的时间差"——它有三处骗人：SQL 线程空闲断连时显示 NULL；大事务开始回放前显示 0；并行回放时按最后提交事务计。**生产判定一律加位点/GTID 比对**：从库 `gtid_executed` 是否包含主库返回的 `gtid_executed` 集合。

```java
// 例子目的：用 GTID 集合包含关系实现"读不旧于上次写"的会话一致性判定
class GtidSessionGuard {
    // 目的：写成功后记住主库返回的 GTID 集（如 uuid:1-120），存进会话
    boolean safeToReadReplica(Session s, ReplicaStatus rs) {
        return GtidSet.contains(rs.gtidExecuted, s.lastWriteGtid);   // 例子：从库已回放包含 1-120 → 读它安全
    }
    Route decide(Session s, ClusterView view) {
        if (System.currentTimeMillis() < s.pinMasterUntil) return MASTER;        // 结果：写后短窗口直接钉主（第一道闸）
        Replica r = view.candidates().stream()
            .filter(x -> safeToReadReplica(s, x))                                 // 目的：再按 GTID 筛掉没追平的从库
            .findFirst().orElse(null);
        return r != null ? ROUTE(r) : MASTER;                                     // 输出：没有安全从库就回退主库——可用性换正确性的自动降级
    }
}
```

## 二、会话一致性的三档保证

最终一致（主从默认）对用户体验的直接伤害是**读不到自己的写**。按强度三档：

- **读己之写（session）**：写后短窗口钉主（时间法，粗）→ 升级为 GTID 等待（精确）→ `WAIT_FOR_EXECUTED_GTID_SET(gtid, timeout)` 阻塞到追平或超时降级；
- **单调读（monotonic）**：同一会话后续读不得比上次读更新的位置旧——按"上次读到的 GTID"做下限，防 A/B 两从库新旧倒挂来回跳；
- **全局线性**：所有读都不旧——等于取消读写分离，仅资金页考虑。

**时间法 vs 位点法**：pin 主 2 秒是玄学（延迟可能是 5 秒）；位点/ GTID 等待才是可证明的正确。但位点法要求连接层能"等"——多数团队折中：**关键页强制主库 + 一般页容忍秒级旧 + 监控复制延迟做告警与自动路由收缩**。

## 三、路由层：代理 vs 应用

| 维度 | 应用层（AbstractRoutingDataSource/ShardingSphere 读写组） | 中间代理（ProxySQL/MySQL Router/云 RDS 代理） |
| --- | --- | --- |
| GTID 会话粘性 | 容易（会话在应用手里） | 难（代理不持业务会话，需事务级标记） |
| 异构语言接入 | 不可 | 可 |
| 从库摘除 | 自己实现探活 | 代理自带 hostgroup 健康检查 |
| 事务内读写混合 | 需显式规则：事务中一律主库 | 代理按事务边界自动 |
| 运维黑盒度 | 逻辑可见 | 路由在中间件，排障多一层 |

经验法则：**用云 RDS 就用它的代理+读写地址，自建集群小团队用 ShardingSphere 读写分离规则，只有需要跨异构服务统一入口才上 ProxySQL**。无论哪层，"事务内读自动走主"必须是默认行为。

## 四、延迟治理工具箱（按成本排序）

1. **拆大事务**：批量 UPDATE 分批（LIMIT 循环）——从库回放平滑的首要措施；
2. **并行回放参数**：MTS + WRITESET 依赖追踪；
3. **从库分池**：报表从库/在线读从库隔离，在线池禁 DDL 禁跑批；
4. **读路由收缩**：延迟 > 阈值自动把从库踢出读池（本节例的 orElse(MASTER)）；
5. **半同步/组复制**：把"已提交未回放"窗口压缩（注意 rpl_semi_sync 只保证收到不保证回放——等待仍可能读旧，位点法不可省）；
6. **热点表单独架构**：资金类直接走主库或独立缓存版本号方案，不进入复制博弈。

## 五、常见线上问题

- **从库被报表拖死引发全量读雪崩**：延迟阈值收缩没配，所有会话级 SQL 压向主库——分池+收缩双配。
- **主库切换后应用还连旧主**：代理 VIP/DNS 缓存未刷——连接池最小存活时间要小于故障切换 SLB 生效时间。
- **自增主键从库延迟下"查不到刚插入行"**：除会话粘滞外，insert 返回的 id 回写缓存做存在性兜底（前端新行本地展示）。
- **GTID 集巨大比较慢**：文本集合比较 O(n)——用 uuid:interval 压缩结构或改用 file+pos 比对（同主库系列）加速。
- **双主互备脑裂**：auto_increment 双写冲突或数据各走各的——无仲裁的 MHA 类方案在大促窗口出事率最高。

## 六、动手题

1. 造一个 50 万行 UPDATE 大事务，观测 `Seconds_Behind_Master` 与 GTID 追平时长；再改分批 5000 行/批对比曲线。
2. 开启 `binlog_transaction_dependency_tracking=WRITESET`，用 sysbench 事务压测复测延迟，量化并行回放收益。

## 七、关联技术栈

ShardingSphere 读写组（上一节分片的伴生能力）、Canal（订阅 binlog 做异构索引，延迟模型与本节同源）、MHA/Orchestrator/Patroni 类高可用切换、云 RDS 只读实例体系；下一节缓存一致性把"复制延迟"扩展到"双写延迟"问题域。

## 八、本节小结

读写分离的收益全建立在"从库数据是旧的"这个前提上，所以治理对象不是延迟数字而是**不一致窗口里的用户体验**：定位四段延迟来源、用 GTID 位点替代秒数做正确性判定、按业务分三档会话保证、代理层保证"事务内读主"是底线。复制延迟无法消灭只能压缩与兜底——把"读旧"设计成业务可预期行为（最后更新时间提示、版本化读），才是架构级的成熟答案。
