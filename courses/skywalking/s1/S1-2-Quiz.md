# 服务拓扑、指标与分析、告警 · 小测

### 1. SkyWalking 三级指标模型的正确下钻顺序是？（6分）

- A. Endpoint → Service → Instance
- B. Service → ServiceInstance → Endpoint
- C. Instance → Endpoint → Service
- D. Service → Endpoint → Cluster

> 答案：B
> 解析：先看服务面异常 → 下钻实例定位坏机器 → 下钻端点定位坏接口，再跳 Trace。

### 2. 服务拓扑图的数据来源是？（6分）

- A. 用户手工配置依赖关系
- B. 从 Trace 引用关系与调用指标流自动聚合
- C. 读取注册中心依赖清单
- D. K8s Service 对象

> 答案：B
> 解析："拓扑是长出来的不是配出来的"——未装探针第三方以 Virtual Service 补全节点。

### 3. 新上线接口多久出现在端点（Endpoint）指标中？（6分）

- A. 立即（推送式）
- B. 端点集合按周期（默认约 15 分钟刷新窗口）从 Entry Span 自动发现
- C. 需要重启 OAP
- D. 手动登记

> 答案：B
> 解析：operationName 收集 + 周期性刷新；刚上线查不到端点属正常现象（说明等待窗口）。

### 4. 想知道"哪个实例拖慢了服务 P99"，应看哪层指标？（6分）

- A. service_resp_time
- B. service_instance_* 指标（实例层 percentile/SLA 对比）
- C. database_access_error_rate
- D. LAL 日志计数

> 答案：B
> 解析：实例级下钻是三级模型的核心价值；单边热点机器的 GC/资源问题在此现形。

### 5. LAL（Logging Analytics Language）的能力边界是？（6分）

- A. 只做日志全文检索
- B. 从日志流提取维度并聚合生成新指标（可被告警引用）
- C. 生成 Trace
- D. 替代 ES 存储

> 答案：B
> 解析：watch→filter→detector→aggregation 管道，产物是 Metrics；检索仍归日志查询页。

### 6. alarm 规则里 silence-period 的作用相当于 Prometheus 的什么？（6分）

- A. for
- B. Alertmanager 的 group_interval/repeat 抑制思路（触发后静默窗口防轰炸）
- C. scrape_interval
- D. retention

> 答案：B
> 解析：period 是评估窗口、silence 是重复通知抑制 —— 两个概念别混。

### 7. 想把 SW 告警接入公司统一通知中心（Alertmanager），最合适的做法是？（6分）

- A. 轮询 UI 截图
- B. 配置 webhook 插件推给 AM 的 alertmanager receiver 兼容端点（或经 exporter 转换）
- C. 关闭 SW 告警全用 Prom
- D. 改 OAP 源码

> 答案：B
> 解析：SW webhook 消息转 Prom Alertmanager 格式（现成 adapter 组件），实现单通知出口。

### 8. 以下哪些属于 SkyWalking 开箱即用的分析能力（多选）？（9分）

- A. 慢 SQL 语句耗时榜
- B. 线程级 Profiling 火焰图（按需触发）
- C. 自动生成 PromQL 告警语句
- D. 发布事件标注在指标曲线上（Event 机制）

> 答案：A、B、D
> 解析：C 不属于——SW 指标查询走自有 MQ 语法，PromQL 是 Prometheus 世界。

### 9. 日志与 Trace 关联的正确姿势包括（多选）？（9分）

- A. GRPCLogClientAppender 直报 OAP，随 TraceId 关联
- B. FileCollector 采集日志文件并按 pattern 提取 traceId 关联
- C. 把 traceId 打进 MDC 后自行只存本地文件，不上传
- D. 日志里保留 sw8 上下文（同线程），异步场景用 toolkit 包装

> 答案：A、B、D
> 解析：C 日志不出机器，UI 无法跳转查询（等于没关联）；A/B 是官方两条通路。

### 10. 简答题：大促值班发现"支付服务 SLA 从 99.9% 跌到 96%"，写出基于 SkyWalking 的完整定位动线与各步依据。（40分）

- 要点1：服务层确认——service_sla/service_cpm 曲线核对告警窗口，看流量是否突增（目的：区分容量型与故障型）
- 要点2：实例层——service_instance_sla 对比：全部实例均匀下跌=依赖问题，单实例暴跌=机器/GC 问题（结果分叉判断）
- 要点3：端点层——endpoint 排序找最慢/错误集中接口，锁定 /pay/create
- 要点4：Trace 层——过滤该端点 error/slow Trace 样本：看瀑布中哪个 Exit Span 超时（DB？下游银行网关？）
- 要点5：关联证据——慢 SQL 榜、Event 页核对同窗发布记录、LAL 的 payment_error_cpm 按错误码分布（说明多渠道交叉验证）
- 要点6：处置——若第三方银行渠道劣化：触发降级预案并在 SW 打 Event 标记，输出 MTTR 复盘素材（拓扑截图+Trace 样例）

> 答案：见要点
> 解析：考察"三级指标逐层收窄 + Trace 取证 + 事件/日志交叉"的标准 APM 排障方法论。
