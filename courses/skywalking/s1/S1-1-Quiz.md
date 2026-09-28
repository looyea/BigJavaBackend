# SkyWalking 架构与探针原理 · 小测

### 1. SkyWalking 架构中负责流式分析计算的核心组件是？（6分）

- A. Agent
- B. OAP Server
- C. UI
- D. Envoy

> 答案：B
> 解析：OAP（Observability Analysis Platform）接收上报、聚合多窗口指标、驱动告警与拓扑分析。

### 2. SkyWalking 的 Segment 指的是？（6分）

- A. 一个服务的所有 Span
- B. 一个 JVM 线程内的一段调用序列（Span 集合）
- C. 一次数据库事务
- D. 一个网络分区

> 答案：B
> 解析：Trace=全局、Segment=线程级片段、Span=单调用；跨进程靠 sw8 关联 parentSegment。

### 3. Span 的三种类型是？（6分）

- A. START/END/MIDDLE
- B. Entry/Exit/Local
- C. Server/Client/Internal/Producer/Consumer
- D. Root/Leaf/Branch

> 答案：B
> 解析：Entry=入口（被调）、Exit=出口（主调外部）、Local=内部方法；C 是 OTel 的 SpanKind。

### 4. 跨进程传播上下文依赖什么？（6分）

- A. Cookie
- B. sw8 Header（或 MQ message 的 sw8 属性）
- C. 数据库共享
- D. OAP 内存关联

> 答案：B
> 解析：sw8 单 Header 压缩携带 trace 身份与父子段信息；MQ 场景写入消息属性。

### 5. UI 上的服务指标（SLA/响应时间）数据来自哪里？（6分）

- A. Prometheus 抓取
- B. OAP 从 Trace/Metric 流多窗口聚合计算后写存储
- C. Agent 每秒定时上报快照
- D. 前端实时计算

> 答案：B
> 解析："指标是算出来的不是抓来的"——所以链路与指标天然同源，不会出现两套口径对不上。

### 6. 生产环境推荐存储是？（6分）

- A. H2 内存库
- B. Elasticsearch（或官方面向 SW 设计的 BanyanDB）
- C. MySQL 单库
- D. 不需要存储

> 答案：B
> 解析：高写入 + TTL 过期 + 查询聚合的需求都在；H2 演示、MySQL 撑不住生产写入。

### 7. SW_AGENT_NAMESPACE 的作用是？（6分）

- A. 指定采集频率
- B. 隔离同名服务的不同环境，避免拓扑混淆
- C. 加密上报通道
- D. 采样率命名空间

> 答案：B
> 解析：同套 OAP 服务 dev/prod 时的软租户；错误用法=不设 namespace 同名双环境（结果：串数据）。

### 8. 关于 SkyWalking Agent 的性能与增强，正确的有（多选）？（9分）

- A. 采用 premain + ByteBuddy 类加载期增强，与 OTel Agent 机制同族
- B. optional-plugins 默认关闭，按需开启可进一步降开销
- C. 增强后的类在每次请求都重新做字节码转换
- D. 可用 IGNORE_PATHS 过滤健康检查等噪音端点

> 答案：A、B、D
> 解析：C 错误——类转换只发生在加载期一次，且有 TracingCache 缓存上下文状态。

### 9. 链路在网关后全部断裂成独立 Trace，可能原因包括（多选）？（9分）

- A. 网关未放行/剥离了 sw8 Header
- B. 网关服务未装探针且未做上下文透传
- C. Elasticsearch 磁盘满
- D. 网关用了独立线程池异步转发且未做跨线程增强

> 答案：A、B、D
> 解析：C 影响的是存储与查询，不会造成"新 TraceId"；断链一定是传播层问题。

### 10. 简答题：画出/描述一次 Dubbo 调用 A→B→MySQL 在 SkyWalking 中的 Trace-Segment-Span 结构与 sw8 传递过程。（40分）

- 要点1：A 服务一个 Segment：Entry Span（dubbo provider 入口）+ Exit Span（发起对 B 的调用）+ Exit Span（JDBC 执行 SQL），说明：同线程同段
- 要点2：A→B 时把 sw8 写入 RpcContext attachment：采样-TraceId-SegmentA-SpanId(A的exit)-serviceA-instanceA-endpointA，目的：下游可挂接父段
- 要点3：B 侧新 TraceContext 新建 SegmentB，收到请求创建 Entry Span，记录 refs{parentSegment=SegmentA, parentSpanId}，结果：两 Segment 一 Trace
- 要点4：B→MySQL：B 的 Segment 内新增 Exit Span（mysql 插件捕获 statement），耗时计入 B 的 SLA
- 要点5：OAP 按 TraceId 聚合三段数据渲染拓扑与瀑布；若 refs 缺失（Header 被剥）则 UI 显示两条独立 Trace——这就是断链的判定依据

> 答案：见要点
> 解析：Segment 模型与 sw8 挂接机制是 SkyWalking 面试的核心区分点。
