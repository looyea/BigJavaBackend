# CDC、数据管道与流批一体

> 本节难度：★★★★☆
> 重要程度：★★★☆☆
> 学习产出：能讲清 CDC（变更数据捕获）用数据库 binlog 增量捕获"行级变更"替代全量轮询的原理，理解 Flink CDC 无锁快照、增量快照并行读、断点续传的机制；掌握"源库→Flink→Kafka 中转→湖仓/ES/数仓"的数据管道分层与流批一体（同一套逻辑 + 一份数据）的目标；能为主键 upsert、删除事件、schema 演进选择正确的下游语义，并识破"轮询全表压垮源库""CDC 丢失 delete""上游改列名下游全崩"等事故。

## 一、CDC：从"轮询全表"到"读 binlog"

```text
图目的：为什么增量捕获优于批量轮询
传统：定时 SELECT 全表/按更新时间扫描 → 源库压力大、延迟高、抓不到 delete
CDC：订阅数据库事务日志（MySQL binlog/PG WAL），拿到每一行的 insert/update/delete
优势：近实时、对源库侵入小、能捕获物理删除、顺序保证
代表：Debezium 解析日志，Flink CDC 把连接器做成 Source 直接进流
```

## 二、Flink CDC 的无锁增量快照

```text
图目的：全量+增量衔接是最难点，旧方案锁表/一致性差
传统 Debezium 全量阶段锁表，且全量与增量切换有数据缺口
Flink CDC 2.x+：增量快照框架——把表切分成多个 chunk 并行无锁读，每个 chunk 记录开始/结束 binlog 位点
用"低水位/高水位 + 阶段算法"回填 chunk 期间的变更，全量完成再无缝接增量，支持断点续传
```

```java
// 目的：声明一个 MySQL CDC Source，产出变更流并做主键 upsert
 MySqlSource<MyRow> src = MySqlSource.<MyRow>builder()
     .databaseList("shop").tableList("shop.product")
     .startupInitialSnapshot(true)                       // 结果：先无锁全量快照，再平滑衔接入增量 binlog
     .deserializer(new JsonDebeziumDeserializer())        // 说明：携带 op(c/u/d)、before/after、ts_ms
     .build();
// 反例：把 CDC 流直接 append 写入仅追加的 sink ❌ update/delete 事件被当新增，下游数据越堆越错
// 反例：下游 ES/数仓无主键 upsert 语义、又不处理 delete ❌ 源库删了一行，镜像里永远删不掉
```

## 三、数据管道分层：源 → 流 → 中转 → 多目标

```text
图目的：一条 CDC 流如何喂给不同下游，各层职责
源库 → Flink CDC Source（捕获变更）→ 清洗/转换/维表关联 → Kafka（中转与解耦、可回放）
 → 扇出到多个 sink：湖仓(Iceberg/Hudi/Paimon 做 upsert)、ES(建搜索索引)、数仓、缓存
Kafka 解耦"采集"与"消费"：下游新增不需再动源库，且保留变更历史可重放补数
```

## 四、流批一体：一套逻辑、一份数据

```text
图目的：告别 Lambda 架构的"流批两套代码两份数据"
Lambda：实时层+批处理层各写一遍逻辑，口径易打架、维护翻倍
流批一体：Flink 统一引擎 + 统一表格式（Paimon/Iceberg）+ 统一 SQL，历史批与实时流同语义
落地：同一张 CDC 表，实时看板走流、T+1 报表走批，口径一致来自同源同逻辑
```

- 关键：湖仓表格式提供 ACID、主键 upsert、schema evolution，是流批共享"一份数据"的地基。

## 五、关联课程

管道里 Kafka 作为中转的分区/顺序与重放能力见 [分区、副本与 ISR 机制](../../kafka/s1/S1-1-Lesson.md)；事务写入下游所依赖的 exactly-once 见 [水位线、状态后端与 exactly-once](S1-2-Lesson.md)；把搜索结果落 ES 的索引设计见 [倒排索引与分词器链路](../../elasticsearch/s1/S1-1-Lesson.md)；与库式采集的边界对比见 [与 Kafka Streams 选型（关联）](S1-4-Lesson.md)。
