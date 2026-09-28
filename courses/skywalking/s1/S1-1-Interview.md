# SkyWalking 架构与探针原理 · 面试题

## 题 1：为什么 SkyWalking 用 Segment 而不是 OTel 那样直接 Span 树？

```text
SW：Agent 把一个线程内的 Span 批量打包成 Segment 一次性上报 ——
  好处：上报次数少、段内顺序天然确定（无需每个 Span 单独发）。
OTel：Span 结束即导出（可批处理），父子靠 span_id/parent_id 全局关联。
结果：SW 的 UI 排障以"段"为单位展开，断链表现为 refs 缺失；两种模型可无损互转。
```

## 题 2：Agent 如何做到不改一行业务代码？增强失败怎么排查？

- premain 注册 ClassFileTransformer，插件声明式定义目标类/方法，ByteBuddy 织入拦截器（before/after 创建关闭 Span）。
- 失败排查：`config/agent.log` 与 debug 模式看 transformer 冲突；`/probe/alive` 与 UI 实例列表确认上报；最常见根因 = JDK 版本或框架版本超出插件兼容矩阵（结果：静默不增强）。
- 与其他 Agent（APM/热部署工具）共存时 transformer 执行顺序可能互踩，需要单 Agent 原则。

## 题 3：sw8 与 traceparent 能共存吗？异构系统怎么接？

- 能：服务网格/网关层可同时注入两种 Header；非 Java 侧常用 OTel SDK 出 OTLP。
- OAP 支持多协议接收（native + OTLP + Zipkin + Jaeger），同一 Trace 内混编服务可关联——前提是每条链路只有一种传播格式贯穿，边界服务负责转换（错误示例：中间服务只透传其中一种，另一种在第二跳丢失）。

## 题 4：OAP 多实例部署时，一条 Trace 的 Segment 落在不同 OAP 实例会有问题吗？

- 不会：Segment 只是写入流，各自解析后都落共享存储（ES/BanyanDB），查询时按 TraceId 聚合。
- 真正敏感的是"指标聚合窗口"：各实例独立预聚合再靠 MQ/存储合并（集群模式默认用 MQ 协调聚合），所以分钟级指标可能有秒级抖动。
- 说明：这也是 SW 与"尾部采样必须按 traceId 路由"的 OTel Collector 架构差异点。

## 题 5：采样的 Trace 会影响服务拓扑与 SLA 指标吗？

- 不影响（设计使然）：Metric 通道独立上报（服务级 counters 不依赖每个请求被采样），拓扑边与 SLA 基于 metric 流构建。
- 结果：3% 采样下 P99 等分位仍有统计意义，但极端长尾样本可能恰好没被采到——深度排障时临时拉高采样是标准动作。
- 反例认知：以为"采样=丢弃一切"而不敢开采样，导致全量存储压垮 ES（错误做法）。

## 题 6：从架构师视角评价 SkyWalking 的选型边界。

```text
适合：Java 为主、要"开箱即用全栈 APM"（Trace+Metric+Log+拓扑+告警一体）、私有化部署。
边界：
1. 指标查询语言非 PromQL —— 与既有 Prom/Grafana 体系融合需 exporter 桥接；
2. 强探针模式，非 JVM 语言生态覆盖弱于 OTel；
3. ES 存储成本随 Trace 量线性涨，超大规模需精细化采样与 TTL 治理。
追问"和 OTel 冲突吗"：不冲突 —— SW 可作为 OTLP 后端之一，标准归标准、产品归产品。
```
