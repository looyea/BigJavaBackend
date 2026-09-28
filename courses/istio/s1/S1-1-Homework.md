# 控制面/数据面与 Sidecar 注入 · 作业

## 作业 1：minikube + Istio 入门闭环

**目标**：完成"装-注入-观察"三步。

1. `istioctl install --set profile=demo`，部署 bookinfo 四服务，namespace 打标后 `kubectl get pod -o jsonpath` 验证每个 Pod 有 2 个容器（输出 istio-proxy 镜像版本）。
2. productpage 发起请求，`istioctl pc clusters deploy/productpage-v1 --cluster` 过滤出 reviews 集群（说明 EDS endpoint 数与 subsets）。
3. 给 ratings 加注解 `sidecar.istio.io/inject: "false"` 并重建 Pod → 观察拓扑里 ratings 变"无 sidecar"节点，结果：它仍可被访问但失去 mTLS/指标。
4. 记录 `istioctl analyze` 在你所有操作中的输出变化（至少捕捉一次 warning 并解释）。

## 作业 2：iptables 拦截取证

**目标**：看见"流量如何进 Envoy"。

1. `kubectl exec details-v1 -c istio-proxy -- istioctl-experimental proxy-config` 或进入应用容器 `iptables -t nat -L -n`（debug 镜像）。
2. 找出 OUTPUT 链跳 ISTIO_OUTPUT、15001/15006 REDIRECT 规则与豁免网段（说明每条目的）。
3. 用 `istioctl pc listen deploy/details-v1` 对照 listener 端口（15006/15001/15021/15090）。
4. 实验：临时给某 Deployment 加 `excludeOutboundIPRanges` 排除其依赖的镜像仓库网段，验证直连不再被代理（输出 tcpdump 或连接日志对比）。

## 作业 3：启动竞态与豁免清单

**目标**：处理两个高频生产问题。

1. 复现：sidecar 未 ready 时应用启动即调外部 API 失败（无代理就绪）→ 开启 `holdApplicationUntilProxyStarts=true` 验证修复，说明原理。
2. 一个 Pod 内日志 agent 容器疯狂出网被代理拖慢：给出两种方案（注解排除端口 / 该容器移出网格到独立 Pod），从隔离性与运维成本论证选择（输出决策理由）。
3. 验收互查：同伴用 `istioctl pc endpoint` 确认你排除的网段确实走了 passthrough（结果：cluster 里出现 Original Destination）。
