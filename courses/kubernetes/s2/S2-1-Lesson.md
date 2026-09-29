# Service 四种类型、Ingress 与 DNS

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：掌握 ClusterIP/NodePort/LoadBalancer/Headless 四种 Service 的适用边界，理解 Ingress 的七层入口模型与 kube-proxy 数据路径，能解释集群内 DNS 名称解析全过程。

## 一、Service：给"牛马 Pod"一个稳定门牌

```yaml
apiVersion: v1
kind: Service
metadata: { name: shop-order }
spec:
  type: ClusterIP                # 默认：仅集群内可达的虚拟 IP（由 kube-proxy 实现转发）
  selector: { app: order }       # 目的：靠 label 选中一组 Pod，Pod 增删/IP 变化对它透明
  ports: [ { port: 8080, targetPort: 8080 } ]
# service 的 ClusterIP 是"虚拟 IP"：ping 不通、不在任何网卡上，由每条转发规则实现（异常预期：按传统 IP 思维排查会懵）
```

- readiness（s1-3）决定哪些 Pod 进 EndpointSlice：Service=门牌+负载均衡，端点名单由探针把关（两节在此咬合）。

## 二、四种类型一张表

| 类型 | 可达范围 | 典型用途 | 注意点 |
|------|----------|----------|--------|
| ClusterIP（默认） | 仅集群内 | 服务间调用、内部中间件 | 最常用，不出集群 |
| NodePort | 每节点 IP:30000-32767 | 配合外部 LB/调试 | 端口范围有限、安全组要放行 |
| LoadBalancer | 云厂商 LB 转发到 NodePort | 云内四层暴露单服务 | 一个服务一个 LB=贵且慢 |
| Headless（clusterIP: None） | DNS 直接返回 Pod IP 列表 | StatefulSet、客户端负载均衡（gRPC 长连接） | 无虚拟 IP，消费方自己管端点 |

```bash
# gRPC 场景为何要 Headless：LB 会把长连接一直哈希到同一后端，扩容的实例分不到流量（结果：HPA 白扩）
# Headless + 客户端 LB（如 Spring Cloud LoadBalancer/grpc 原生）才能感知全部 Pod
```

## 三、DNS：coredns 把服务名变成 IP 的全过程

```bash
# 集群内访问 shop-order.shop.svc.cluster.local:8080 的解析链
# Pod 内 resolv.conf: nameserver 指向 CoreDNS Service(10.96.0.10)，search 后缀 svc.cluster.local
nslookup shop-order                 # 短名按 ns 补全：shop-order → shop-order.<当前ns>.svc.cluster.local
# 跨 namespace：shop-order.other-ns.svc.cluster.local —— 完整五段名是终极兜底
# 错误预期：以为 DNS 解析出"一个"IP —— ClusterIP 型返回的是虚拟 IP；Headless 返回全部 Pod IP（行为不同）
```

- StatefulSet 配 Headless 后每 Pod 还有独立稳定名（pod-0.headless-svc.ns.svc.cluster.local）——中间件主从互认靠它。

## 四、Ingress：七层入口的正确姿势

```yaml
apiVersion: networking.k8s/v1
kind: Ingress
metadata: { name: shop-gw, annotations: { nginx.ingress.kubernetes.io/rewrite-target: /$2 } }
spec:
  ingressClassName: nginx
  rules:
  - host: shop.example.com
    http:
      paths:
      - path: /order(/|$)(.*)
        pathType: ImplementationSpecific
        backend: { service: { name: shop-order, port: { number: 8080 } } }
      - path: /user(/|$)(.*)
        backend: { service: { name: shop-user, port: { number: 8080 } } }
  # 目的：一条 LB/IP 上按"域名+路径"分流到多个 ClusterIP Service —— Service 管四类、Ingress 管七层路由
  # 反例：给每个微服务各开一个 LoadBalancer 暴露公网（异常：LB 费用爆炸、证书/限流没法统一管）
```

- Ingress 只是"路由规则"，必须配 Ingress Controller（ingress-nginx/云厂商实现）才生效；TLS 证书、超时、灰度注解都在 Controller 层扩展（进阶能力归 Gateway API——新标准要能报出名字）。

## 五、数据路径：一条请求的完整跳数

```text
图目的：外部用户到 Pod 的流量路径（Cloud managed LB 版）。
用户 → 云 LB → NodePort/ProxyPort → kube-proxy(iptables/IPVS 规则) DNAT → Service 虚拟IP:端口 → 后端 ready Pod
结果：ClusterIP 那"一跳"其实是每条 conntrack 规则改写目的地址，没有真实转发设备（说明：ipvs 模式在大 Service 下比 iptables 线性规则更稳）。
排障分层：外部不通查 LB/安全组 → 节点端口查 NodePort → 服务间查 DNS 解析与 EndpointSlice 是否含目标 Pod（readiness 挂了端点列表就是空的）。
```

## 六、关联技术

- 端点名单来自 s1-3 探针；发布期流量切换（蓝绿 selector）用 s1-2 手法配合本节 Service 实现。
- 七层精细化（按头分流/mTLS/重试）超出 Ingress 能力，交给 istio/linkerd 的 Gateway/VirtualService（关联其 s1 各节）；入口可用性监控见 prometheus blackbox。
