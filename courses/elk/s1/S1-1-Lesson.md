# ELK 组件与数据流

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：能说清 E/L/K 与 Beats 各自的职责边界，画出一条日志从应用磁盘到 Kibana 检索的完整数据流，理解 ES 写入的"近实时"机理，并识别采集链路里的典型配置错误。

## 一、四个角色各管什么

ELK 是 Elasticsearch + Logstash + Kibana 的缩写，生产链路里还几乎必带 Beats：

| 组件 | 本质 | 干什么 | 不干什么 |
|------|------|--------|----------|
| Elasticsearch | 分布式倒排索引存储 | 索引、检索、聚合 | 不解析原始文本 |
| Logstash | Ruby/JRuby 流式管道 | 解析、富化、转发（grok/mutate） | 不适合当高吞吐"转发器" |
| Kibana | 查询可视化前端 | Discover 检索、Dashboard、告警 | 不存数据 |
| Filebeat（Beats） | Go 编写轻量采集器 | 读文件、多行合并、直发 ES/LS | 不做重解析 |

分工经验法则：**解析尽量前移还是后移，取决于吞吐与变更频率**——Filebeat 只做多行合并这类轻活；grok 正则放 Logstash 灵活但吃 CPU 且易成瓶颈；Elastic Agent 的 preprocessing 与 ES Ingest Node 的 pipeline 是另外两个落点。

## 二、一条日志的旅程

```text
图目的：展示 Spring Boot 日志从落盘到可检索的完整数据流与各段瓶颈
应用 stdout/文件 → Filebeat(harvester+registry) → [Kafka 缓冲] → Logstash(grok→结构化)
      → ES _bulk 写入(内存 buffer + translog) → refresh(默认1s 生成 segment → 近实时可见)
      → Kibana 查询(query then fetch) → 浏览器
```

要点：Filebeat 默认 at-least-once——ACK 来自下游（ES/Logstash/Kafka）而非应用，链路任何一段重放都会产生重复日志，消费端必须幂等（见 s1-2 的 ILM 与去重策略）。

## 三、Spring Boot 接入的三种形态

```yaml
# filebeat.yml：目的——按行采集 JSON 日志并直发 ES，砍掉 Logstash 这一跳
filebeat.inputs:
  - type: filestream
    id: app-log
    paths:
      - /var/log/demo/*.log
    parsers:
      - ndjson:                      # 说明：logback 已输出 JSON 时每行解析为字段
        target: ""
        overwrite_keys: true
    filestream.pipeline:             # 结果：字段裁剪后再进索引，省存储
      - drop_fields:
          fields: ["agent", "host", "input"]
setup.dashboards.enabled: false      # 错误示例：键名写错成 dashkit 会被 strict 校验直接拒绝启动
filebeat.close_eof: true             # 危险：文件读完即关闭句柄，追加日志要等下次扫描
output.elasticsearch:
  hosts: ["http://es-cluster:9200"]
  indices: ["applog-%{+yyyy.MM.dd}"]  # 每天一个索引，配合 ILM 滚动
```

三种形态取舍：① Filebeat → ES 直写，链路最短，解析只能靠 Ingest Pipeline；② Filebeat → Logstash → ES，解析灵活、可多路输出，代价是多一跳与 Logstash 容量;③ 应用内 Logback 的 logstash-appender 直发——**反例要记住**：应用直连日志系统等于把可观测链路的故障耦合进业务线程池，网络抖动时磁盘落盘仍应保留。

## 四、ES 写入机理：为什么"近实时"

一条 `_bulk` 文档的落库路径：内存 index buffer + 顺序写 translog → 每 500MB/定期 flush 生成 segment 文件 → `refresh`（默认 1s）把 buffer 落成可搜索的新 segment——这就是"写入后 1 秒才能搜到"的近实时（NRT）由来。`refresh_interval: 30s` 可换约 20~30% 写入吞吐，日志场景常调大；副本 `refresh` 跟随主分片。

分片账：单节点堆内存决定能养多少 shard（经验值 1 shard/GB 堆），日志写入吞吐先被 refresh/merge 的 IO 限制，而不是 CPU。这些机理在 [Elasticsearch 写入流程](../../elasticsearch/s1/S1-2-Lesson.md) 一节深挖，此处只需记住：**日志索引要"少列宽表、大分片、低频 refresh"**。

## 五、典型错误清单

- 动态映射不设限：每行日志里的随机数字 ID 都生成新字段 → mapping 爆炸（错误表现：`limit of total fields exceeded`）——日志模板应 `dynamic: false` + 显式 fields；
- grok 模式过宽：`%{GREEDYDATA:msg}` 兜底放最前，后面所有规则永不命中（异常顺序错）；
- Filebeat registry 放容器可写层：重启即丢偏移量，全量重采造成重复；
- 用 Kibana 通配符前导查询（`*keyword*`）当日常操作：倒排索引失去意义，全索引扫描。

## 六、关联技术

索引滚动与冷热见下一节 [ILM 与冷热架构](S1-2-Lesson.md)；倒排索引原理在 [Elasticsearch s1-1](../../elasticsearch/s1/S1-1-Lesson.md)；全文索引 vs 标签索引的取舍在 [ELK vs Loki](S1-3-Lesson.md)。
