# mTLS、可观测与 Ambient 演进 · 作业

## 作业 1：mTLS 迁移全流程

**目标**：把一个 demo 命名空间从默认带到 STRICT 且零断流。

1. 全局保持 PERMISSIVE，`istioctl authn tls-check deploy/productpage-v1`（或指标 `environment_istio_mtls_reason`）列出当前明文对。
2. 修复清单内未注入/豁免的调用方；连续 30 分钟观察该 ns 明文计数为 0（输出截图描述）。
3. ns 级下发 STRICT，回归测试全链路；抓包（tcpdump 于 Pod 网卡）证明 Payload 为 TLS（结果验证）。
4. 反例演练：对一个未注入的 legacy Job 所在 ns 直接 STRICT → 复现连接被拒，记录报错特征（`upstream connect error ... TLS error`）与回滚动作。

## 作业 2：遥测双计数与采样分级

**目标**：让指标口径正确、成本可控。

1. 不加过滤查询 `sum(rate(istio_requests_total[5m]))`，再按 `reported="destination"` 过滤查询，解释两者约 2 倍关系（输出计算）。
2. 配 Telemetry：默认 ns Trace 采样 10%、支付 ns 100%、网关 ns 1%，发起压测验证各 ns span 上报比例（结果）。
3. 开启 accessLog（OTLP 后端到 Collector），确认日志字段含 `connection.mtls` 与 principal（说明：身份可见性是审计基础）。
4. 验收：临时停掉 tracing 后端，验证采样失效但指标/日志不受影响（三支柱管道隔离性）。

## 作业 3：Ambient 模式初体验

**目标**：同集群并跑 Sidecar 与 Ambient，量化对比。

1. 集群启用 Ambient（CNI + ztunnel），namespace 打 `istio.io/dataplane-mode=ambient`，确认 Pod 无 sidecar 容器（`kubectl get pod -o jsonpath` 容器数）。
2. 验证 L4：ztunnel 日志观察 HBONE 建连、抓包确认 Pod 间流量已加密（结果）。
3. 给其中一个服务部署 waypoint，配置一条 VS 路由生效（说明 L7 按需挂载路径）。
4. 输出对比表：同负载下 Sidecar ns 与 Ambient ns 的节点级内存占用、P50 延迟差（每 Pod Envoy 成本被"摊薄到节点"的直观证据）。
