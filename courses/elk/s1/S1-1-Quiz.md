# ELK 组件与数据流 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. 在标准 ELK 日志链路中，负责"读取文件并维护采集偏移量"的组件是？（6分）

- A. Logstash 的 file input
- B. Filebeat 的 harvester + registry
- C. Elasticsearch 的 _bulk API
- D. Kibana Data View
> 答案：B
> 解析：Filebeat 用 harvester 读文件、registry 记录 inode/offset，重启续采；Logstash file input 也能读文件但无分布式偏移量管理，不推荐当采集器。

### 2. 生产链路里加 Kafka 缓冲在 Filebeat 与 Logstash 之间的主要目的是？（6分）

- A. 让日志支持 SQL 查询
- B. 削峰填谷，下游故障时日志不丢、应用不受背压
- C. 替代 ES 的存储
- D. 提高 Kibana 渲染速度
> 答案：B
> 解析：Kafka 解耦采集速率与解析/索引速率，ES 假死或大促日志洪峰时由队列吸收，这是 at-least-once 语义成立的前提之一。

### 3. Elasticsearch 被称为"近实时（NRT）"搜索的根本原因是？（6分）

- A. 查询走缓存
- B. 写入先进 buffer+translog，refresh（默认 1s）生成新 segment 后才可搜索
- C. 副本异步复制
- D. translog 定期 fsync
> 答案：B
> 解析：文档写入即持久化（translog），但要等 refresh 产出可搜索 segment 才能被查到，默认 1s 造成"秒级可见"。

### 4. 关于 grok 解析的落点，下列做法最不推荐的是？（6分）

- A. 应用直接输出 JSON 日志，Filebeat ndjson 解析
- B. 在 Logstash 用 grok 解析非结构化文本
- C. 在 Filebeat 里跑复杂 grok 与地理 IP 富化
- D. 用 ES Ingest Node pipeline 做轻量解析
> 答案：C
> 解析：Filebeat 定位是轻量采集器，重解析放采集端会让每个节点都承担 CPU 开销且难维护；A/B/D 均是合理分工。

### 5. 日志索引不设 `dynamic: false` 约束，最典型的故障是？（6分）

- A. 磁盘写满
- B. mapping 字段爆炸，报 limit of total fields exceeded
- C. Kibana 无法连接 ES
- D. 查询延迟翻倍但无报错
> 答案：B
> 解析：随机 key（订单号做字段名等）会不断新增映射字段，触达 1000 上限后写入报错，且 mapping 本身拖慢集群元数据管理。

### 6. Filebeat 的 delivery 默认语义与后果是？（6分）

- A. at-most-once，下游故障会丢日志
- B. at-least-once，下游 ACK 前崩溃会重放，产生重复日志
- C. exactly-once，天然去重
- D. 无确认机制
> 答案：B
> 解析：ACK 来自 ES/Logstash/Kafka 而非应用文件本身，重放必然可能重复，检索/统计侧要靠幂等设计或去重字段。

### 7. 关于"应用内 Logback appender 直发 Logstash/ES"，主要风险是？（6分）

- A. 日志格式不兼容
- B. 可观测链路故障（网络抖动、下游背压）耦合进业务线程，拖垮应用
- C. Kibana 无法识别
- D. 必须引入 Kafka
> 答案：B
> 解析：直发把日志链路变成业务同步依赖，正确姿势是本地落盘 + 旁路采集，appender 最多作为补充通道且要异步有界队列。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于四个组件职责边界，正确的有？（9分）

- A. Elasticsearch 负责索引与聚合，不负责把原始文本解析成字段
- B. Logstash 适合做解析、富化与多路输出，但吞吐扩展成本高于 Beats
- C. Kibana 自带日志存储集群，ES 挂了还能查历史
- D. Filebeat 做多行合并（如 Java 堆栈）比 Logstash 更省资源
> 答案：ABD
> 解析：C 错误——Kibana 无状态不存数据，数据全部在 ES；A/B/D 是标准分工，多行合并这类轻解析放采集端最合适。

### 9. （多选）能提升日志场景 ES 写入吞吐的合理手段包括？（9分）

- A. 把日志索引 refresh_interval 调大到 30s
- B. 用 _bulk 批量写并控制单批大小
- C. 把每个日志事件拆成超小分片、每节点几千 shard
- D. 关闭不需要检索字段的 norms/doc_values，用 keyword 而非 text 存 ID
> 答案：ABD
> 解析：C 反向操作——shard 过多耗尽堆内存与集群状态管理，是写入变慢与 red 的头号原因；日志要"大分片少数量"。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 画出/描述一条 Spring Boot 应用日志从产生到在 Kibana 可检索的完整数据流，说明每一段的可能瓶颈与你的加固手段。（40分）

> 参考答案：
- 要点1：产生段——logback 异步 appender 落盘（JSON 一行一事件），瓶颈是磁盘与业务线程阻塞，加固用异步+有界队列丢弃策略；
- 要点2：采集段——Filebeat harvester+registry 跟踪偏移量，瓶颈是句柄数与重启丢 registry，加固 registry 挂持久卷、限速防打满网口；
- 要点3：缓冲段——Kafka 削峰，瓶颈是分区数与消费滞后，加固按索引/服务哈希分区并监控 consumer lag；
- 要点4：解析段——Logstash grok/pipeline，瓶颈是 JRuby CPU，加固优先让应用输出结构化 JSON 绕过 grok；
- 要点5：索引段——ES _bulk + NRT refresh，瓶颈是 refresh/merge IO 与 shard 规划，加固大分片、调 refresh_interval、动态映射加限；
- 要点6：检索段——Kibana 查询，瓶颈是宽时间范围+前导通配查询，加固 Data View 限定字段、默认时间窗与 filter 优先。
