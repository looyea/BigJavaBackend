# 与 OpenTelemetry 集成及选型（关联） · 作业

## 作业 1：OTLP 通道打通

**目标**：让 OTel 发出的 Trace 在 SkyWalking UI 可见。

1. OAP 开启 receiver-otel 的 otlpGRPC traces；起 OTel Collector 配 `otlp` exporter 指向 :11800。
2. Go 服务接 OTel SDK（或 OTel Agent 挂 Java demo），发请求 → SW UI Trace 列表出现该服务（输出服务名解析结果验证）。
3. 故意不配置 service 归组规则 → 复现"数据到了但 UI 不可见"，对照 OAP 日志说明丢弃点。
4. 记录 sw8 通道与 OTLP 通道各一条 Trace 的字段差异（span 命名/标签），总结映射损耗。

## 作业 2：混编链路断链实验

**目标**：亲手验证传播格式边界问题。

1. 拓扑：SW Agent 服务 A → OTel 服务 B → SW Agent 服务 C（B 只透传 traceparent）。
2. 复现：A→B 断链（B 不认 sw8 生成新 Trace）、B→C 断链（C 不认 traceparent）。
3. 修复：B 引入 CompositePropagator（tracecontext + sw8 扩展），C 升级/配置支持读取 traceparent（或 B 出口重新注入 sw8）。
4. 验收：一条完整 Trace 贯穿三种探针，输出 Trace 树截图描述与每跳 Header 内容。

## 作业 3：选型建议书（文字输出）

**目标**：为一虚构公司（80 人 Java + 20 人 Go，无平台组，合规要求私有化）写一页选型建议。

1. 用本课决策框架逐项打分（团队画像/查询自由度/锁定风险/运维成本/时间约束）。
2. 给出明确结论与保留条款（如"两年后若成立平台组再评估 OTel 收敛"）。
3. 必须包含：被否方案与否决理由（至少 2 条）、迁移风险提示 1 条（反例引用）。
4. 互评：按"结论是否有决策依据支撑"给其他同学的建议书挑一处逻辑漏洞（输出批注）。
