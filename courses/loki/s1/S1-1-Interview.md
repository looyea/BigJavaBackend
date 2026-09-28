# Loki 架构与标签模型 · 面试题

## 题 1：讲讲 Loki 的数据模型和写入路径。

- 模型：流 = 同一标签集的日志行序列；流按时间/大小切成 chunk，压缩后 flush 对象存储且不可变；索引只存"标签集 → chunk"映射，正文不索引。
- 路径：采集器（Promtail/Alloy，推模型）→ Distributor（校验标签、租户限流、按流哈希路由）→ Ingester RF=3（内存 + WAL → flush）→ 对象存储；查询走 Query-Frontend 拆分片 → Querier 读 chunk + 索引。
- 加分：主动指出 RF=3 的内存代价与"推模型无队列缓冲"两个常被账单/故障教育的点。

## 题 2：为什么你们的 Loki 查询越来越慢？排查路径？

- 第一反应看流基数：active streams 曲线陡增 = 有人把高基数字段放进标签（trace_id/单号），每查询要扇出更多流。
- 第二看扫描量：`{app=~".*"}` 或超宽时间窗，行过滤正则回溯——query-frontend 的 split/limit 是否生效、结果缓存命中。
- 第三看组件：ingester 内存逼近 limit 频繁 GC、对象存储限流（GET 延迟）、compactor 落后导致 chunk 冗余未归并。
- 治理闭环：limits_config（max streams per user、max query parallelism、ingestion rate）+ 采集端标签白名单。

## 题 3：trace_id 到底能不能放标签？

- 默认不能：无界基数 = 无界流，等价于 Prometheus 把 request_id 当 label。
- 替代：structured metadata（可点击但不参与流标识）、或留在正文用 `|~` 行过滤；跨系统关联靠 Grafana 的 trace↔logs 跳转（Tempo/Jaeger 数据源映射）。
- 追问"我就想按订单号秒查"：那是全文检索需求——该条日志本就该进 ELK/ClickHouse 类存储，Loki 的模型不为此设计。

## 题 4：Loki 丢日志的三种典型姿势？

- 采集端：position/registry 文件放 emptyDir，Pod 重建从头或从错位处读（重复或跳过）；Loki 是推模型，采集器挂了没有 Kafka 兜底。
- 写入端：ingester 无 WAL 时崩溃丢内存未 flush 数据；Distributor 拒绝（超租户速率限制）直接 429，采集端要有重试与丢弃策略。
- 保留端：retention 由 compactor 删除 chunk，误配短保留期 = 物理删除，没有 ES 那种快照兜底习惯——要么配对象存储版本控制，要么重要流双写。

## 题 5：多租户在 Loki 里怎么用出价值？

- X-Scope-OrgID 贯穿写入/查询/配额：平台组（14 天便宜保留）与审计组（180 天、独立限流）同集群不同 SLA；
- 成本分摊：按租户统计 ingest 字节与查询量，账单可指回业务方——比共享 ES 集群"谁都在烧"更可治理；
- 坑：采集端 OrgID 路由错误会把业务日志灌进审计租户（保留期与配额双倍痛），路由规则要进代码评审。

## 题 6：Loki 和 ELK 你会怎么在架构评审会上陈述？

- 一句话定性：写时索引 vs 读时扫描的成本转移——Loki 省存储 5~10 倍，代价是"查询必须先被标签圈定"；
- 边界：任意词全文/组合检索/多维聚合 → ELK；服务+时间窗翻上下文、Grafana 栈、预算敏感 → Loki；
- 终局判据常是合规：审计要求"任意要素可检索留存"直接决定关键流必须有全文能力；
- 生产形态：分流而非二选一（全量 Loki 打底 + ERROR/审计进 ELK），并给出各自的"爆炸事故"防线（流基数 vs mapping 爆炸）证明你懂两边运维。
