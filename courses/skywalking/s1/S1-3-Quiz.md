# 与 OpenTelemetry 集成及选型（关联） · 小测

### 1. SkyWalking OAP 接收 OTel 数据的协议是？（6分）

- A. 只支持 sw8 私有协议
- B. OTLP（gRPC/HTTP）receiver 原生支持
- C. 必须经 Kafka 中转
- D. 不支持

> 答案：B
> 解析：receiver-otel 开启后 OTLP Trace/Log/Metric 直入 OAP 流水线。

### 2. 只开 OTLP trace receiver 但 UI 看不到数据，常见原因是？（6分）

- A. 网络慢
- B. 未配置 OTel 流量的服务识别/analyzer 定义，数据被静默丢弃
- C. 浏览器缓存
- D. UI 版本太低

> 答案：B
> 解析：OAP "收得下"还要"认得出"——服务名、层级映射缺失等于没有可分析对象。

### 3. 混编链路（SW Agent 服务 + OTel SDK 服务）最容易出的问题是？（6分）

- A. 性能下降
- B. sw8 与 traceparent 传播格式不互认导致断链
- C. 存储格式冲突
- D. 采样率不一致

> 答案：B
> 解析：边界必须做双格式注入/转换（CompositePropagator 或统一收敛 W3C）。

### 4. OTel Collector 向 SkyWalking 送 Trace 可用哪些 exporter？（6分）

- A. 只能用 skywalking exporter
- B. otlp exporter（指 OAP）或 skywalking exporter 均可
- C. 只能 prometheus exporter
- D. 必须自写插件

> 答案：B
> 解析：OAP 双通道都能收；新部署优先标准 OTLP 通道。

### 5. "无专职平台团队、Java 技术栈为主、要求两个月内上线全链路监控"，更合理的选型是？（6分）

- A. 自建 OTel + Tempo + Mimir + Grafana 全家桶
- B. SkyWalking 一体化 APM
- C. 只上 Prometheus
- D. 买商业 SaaS 不考虑成本随便选

> 答案：B
> 解析：产品化能力（拓扑/告警/UI/探针）开箱即用匹配时间与人力约束；A 的自建成本被低估是常态。

### 6. 迁移期"双写对拍"的目的是？（6分）

- A. 节省存储
- B. 验证新旧链路数据完整性与指标口径一致后再切读路径
- C. 提高采样率
- D. 兼容两种 Header

> 答案：B
> 解析：写侧双份无感、读侧灰度切换，偏差量化达标（如 <2%）才拆除旧链路。

### 7. 关于"标准 vs 产品"的说法最准确的是？（6分）

- A. OTel 会淘汰所有商业 APM
- B. OTel 统一采集与传播层，存储分析层产品继续竞争
- C. SW 与 OTel 互斥
- D. 产品都原生兼容 OTel 无需验证

> 答案：B
> 解析：分层看：采集层标准化是确定趋势，分析/体验层仍是产品差异化战场（结果：后端可换、埋点不重写）。

### 8. 以下哪些属于 SW → OTel 迁移检查项（多选）？（9分）

- A. 语义约定映射表（端点/服务/层级）评审
- B. 新旧指标数值对拍（cpm/P99 偏差量化）
- C. 告警规则逐条平移并并行静默观察
- D. 迁移当天删除全部旧探针与旧数据

> 答案：A、B、C
> 解析：D 违反渐进原则——旧数据保留到观察期结束，回滚窗口是保命符。

### 9. 关于传播格式收敛路径，可行的有（多选）？（9分）

- A. 新服务一律 OTel Agent（traceparent），存量 SW Agent 保持，边界网关双注入
- B. 强推所有服务同时换探针，一周完成
- C. SW 侧开启 OTLP 接收，让非 Java 服务先行 OTel 化
- D. 先统一 Collector 接入层，后端保留 SW/Tempo 双写过渡

> 答案：A、C、D
> 解析：B 是"一步到位"反例（断链+技能断层双风险）；A/C/D 都是按边界渐进的正解。

### 10. 简答题：公司现全量 SkyWalking，业务多语言化（Go/Python 占比升至 40%）后监控出现盲区，请给出架构演进方案与三阶段计划。（40分）

- 要点1：诊断——非 Java 无 SW 探针是盲区根因；方案基调"SW 保产品层、OTel 补采集层"（说明不推翻现有投资）
- 要点2：阶段一——OAP 开 OTLP receiver，Go/Python 服务接 OTel SDK/Agent，出口统一 OTLP 进 SW，结果：盲区消除且拓扑统一
- 要点3：阶段二——部署 OTel Collector 作为接入层（边缘汇聚/鉴权/纠偏），Java 侧评估从 SW Agent 切 OTel Agent 的兼容性矩阵
- 要点4：阶段三——视平台团队产能决定终态：维持 SW 后端（默认）或引入 Tempo 双写对拍一个季度后切换（数据说话）
- 要点5：全程约束：传播格式统一 W3C（边界服务双 Header 过渡）、告警与值班手册同步更新、旧链路观察期后才下线（反例：提前拆旧 = 无回滚）

> 答案：见要点
> 解析：考察"标准与产品分层"认知 + 渐进式架构演进节奏感，选型题的高配答法。
