# 聚合、深分页与集群容量规划 · 作业

## 作业 1：把"排名失真"的聚合调准

- 目标：理解 terms 聚合近似性并用 shard_size 收敛误差。
- 任务：造一个数据在分片间分布不均的索引，对一个高基数 keyword 字段做 `terms(size=10)`，对比默认 shard_size 与显式 `shard_size=200` 两种设置下前 10 名的差异，并贴出 doc_count_error_upper_bound / sum_other_doc_count 佐证。
- 验收标准：能展示调大 shard_size 后排名更稳定；解释为什么低频桶会被挤出；给出 size 与 shard_size 的取舍建议。
- 参考解法要点：聚合走 .keyword 子字段；shard_size≥size 且随分片数增大；误差边界字段是判断可信度的依据。

## 作业 2：用 search_after 实现稳定深翻

- 目标：翻过第 10000 条而不触发护栏、不拖垮协调节点。
- 任务：以 `sort:[{timestamp:"desc"},{_id:"asc"}]` 为主排序 + tiebreaker，用 search_after 取上一页最后一条的 sort 值作为下一页游标，连续翻 50 页；再写一段用 `from=10000` 的对照，观察报错/性能差异。
- 验收标准：游标翻页无重复无遗漏、可越过 10000；排序键含唯一 tiebreaker 保证稳定；说明为何 search_after 不支持"跳页"只支持"顺翻"。
- 参考解法要点：tiebreaker 用 _id 或 _shard_doc；search_after 依赖上一页结果，天然顺序访问。

## 作业 3：设计日志平台的冷热 + ILM 容量方案

- 目标：给海量时间序列日志做可持续的成本与性能规划。
- 任务：为按天滚动的 `logs-YYYY.MM.DD` 索引设计：主分片数与单分片目标大小、副本策略、ILM 生命周期阶段（hot→warm→cold→delete，各阶段动作与时间）、别名统一读写；给出“近 3 天热查、历史合规保留 180 天”的落地参数。
- 验收标准：分片大小落在合理区间不产生海量小分片；ILM 迁移/删除有明确时限与索引模板；别名切换读写不中断查询。
- 参考解法要点：热层 SSD、冷层大容量盘可 search_only/冻结；rollover 按大小或天数触发；删除即到期清理，容量随保留期封顶。
