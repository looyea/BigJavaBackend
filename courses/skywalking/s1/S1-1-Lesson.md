# SkyWalking 架构与探针原理

> 本节难度：★★★★☆
> 本节重要性：★★★☆☆
> 学习产出：掌握 SkyWalking OAP/Agent/UI/存储四大组件、字节码增强机制与 Segment-Span 数据模型。

## 一、整体架构

```text
Agent(探针) ──gRPC──> OAP Server(分析平台) ──> 存储(H2/ES/BanyanDB) ──> UI
     │                      │
  字节码增强            流式计算：采样→解析→聚合(1s/10s/1m/10m/30m 多窗口)
     │                      │
  Metrics/Log/Event 双向 gRPC —— Agent 与 OAP 间是"上报+指令"双通道
```

- OAP 无状态可水平扩展：多实例各管一部分 Agent 上报，聚合结果写共享存储。
- 接收器（Receiver）插件化：Trace/Metric/Log/Event 各走独立 channel，可单独开关。

## 二、Agent：字节码增强 + 插件化

```text
原理与 OTel Java Agent 同族：premain + ByteBuddy 在类加载时织入拦截器。
插件按"target class + method"声明增强点：
  apm-sniffer/apm-sdk-plugin/   ← 官方 90+：spring-mvc、dubbo、mysql、kafka...
  bootstrap-plugins/            ← HttpURLConnection 等 JDK 原生
  optional-plugins/             ← 默认关：spring-annotation、gRPC 手动开关类
配置驱动：agent.config / 环境变量 SW_AGENT_NAME、SW_COLLECTOR_BACKEND_SERVICES
```

```properties
# 目的：容器内启动订单服务探针
SW_AGENT_NAME=order-service            # 输出：服务名（UI 拓扑的节点标识）
SW_AGENT_NAMESPACE=trade-prod          # 说明：命名空间隔离多环境共用一套 OAP
SW_COLLECTOR_BACKEND_SERVICES=oap-sw:11800   # gRPC 通道（11800 数据 / 8080 HTTP）
# 错误用法：所有环境不设 namespace 且同名 → 预发流量混进生产拓扑（排障灾难）
```

- 上下文缓存：一个 Trace 内已增强的类不会重复转换（结果：典型性能损耗 3%~5%）。
- 忽略噪音：`SW_TRACE_IGNORE_PATHS=/actuator/*,/health` 正则过滤探活端点。

## 三、数据模型：Trace → Segment → Span

```text
Trace   : 一次请求全局标识（TraceId）
Segment : 一个 JVM 线程内的一段调用序列 —— 注意是"线程"粒度，不是"进程"粒度！
Span    : Segment 内的具体调用/方法（Entry 入口 / Exit 出口 / Local 本地）

跨进程：上游 Exit Span ──sw8 Header──> 下游 Entry Span（parentSegmentId 指向源 Segment）
线程跨越：@TraceCrossThread / 包装 Runnable 传递 Context（同 OTel 的线程池问题）
```

```text
sw8 Header 字段（压缩为单 Header）：
采样标志-TraceId-ParentSegmentId-ParentSpanId-Service名-实例名-Entity(端点)
目的：一次 HTTP/RPC 携带完整因果，下游 Segment 据此挂接。
错误示例：网关剥离自定义 Header 白名单没放行 sw8 → 链路在网关后集体断链。
```

## 四、OAP 分析流水线

```text
Receiver 解码 → Record（Source）→ Aggregation（多精度窗口预计算指标）→ Storage 插件写入
同时：Metrics → Alarm 规则评估；Trace → 慢 SQL/服务拓扑分析器
特点：指标不是抓来的，而是从 Trace 流"算出来"的 —— 所以 UI 各层级指标与链路天然同源。
```

## 五、存储选型

| 存储 | 适用 | 说明 |
|------|------|------|
| H2 | 开发/演示 | 零依赖，重启丢数据 |
| Elasticsearch | 生产中大规模 | 需调分片与 TTL，最常用 |
| BanyanDB | 官方新选择 | 为 SW 专用设计，运维面小 |
| MySQL | 不推荐生产 | 高写入下表现差 |

## 六、关联技术

- SkyWalking 原生支持接收 OTLP 数据（协议可插拔），与 OpenTelemetry 章节互望。
- `probe_status` / Agent 日志 `skywalking-debug` 输出增强失败详情——插件冲突第一排查点。
- 下一小节：服务拓扑与 LAL 日志分析——数据进来之后 UI 上看到什么。
