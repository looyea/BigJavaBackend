# 服务发现、Exporter 与长期存储 · 小测

### 1. Prometheus relabel 的执行时机是？（6分）

- A. 查询时
- B. 服务发现产出候选目标后、实际抓取前
- C. 存储压缩时
- D. 告警评估时

> 答案：B
> 解析：SD 生成带 `__meta_*` 标签的候选集 → relabel_configs 过滤改写 → 才成为最终 targets。

### 2. K8s 中最常见的"声明式被抓取"约定是？（6分）

- A. 修改 prometheus.yml 添加 IP
- B. Pod 加 prometheus.io/scrape=true 注解 + relabel keep 过滤
- C. 给 Pod 加 ServiceMesh
- D. 调用 Prom API 注册

> 答案：B
> 解析：注解随应用发布走，扩缩容自动生效，无需人肉维护 targets。

### 3. action: labeldrop 的典型用途是？（6分）

- A. 删除过期序列
- B. 抓取侧丢弃高基数/敏感标签，控制序列规模
- C. 降低抓取频率
- D. 压缩磁盘

> 答案：B
> 解析：在入库前 drop 如 pod_name 等无用高基数标签，是基数治理第一道闸。

### 4. 监控"消费组 lag"最合适的组件是？（6分）

- A. node_exporter
- B. kafka_exporter（含 consumer lag 指标）
- C. blackbox_exporter
- D. Pushgateway

> 答案：B
> 解析：kafka_exporter 读 admin API 输出 kafka_consumergroup_lag，直接支撑积压告警。

### 5. blackbox_exporter 的定位是？（6分）

- A. 采 JVM 指标
- B. 从外部拨测 HTTP/TCP/ICMP，度量"用户视角可用性"
- C. 存长期数据
- D. 替代所有中间件 exporter

> 答案：B
> 解析：黑盒只关心"通不通、多久、证书剩几天"，probe_success/probe_duration_seconds 是入口 SLA 常用指标。

### 6. 超大规模下 hashmod + keep 的组合用于？（6分）

- A. 负载均衡
- B. 按地址稳定散列只抓 1/N 实例，控制序列总量
- C. 数据分片
- D. 告警分流

> 答案：B
> 解析：modulus 取模 + keep 固定余数 → 同一实例永远命中/不命中，扩缩容不抖动。

### 7. Thanos 与 VictoriaMetrics 的共同点是？（6分）

- A. 都替代 Prom 的查询语言
- B. 都通过 remote_write 接收数据做长期存储与全局视图
- C. 都要求改造应用埋点
- D. 都只支持对象存储

> 答案：B
> 解析：两者都兼容 PromQL 与现网 Prom 零改造，经 remote_write 接入；差异在部署模型与规模。

### 8. 关于 Prom 高可用部署，正确的做法有（多选）？（9分）

- A. 两套配置完全相同的 Prom 独立抓取，查询层去重
- B. remote_write 远端多副本，防止单点丢历史
- C. 把 alert 规则也双份部署保证通知不重不漏靠 Alertmanager 聚类
- D. 一个 Prom + 定时备份 WAL 文件即可高可用

> 答案：A、B、C
> 解析：D 的备份粒度太粗且恢复期监控真空；标准答案是"双活抓取 + 前端合并"。

### 9. jmx_exporter 适用的典型场景包括（多选）？（9分）

- A. 十年老应用无 micrometer 依赖，也不想改代码
- B. WebLogic/ websphere 等商业中间件
- C. Spring Boot 3 新应用的标准接入
- D. 只能拿到 JMX MBean 的一切进程

> 答案：A、B、D
> 解析：C 应直接用 micrometer 内嵌端点；jmx_exporter 定位是"无法埋点时的兜底"（javaagent 或 standalone 读 JMX）。

### 10. 简答题：公司从单机 Prometheus 演进到支撑 5000 实例的监控平台，请给出发现、治理、存储三层方案。（40分）

- 要点1：发现层——K8s SD + 注解约定 + relabel keep 白名单，目的：targets 随发布自动伸缩且无关端点不入库
- 要点2：治理层——labeldrop 去高基数、modulus 抽样抓非核心服务、exporter 按 collector 白名单裁剪，结果：总序列数控制在容量内（说明：先算单实例序列×5000 再定阈值）
- 要点3：存储层——双 Prom 抓取 + remote_write 到 Mimir/Thanos，查询走 Query 层全局视图，历史进对象存储并降采样
- 要点4：告警链路——Prom 规则 → Alertmanager 集群（去重分组），说明：监控存储高可用不等于通知高可用，两条链路都要冗余
- 要点5：反例——沿用单机 Prom 只调大保留期，输出：磁盘 IO 与内存索引在 30 万序列后全面劣化，抓取延迟分钟级

> 答案：见要点
> 解析：考察"发现自动化→基数治理→分布式存储"的演进主线，任何一层缺失都会在规模下爆雷。
