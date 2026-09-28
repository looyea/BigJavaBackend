# ELK 组件与数据流 · 面试题

## 题 1：讲一下一条日志在 ELK 里的完整旅程。

- 应用落盘（logback 异步/JSON 单行）→ Filebeat harvester 读增量、registry 记偏移 →（可选 Kafka 缓冲）→ Logstash grok/富化或直接 ES Ingest → `_bulk` 写 ES（buffer+translog，refresh 后可搜）→ Kibana 按 Data View 检索。
- 追问常见于"哪一段会丢数据"：Filebeat 读到但未确认前崩溃是重复不是丢；下游全挂且无 Kafka 时，背压传到 Filebeat 暂停发送，磁盘写满才真丢。

## 题 2：Filebeat 和 Logstash 都能读文件，为什么还要分工？

- Filebeat Go 编写、常驻内存几十 MB，只做读文件/多行合并/转发，可安全部署在每台业务机；Logstash JRuby 重、吃堆内存，但生态最全（200+ 插件、条件路由、富化）。
- 架构原则：采集端水平铺（越多节点越要轻），解析端集中放（便于改规则不滚动发布千台 agent）。
- 加分：Elastic Agent 统一采集 + preprocessing 正在取代纯 Filebeat 形态，但职责划分逻辑不变。

## 题 3：Elasticsearch 为什么是"近实时"？日志场景怎么调？

- 写入即进 index buffer 并顺序写 translog 持久化；只有 refresh（默认 1s）把 buffer 生成新 segment 后才进入可搜索集合——持久化即时、可搜延迟 1s。
- 日志"写多读少"：`refresh_interval` 调到 30s、bulk 批量写、大分片少分片、不需要打分排序的字段关 norms。
- 坑：调大 refresh 后 Kibana "刚发的日志查不到"属预期，排障 SOP 要写明等待窗口。

## 题 4：链路里 Kafka 加不加？什么信号让你必须加？

- 加的理由：下游（Logstash/ES）故障或发布重启时日志洪峰无去处，Filebeat 背压最终撑爆业务机磁盘；多消费组需求（日志进 ES、也进数仓/风控实时流）。
- 不加的理由：链路多一跳、运维与成本增加、消息顺序与重复问题显性化——小规模（<10 节点、ES SLA 够用）可直写。
- 信号清单：ES 写入 rejected 频次、Logstash 队列时长 P95、Filebeat 背压日志、大促洪峰倍数。

## 题 5：at-least-once 带来的重复日志怎么处理？

- 源头不可消除（registry 丢失、Kafka rebalance 重放、ES 超时重试都产生重复），要么接受重复，要么关键统计用去重键：事件唯一 ID + ingest 侧 `drop_duplicates` pipeline processor，或聚合时 `cardinality`/distinct 口径。
- 告警场景重点防"重复计数放大"：阈值型 watch 按 doc 计数会被重复推高，改按去重后的 traceId 计数。
- 金融对账类日志宁可补数不可错算：落库带 event_id 唯一约束，重放自然幂等。

## 题 6：动态映射为什么危险？日志 index template 怎么设计？

- 危险：字段名来自日志内容（把订单号/用户参数当 key）会无限新增 mapping，触顶 `limit of total fields (1000)` 后写入报错，且集群元数据膨胀拖慢 master。
- 设计：`dynamic: false` + 显式声明（message 用 text、traceId/level/service 用 keyword、@timestamp date）；按天/按大小滚动别名写入；配合组件模板 + priority 让应用与平台层解耦。
- 加分：说明 `ignore_malformed` 兜底脏行，避免一行坏数据打挂整个 bulk 请求。
