# Linkerd 架构与极简数据面 · 作业

## 作业 1：最小网格落地与体检

**目标**：在 kind/minikube 上装 Linkerd 并让一个 Spring Boot 服务进网格。

1. `linkerd install | kubectl apply -f -` → `linkerd check` 全绿（输出：逐项 PASS）。
2. 部署 order-svc 后 `linkerd inject` 重建 → `linkerd -n default top deploy/order-svc` 看到 RPS/延迟/P99（结果：零配置即得遥测）。
3. 故意把 Service 端口名写成 `tcp-orders` 而服务实为 HTTP → 观察指标退化为 TCP 聚合（错误用例：协议名误配）。
4. 改回 `http-orders` → 路由级指标恢复。

## 作业 2：ServiceProfile 重试语义验证

**目标**：证明"sidecar 重试"与"应用不感知"。

1. 为 orders 定义 GET 路由 `isRetryable: true, timeout: 500ms`。
2. 用 toxiproxy/延迟注入让下游 GET 首次超时 → 客户端仍快速成功（说明：代理层重试兜住）。
3. 给 POST 路由误开 isRetryable → 重复下单复现 → 立即回滚该配置（反例体验）。

## 作业 3：资源账单对比

**目标**：量化 Linkerd sidecar 与 Istio sidecar 的开销差。

1. 同负载压测，`kubectl top pod` 采样 linkerd-proxy 与（另一集群）istio-proxy 内存/CPU。
2. 记录每 Pod 边际成本 × 集群 Pod 数 → 得出网格总开销账单（输出：数量级差异结论）。
