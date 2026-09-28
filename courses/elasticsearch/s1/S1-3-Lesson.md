# 聚合、深分页与集群容量规划

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：能讲清 ES 聚合的"协调节点两阶段汇总"模型与 doc_count 近似来源，区分 metric/bucket/pipeline 聚合及 `terms` 的精度陷阱（`shard_size`）；对比 `from+size` 深分页的内存爆炸问题，给出 `search_after`、`scroll`、`slice` 的适用边界；具备分片容量规划能力（分片数/大小、冷热架构、ILM 生命周期），并能为"实时大屏 TopN""导出全量""翻页到第 10000 页"选择正确方案。

## 一、聚合的两阶段汇总模型

```text
图目的：为什么聚合结果有时"不准"，根子在协调与近似
每个分片本地算出部分结果 → 汇总到协调节点再合并 → 返回
from+size 与 terms 都需各分片多返回一些再全局排序（oversampling）
terms 按 doc_count 排序是近似：低频词可能被"最热词"挤出 TopN 候选
```

```java
// 目的：控制 terms 聚合精度——用更大的 shard_size 换更准的全局 TopN
TermsAggregation groupByBrand = AggregationBuilders.terms("by_brand").field("brand.raw")
    .size(10)          // 想要的桶数
    .shardSize(100);   // 结果：每分片先取 100 个候选再全局合并，近似误差随 shardSize 增大而减小
// 反例：size=10 且不管 shardSize，数据高度不均时某品牌的量被别的分片漏计 ❌ 排名失真
// 反例：对 text 字段直接聚合 ❌ 分词碎片+fielddata，应对其 keyword 子字段(.raw)聚合
```

## 二、深分页：from+size 为什么危险

```text
图目的：解释 max_result_window 与"每分片都取 from+size"的代价
from=9000,size=100 → 每个分片都要取 9100 条，N 分片在协调节点合并排序 N×9100 条
深页 = O(shards × (from+size)) 内存与 CPU，默认 max_result_window=10000 是护栏不是许可
```

```text
图目的：三种翻页方案的分工
search_after：基于上一页最后一条的排序值"游标式"往后翻，无 10000 墙，适合无限滚动/深翻
scroll：开快照固定一个视图批量遍历全量，适合导出/重索引，不适合实时翻页（占资源、非实时）
切片滚动(sliced scroll)：并行加速全量导出；普通实时翻页首选 search_after
```

## 三、分片规划：数量与大小

```text
图目的：分片不是越多越好，规划目标是"可预测的搜索成本"
主分片数建索引后不可改（只能 reindex/split），必须前瞻规划
单分片经验区间数十 GB；分片过多→小段/小分片开销、集群状态膨胀；过少→无法水平扩展
副本数换读吞吐与可用性，但不增加写入分片容量
```

## 四、冷热架构与 ILM：按数据生命周期分层

```text
图目的：时间序列数据用生命周期把"热"与"冷"隔离，兼顾性能与成本
热节点：SSD、高配，只装近 N 天频繁写入与查询的索引
温/冷节点：大容量机械盘，装历史只读索引，可 search_only 甚至冻结
ILM 策略：hot→warm→cold→delete 自动迁移与删除；按天滚动索引 + 别名统一读写
```

## 五、给不同需求选对方案

```java
// 目的：为三类真实诉求匹配正确 API（选错=性能或正确性双重事故）
// 实时 TopN 大屏：terms + 合理 shardSize，必要时 composite 聚合分页遍历桶
// 导出百万级全量：scroll 或 sliced scroll 固定快照批量拉，别用 from+size 硬翻
// 无限下拉/第 10000+ 页：search_after 游标翻页，配合稳定排序键（含 _shard_doc/tiebreaker）
// 反例：用 from=100000 翻深页 ❌ 触发 10000 护栏报错，绕过它又会拖垮协调节点
// 反例：用 scroll 做用户实时分页 ❌ 快照非实时、上下文开销大、连接长期占用
```

## 六、关联课程

聚合依赖 keyword 子字段与类型选择，见 [倒排索引与分词器链路](S1-1-Lesson.md)；段数量与 merge 直接影响搜索成本，写入侧机理见 [写入流程与近实时可见](S1-2-Lesson.md)；深分页“游标+稳定排序”的思路与 MySQL 里用“记住上一页最大值 + 走索引范围扫描”规避 `LIMIT 大 offset` 深分页的做法异曲同工，见 [B+ 树索引与执行计划](../../mysql/s1/S1-2-Lesson.md)。
