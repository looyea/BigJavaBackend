# Loki 架构与标签模型 · 作业

## 作业 1：docker-compose 起一套 Loki 三件套（动手题）

**目标**：跑通 Grafana + Loki + Promtail，理解"标签决定一切查询"。

**任务**：
1. compose 拉起 `grafana/grafana`、`grafana/loki`、`grafana/promtail`，Loki 用文件系统存储（boltdb-shipper/tsdb + filesystem）；
2. 写 promtail 配置采集本机一个日志文件，静态打标签 `app=demo, env=dev`；
3. 在 Grafana Explore 里分别执行：`{app="demo"}`、`{app="demo"} |= "ERROR"`、`{app=~".*"}`，记录三者的返回与耗时；
4. 制造一次"基数爆炸"实验：脚本每写一行就注入唯一 `run_id` 标签，观察 Loki 日志中 active streams 增长与查询劣化，然后回滚配置对比。

**验收标准**：三个查询的结果差异能用自己的话解释（第三个为什么慢/被限）；能贴出 streams 增长曲线并说明护栏参数该设在哪一层（Distributor/limits_config）。

**参考解法要点**：`{app=~".*"}` 会被 `-querier.max-similar-in-flight` 或流上限拒绝——"Loki 保护你不炸，但默认配置偏保守"。

## 作业 2：为 K8s 集群设计采集与标签方案（工程题）

背景：60 个 Spring Boot 服务部署在 EKS，logback 已输出 JSON（字段：`@timestamp`、`level`、`logger`、`traceId`、`msg`），要求平台日志 14 天保留、审计日志租户单独 180 天。

**任务**：
1. 给出 DaemonSet 模式 Alloy/Promtail 的 relabel 白名单（namespace/app/level 必留，pod 名去留说明理由）；
2. 写出 pipeline：json 提取 → level 进 labels → traceId 进 structured metadata；审计日志按 `app` 匹配路由到 OrgID=audit 租户；
3. limits_config 关键项：每租户 ingestion rate、max streams、retention 14d/180d 差异；
4. 附"新服务接入 checklist"（3 条以内），让规范靠流程而非口头维持。

**验收标准**：配置可被 `promtail --verify-config`/Alloy fmt 校验通过；能回答"某服务改了日志字段名，链路哪一段会静默丢标签"（json stage 表达式失效 → level 全空 → 合成一条无 level 值的流）。

## 作业 3：写入路径故障分析（分析题）

分别分析三种故障下"日志去了哪里"：① Promtail Pod 重启（registry/position 文件在 emptyDir）；② Ingester 滚动升级且 WAL 关闭；③ Distributor 全部就绪但对象存储 PUT 持续 5xx。**验收标准**：每种给出丢/重判定、用户可见现象（Grafana 侧）与加固措施（position 持久卷、WAL、flush 重试与告警），并注明哪一环因为 Loki 是推模型而无队列兜底。
