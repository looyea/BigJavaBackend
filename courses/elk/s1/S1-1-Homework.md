# ELK 组件与数据流 · 作业

## 作业 1：本地拉起最小 ELK 并验证 NRT（动手题）

**目标**：亲手测出"写入到可检索"的延迟，验证近实时语义。

**任务**：
1. 用 docker-compose 起单节点 ES + Kibana + Filebeat，采集一个不断追加的演示日志文件；
2. 写一个循环脚本：向文件追加带唯一标记 `PROBE_<时间戳>` 的行，同时在 ES 侧轮询该标记可查的时间差；
3. 把索引 `refresh_interval` 从 `1s` 改为 `30s` 重测，记录可见延迟与（用 `_stats` 对比的）写入耗时变化；
4. 人为制造一次 Filebeat registry 丢失（删 data 目录重启），统计重复日志数量并说明原因。

**验收标准**：给出两张对照表（可见延迟、重复条数）；能用一句话解释为什么 registry 丢失造成重复而不丢数据。

**参考解法要点**：轮询用 `GET applog-*/_search?q=PROBE_xxx`；重复量约等于 registry 丢失前未确认窗口内的行数——这正是 at-least-once 的体现。

## 作业 2：给 Spring Boot 设计 JSON 日志输出（工程题）

**目标**：让日志"生来结构化"，绕开 grok。

**任务**：
1. 用 logback `logstash-logback-encoder` 输出单行 JSON（含 `@timestamp`、`level`、`logger`、`traceId`、`msg`），异步 appender 队列 8192、`neverBlock=true`；
2. 写一段 Filebeat `filestream` + `ndjson` 配置直发 ES，索引按天滚动；
3. 给出 index template 关键片段：`dynamic: false`、`message` 为 text、`traceId/level` 为 keyword、关闭无检索需求字段的 norms；
4. **反例自查**：说明若把 `neverBlock` 设为 false 且队列打满，业务线程会发生什么。

**验收标准**：Kibana 能按 `traceId` 精确过滤一次请求的全部日志；template 中不存在由订单号/用户 ID 动态生成的字段。

## 作业 3：链路故障演练记录（分析题）

依次演练并记录现象与恢复动作：① 停 Logstash 10 分钟（有/无 Kafka 两版对比）；② ES 单节点下线看写入 red 拒绝；③ Kibana 前导通配查询 `*timeout*` 与 `level:ERROR AND msg:timeout` 的耗时对比。**验收标准**：每个故障写清"数据去哪了/谁受背压/恢复后要不要补数"三问，并给出监控指标名（如 Logstash node_stats 队列时长、ES write thread pool rejected、Kibana search latency）。
