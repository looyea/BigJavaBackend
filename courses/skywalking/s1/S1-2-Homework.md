# 服务拓扑、指标与分析、告警 · 作业

## 作业 1：三级指标下钻演练

**目标**：用演示流量复现"面→点→接口"排障路径。

1. 生成压测流量：3 服务链 + 故意让 order 服务某实例注入 20% 错误与 800ms 延迟。
2. 从 Global Dashboard 找到 SLA 异常服务 → 实例视图圈定坏实例 → 端点视图定位受影响接口，记录每层看到的指标名（输出下钻截图描述）。
3. 对该端点过滤 error Trace，验证 Span 内异常日志堆栈可见。
4. 思考：如果错误只发生在"每周批处理新上线的实例"，哪一层最先暴露？写 3 行答案。

## 作业 2：拓扑完整性验证

**目标**：让拓扑图"一个节点都不少"。

1. 链路包含：探针服务 A → 探针服务 B → 未装探针的第三方 HTTP（用 WireMock 模拟）+ MySQL + Kafka。
2. 验证拓扑：MySQL/Kafka 以组件节点出现、第三方 HTTP 以 Virtual Service 出现，边上 cpm/avg 延迟有值（说明各节点来源机制）。
3. 打开 Instance Topology 对比服务拓扑差异，解释何时该看实例级拓扑。
4. 反例：把 A 调第三方的 URL 写死 IP 且用原生 HttpURLConnection 且未开对应插件 → 依赖从拓扑消失，讨论补救（开 agent http 插件或手工 Event 标注）。

## 作业 3：LAL + 告警闭环

**目标**：从日志造一个指标并对它告警。

1. 应用打印结构化日志 `PAY_FAIL CODE:5101 channel=abc`；配 LAL 规则提取 CODE 维度生成 `pay_fail_cpm`。
2. UI Metrics _explorer 查询该指标确认有数（输出曲线）。
3. alarm-settings.yml 增加规则：`pay_fail_cpm > 50`（period 5 / silence 3），webhook 指向本地 echo 服务。
4. 压入故障日志触发告警，修改为经 adapter 转发 Alertmanager 验证统一通知链（结果：AM 里看到带 sw_ 前缀标签的告警）。
