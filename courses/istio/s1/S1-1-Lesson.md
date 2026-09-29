# 控制面/数据面与 Sidecar 注入

> 本节难度：★★★★☆
> 重要程度：★★★☆☆
> 学习产出：理解 Istio 控制面（istiod）与数据面（Envoy）职责划分、Sidecar 自动注入与流量拦截机制。

## 一、两大面的分工

```text
数据面 = Envoy 代理集群：所有进出应用的流量经过它 —— 路由/重试/熔断/mTLS/遥测都在这执行。
控制面 = istiod（pilot+galley+citadel 合体）：
  - 配置校验与下发（xDS 协议经 15012 控制通道推给每个 Envoy）
  - 证书签发（mTLS 身份）
  - Sidecar 注入的 Webhook
结果：策略改一行 YAML，秒级生效到全部 Pod —— 应用零重启零改码。
```

## 二、Sidecar 注入机制

```yaml
# 目的：命名空间打标 + Pod 注解 → 创建时自动注入 istio-proxy 容器
kubectl label namespace prod istio-injection=enabled
# 错误用法：打完标不重启存量 Pod → 旧 Pod 仍无 sidecar，流量行为不变（需 rollout restart 才生效）
```

```yaml
# Pod 注解精细控制（目的：按工作负载豁免或强制）
metadata:
  annotations:
    sidecar.istio.io/inject: "false"       # 结果：该 Pod 不进网格（批处理任务常用）
    traffic.sidecar.istio.io/excludeOutboundPorts: "3306"  # 说明：DB 直连旁路代理
```

- 流程：API Server 收到 Pod CREATE → MutatingAdmissionWebhook 调 istiod → 原 spec 追加 `istio-proxy` 容器与 initContainer → 持久化。
- 注入的是"spec 改写"，不是运行时挂载 —— 已运行 Pod 不会因改名存而补注入（常见误区，需 rollout restart）。

## 三、流量怎么被"劫持"进 Envoy

```text
initContainer(istio-init) 执行 iptables 规则：
  OUTPUT 链: 应用出网流量 → REDIRECT 15001（Envoy outbound listener）
  INPUT  链: 进 Pod 流量   → REDIRECT 15006（Envoy inbound listener）
例外：15020(健康检查)/15021 等端口直通，防死循环。
错误示例：应用监听 15001 端口 → 与 Envoy 冲突，Pod 起不来（端口保留清单要背）。
```

- 多容器 Pod：网络命名空间共享 → 所有容器的流量都被同一个 sidecar 接管（含没代码的定时脚本容器）。
- 探针直连问题：K8s livenessProbe 从 kubelet 发来曾被误计为网格流量 → 现默认 excluded（说明版本差异坑）。

## 四、配置模型速览（CRD 分层）

| 层 | 资源 | 面向 |
|----|------|------|
| 流量 | VirtualService / DestinationRule / Gateway | 路由与目标策略 |
| 安全 | PeerAuthentication / AuthorizationPolicy | mTLS 与 RBAC |
| 可观测 | Telemetry / EnvoyFilter | 遥测与底层定制 |
| 网格内服务 | ServiceEntry / WorkloadEntry | 外部/VM 服务入格 |

- 生效检查三板斧：`istioctl analyze`（配置合法性）→ `istioctl pc routes/listeners <pod>`（下发结果）→ Kiali 拓扑（可视化）。
- EnvoyFilter 是"逃生舱"：xDS 底层直改，滥用会让升级如履薄冰（反例警示）。

## 五、与 K8s 原生的关系

```text
Ingress Controller（南北向 L4/L7 粗路由） vs Istio Gateway（东西向+南北向全功能 Envoy）。
Service（kube-proxy 转发，无重试/熔断/指标粒度） vs DestinationRule（L7 感知治理）。
结论：Istio 不替代 Service —— Service 仍是发现骨架，Envoy 接管数据路径。
错误认知："装完 Istio 自动全有了" —— 不设 VS/DR 时行为与之前几乎无差（只是多了一跳代理）。
```

## 六、关联技术

- Sidecar 资源开销：每 Pod 额外 50~100m CPU/~20Mi 内存起步，大规模时是成本大头（s1-4 专门讨论何时不用）。
- CNI 插件模式可去掉 NET_ADMIN 权限的 initContainer（安全合规场景）。
- 下一小节：VirtualService/DestinationRule —— 金丝雀与流量切分的落地语法。
