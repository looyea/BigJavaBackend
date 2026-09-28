# 与 SkyWalking/Prometheus 的关系（关联） · 小测

### 1. OpenTelemetry 与 SkyWalking 的本质区别是？（6分）

- A. OTel 是标准+采集工具链（无存储/UI），SW 是开箱即用 APM 产品
- B. OTel 只能采指标
- C. SW 不能接收 OTel 数据
- D. 两者完全等价

> 答案：A
> 解析：OTel 负责"采与传"，存储分析交给后端；SW 自带 OAP+存储+UI。

### 2. Prometheus 覆盖的信号类型是？（6分）

- A. Trace
- B. Log
- C. 仅 Metric
- D. 三支柱全覆盖

> 答案：C
> 解析：Prom 只做指标；Trace/Log 需搭配 Tempo/Jaeger、Loki/ES。

### 3. SkyWalking 的 sw8 Header 在 OTel 中对应的概念是？（6分）

- A. Baggage
- B. traceparent（W3C 传播上下文）
- C. Prometheus exemplar
- D. OTLP 帧头

> 答案：B
> 解析：sw8 携带 trace 身份与采样位，语义与 traceparent 同族，可互相映射。

### 4. OTel Collector 向 Prometheus 供数的"最稳"方式是？（6分）

- A. 让 Collector 直接写 Prom 的 TSDB 文件
- B. Collector 用 prometheus exporter 暴露端点，由 Prom 照常 scrape
- C. 用 Kafka 转发指标文本
- D. Prom 无法接 OTel 数据

> 答案：B
> 解析：保留 pull 模型与现有 PromQL/告警生态，改动最小；OTLP push 也支持但需开特性开关。

### 5. OTLP 指标推送原生 Prometheus 时常见的静默失败原因是？（6分）

- A. 端口冲突
- B. 未启用 --enable-feature=otlp-write，请求被 404 拒掉
- C. 指标名太长
- D. Prom 不支持 UTF-8

> 答案：B
> 解析：特性开关未开时 OTLP 端点不存在，Collector 侧若吞错则指标"看起来在采其实全丢"。

### 6. 迁移后 P99 直方图曲线出现"跳变"，最可能的原因是？（6分）

- A. 网络抖动
- B. OTel SDK 默认桶与旧 Prometheus 埋点桶不一致
- C. Grafana 缓存
- D. 采样率变化

> 答案：B
> 解析：histogram_quantile 依赖桶边界，桶不同同一数据算出的分位数自然错位。

### 7. Exemplars 机制的作用是？（6分）

- A. 压缩指标
- B. 在指标数据点上附带 traceId，实现 Metric→Trace 一键跳转
- C. 自动扩缩容
- D. 生成告警

> 答案：B
> 解析：Prom 2.26+ 支持；点击毛刺曲线点直接打开对应 Trace，是打通两支柱的关键。

### 8. 关于 OTel 与既有 APM 共存，正确策略有（多选）？（9分）

- A. 新服务 OTel、老服务保留原 Agent，双协议并收
- B. Collector 作统一入口，按信号分发到不同后端
- C. 必须先全量替换所有埋点才能上 OTel
- D. 统一指标命名与桶定义后再切查询面板

> 答案：A、B、D
> 解析：C 是典型反例——一次性全量替换风险高、周期长，极易烂尾。

### 9. 以下组件属于"LGTM 栈"的有（多选）？（9分）

- A. Loki
- B. Grafana
- C. Tempo
- D. MinIO

> 答案：A、B、C
> 解析：L=Log、G=展示、T=Trace(Tempo)、M=Metric(Prometheus/Mimir)；MinIO 是对象存储不属于该栈。

### 10. 简答题：公司已有 SkyWalking 全量埋点与 Prometheus 告警，现引入 OTel，请给出共存架构与三步迁移计划。（40分）

- 要点1：架构——OTel Collector 作为统一接入层，OTLP 入；Trace 双写 SW 与 Tempo 灰度对比，Metric 经 prometheus exporter 由现有 Prom scrape，说明：现有告警零改动
- 要点2：第一步新服务强制 OTel Agent，老服务 sw8 不拆迁，双协议并收，结果：无停摆窗口
- 要点3：第二步统一语义：指标命名、直方图桶、exemplar 开关对齐，目的：消除切换期面板跳变
- 要点4：第三步老服务按域逐批改 OTel，SW UI 保留至团队确认新链路排障效率不回退，反例：第一刀就拿核心交易链路上实验，输出事故
- 要点5：全程用采样后的对拍任务比较新旧 Trace 完整率与 RT 指标偏差，作为放量依据

> 答案：见要点
> 解析：考察"标准 vs 产品"边界认知与渐进式迁移的工程判断。
