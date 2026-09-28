# 索引生命周期 ILM 与冷热架构 · 面试题

## 题 1：ILM 解决了什么问题？阶段模型讲一下。

- 问题：日志"写入集中最新、访问随时间衰减"，人肉 cron 管滚动/删除必然出现误删与磁盘打满。
- 模型：索引状态机 New→Hot→Warm→Cold→Frozen→Delete；hot 滚动写入，warm 压缩降级（shrink/forcemerge/迁 HDD），cold/frozen 用 searchable_snapshot 落对象存储，delete 到期删除。
- 触发：rollover 按 `max_primary_shard_size`（30~50GB 常用）/`max_docs`/`max_age` 或运算；阶段迁移按 `min_index_age`。

## 题 2：rollover 后写入是怎么不中断的？

- 靠 write alias + `is_write_index: true`：应用永远写别名，rollover 建新序号索引并把写指针前移，旧索引即刻只读。
- 事故形态：客户端写死索引名（新数据写进只读旧索引报错），或自建别名没标 write_index（rollover 失败，ILM 卡步）。
- 追问"序号怎么来"：`applog-000001` 这类 +6 编号由 ILM 管理，删除旧索引不影响继续递增。

## 题 3：forcemerge 为什么只在 warm 做？收益是什么？

- 对活跃索引 merge：新写入不断产生新段，merge 永动机式重做，且把增量也卷进超大段——写入延迟与磁盘双杀。
- 只读索引 merge 到 1 段：段句柄/文件描述符减少、查询需打开的倒排结构最少、shrink 前置要求段数受控——一次动作永久收益。
- 数字感：日志索引 merge 后典型省 20~30% 磁盘（删除标记与段开销被回收）。

## 题 4：冷热架构怎么落地？节点角色与分配约束讲一下。

- 节点池：hot（SSD、高写入并发、带 `data hot`+`index.routing.allocation.require.data=hot` 由 ILM allocate 动作驱动）、warm（HDD 大容量）、cold/frozen（带本地缓存盘的 searchable_snapshot 节点）。
- 关键机制：ILM 的 allocate/migrate 动作改索引 routing 要求，分片异步搬迁；`wait-for-migration` 卡步多为标签不匹配或磁盘水位（flood_stage）拒绝分配。
- 副本策略：hot 保 1 副本，warm 起可降 0 副本换成本——必须声明风险（节点挂该段日志短暂不可查）。

## 题 5：主分片多大合适？分片数的账怎么算？

- 经验：日志主分片 30~50GB（上限 100GB 是迁移与恢复的时间账——大分片 rebalance 一次要搬几十 GB，窗口内集群脆弱）。
- 堆约束：约 1 shard/GB 堆，200 分片/节点是常见红线的来源；碎索引（1h 一滚）比大索引更致命，因为它同时打爆集群状态、file cache 与 master 任务队列。
- 追问"查询慢是分片多还是少"：太多→每查询 fan-out 开销；太少→单分片超内存页缓存；热点时间段集中在最新索引，靠分片内并行而非分片数堆。

## 题 6：保留 180 天的审计要求下，怎么区分"生命周期删除"和"备份"？

- ILM delete 只是到期清索引，不证明数据曾安全落盘；备份走 SLM（Snapshot Lifecycle Management）定时快照到对象存储，恢复粒度是索引级。
- 合规证据链：策略 JSON 版本化进 Git（变更走 MR）、`_ilm/explain` 留痕、快照仓库开启不可变（WORM/object lock）防篡改。
- 加分：法律保全（legal hold）场景对个别索引跳过 delete——用 `_ilm/move` 到 pause 或将该索引从模板 pattern 排除，而不是改全局策略。
