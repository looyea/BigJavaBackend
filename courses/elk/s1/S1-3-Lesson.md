# ELK vs Loki：全文索引取舍（关联）

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：能从索引原理层面解释两套系统的成本/性能差异，用一天的日志量把两边的资源账算出来，给出"什么日志进 ELK、什么日志进 Loki、什么时候双写"的决策框架。

## 一、分野只有一句话

**ELK 对日志正文每个词建倒排索引（写时付出、读时快）；Loki 只给标签（label）建索引，正文原样压缩进对象存储、查询时暴力扫描（写时省、读时受限）。** Loki 官方口号 "like Prometheus, but for logs" 点明了它的出身：标签模型 + 按需抓取，把日志当指标管。

```text
图目的：同一份日志在两条链路的开销落点——ELK 成本在写与存，Loki 成本在读与标签设计
ELK :  日志 → Filebeat → Logstash → ES(分词+倒排+doc_values，索引膨胀 1.5~2x) → Kibana DSL 查询
Loki:  日志 → Promtail/Agent(只提标签) →  chunks 压缩进 S3(正文不索引) → Grafana LogQL(标签圈定→逐行过滤)
```

## 二、同一负载的资源账

负载：100GB/天、保留 30 天、60 个微服务。

| 维度 | ELK | Loki |
|------|-----|------|
| 存储量 | ~9TB（含副本与索引膨胀） | ~1.2TB（snappy/zstd 压缩 ≈0.3x，对象存储） |
| 常驻计算 | 3 hot 节点（32GB 堆+SSD）+ 3 warm | 3 副本 ingester（16GB 内存）+ query-frontend，无共享存储需求 |
| 写入扩展 | 分片数与 refresh/merge IO 是瓶颈 | 水平加 ingester 即可，无倒排构建 |
| 典型查询 | `msg:"支付超时" and level:ERROR` 全文词项毫秒级 | 必须先标签圈定（app+namespace），关键词靠 grep 式扫描，窗口大就慢 |
| 聚合/看板 | 强（doc_values 支撑数值聚合） | 弱项（LogQL 有 `unwrap`/`rate` 但精度与性能都不如 ES 聚合） |
| 告警 | Kibana/Watch（按 doc 计数天然重复放大，见 s1-1） | Grafana Alerting 与指标同一入口 |

结论区间：**存储成本 Loki 通常省 5~10 倍，检索灵活性 ELK 压倒性占优**——省的是索引，赔的是"查不动就扩大扫描"的运维时间。

## 三、两边的隐性前提

- Loki 的前提是**标签纪律**：标签基数爆炸（把 user_id、trace_id 塞进 label）会让索引卡死，等价于 ES 的 mapping 爆炸；正文检索体验靠 LogQL 的 `|~ "regex"`，正则回溯在宽窗口是灾难。

```logql
# 目的：对比同一需求“查支付服务 ERROR 中含超时字样”在两边的写法与代价
# Loki：标签先圈定流，再逐行正则过滤——扫描量 = 该服务时间窗内全部日志
{app="payment-gateway", namespace="prod"} |= "timeout"
# 错误用法：正则全匹配标签，失去圈定意义 → 异常表现：query-frontend 报 context deadline exceeded
{app=~".*"} |~ ".*time.?out.*"
# 结果：正确姿势是缩小时间窗 + 精确标签，再用 line filters 二次收敛

# ES DSL 侧：分词后词项直接命中倒排，时间窗再宽也是索引定位（示意，语法为 Lucene query_string）
level:ERROR AND app:payment-gateway AND message:"connection timeout"
```

- ELK 的隐性问题在 s1-1/s1-2 已见：动态 mapping、refresh 开销、冷热运维。索引不是免费的——**每一次写入都在为你将来某一次"任意词全文检索"预付成本**。
- 迁移成本双向不对称：从 ELK 去 Loki，失去的是"任意时刻想查什么就查什么"；从 Loki 去 ELK，付出的是集群与账单。选错方向的重来成本都高，所以要按日志类别分而治之。

## 四、决策框架

1. **排障路径先问自己**：值班同学是"带着关键词来查"（支付网关错误码 → ELK 赢）还是"顺着服务/时间窗翻上下文"（K8s 全组件日志 → Loki 够用且便宜）？
2. **按日志类别分流**：交易/风控/审计等低频高价值、需全文与合规检索的进 ELK；平台运行日志、debug 级洪流进 Loki；同一日志双写是过渡态不是终态。
3. **团队栈**：全 Grafana 监控（Prometheus 系）的团队 Loki 接入成本近乎零；Kibana 已深度用于业务查询的，别为省存储推翻习惯。
4. **合规红线**：金融监管要求"任意要素可检索留存 180 天"时，Loki 的标签模型撑不住 `按商户号+错误码` 这类组合全文查询——这条常是终局判据。

## 五、折中形态（生产常见）

- Loki 存全量 + 对 ERROR/WARN 单独打标签路由一份进 ELK（便宜打底、贵的只存该存的）；
- ClickHouse 系（如 Grafana 新栈 Loki 3.x 的 TSDB/列式实验、或 ALT 方案）作为第三条路，介于两者之间；
- ES 侧用 `logsdb` 日志专用映射模板 + storage 分层，先把成本差距缩小再谈选型。

## 六、关联技术

Loki 的标签模型与 LogQL 细节在 [Loki s1-1/s1-2](../../loki/s1/S1-1-Lesson.md)；ELK 侧成本来源在 [ILM 与冷热](S1-2-Lesson.md)；结构化日志（JSON 字段一致性）是两边共同的地基，见 [ELK 组件与数据流](S1-1-Lesson.md) 作业 2。
