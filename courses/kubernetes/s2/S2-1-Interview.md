# Service 四种类型、Ingress 与 DNS · 面试题

## 题 1：Service 有几种类型，分别什么时候用？

- ClusterIP（默认）：集群内服务间调用，虚拟 IP + 负载均衡；NodePort：每节点开 30000-32767，配合外部 LB 或调试；LoadBalancer：云厂商四层公网入口（一服务一 LB，贵）；Headless（clusterIP:None）：DNS 直返 Pod IP，给 StatefulSet 和需要客户端 LB 的 gRPC。
- 加分：ExternalName（把服务名 CNAME 到外部域名，做过渡/引用外部）。
- 选型一句话：内部通信用 ClusterIP、公网入口统一交给 Ingress/Gateway 而非一堆 LoadBalancer。

## 题 2：ClusterIP 能 ping 通吗？为什么不通还能收流量？

- ping 不通（结果 ICMP 不被 kube-proxy 规则处理，且它是虚拟 IP 不在任何网卡）。
- 但 TCP/UDP 到该 IP:端口会被 iptables/IPVS 规则 DNAT 到某后端 Pod——"转发"发生在 conntrack 层不是路由层（异常：用 ping 判 Service 死活是典型外行做法）。
- 正确判活：`curl <ClusterIP>:<port>` 或查 EndpointSlice 是否有 ready 端点。

## 题 3：微服务间调用"名字怎么变成 IP"？讲整条 DNS 链。

1. Pod 的 /etc/resolv.conf 里 nameserver 指向 CoreDNS 的 Service IP，search 列 `svc.cluster.local` 等后缀。
2. 应用发 `shop-order` → 补成 `shop-order.<本ns>.svc.cluster.local` → kubelet 的 ndots 规则先试集群域，命中后 CoreDNS 返回该 Service 的 ClusterIP。
3. 跨 namespace 用 `shop-order.other-ns.svc.cluster.local`（五段全名兜底）；Headless 则返回全部 Pod IP。
4. 说明：CoreDNS 挂 → 名字解析全崩但 IP 直连仍通（作业里缩 0 复现过）——所以要给 DNS 配多副本+反亲和+node-local DNS 优化。

## 题 4：Ingress 和 Gateway API 什么关系？

- Ingress：简单的 host/path 七层路由声明，依赖 Controller 落地；能力扩展靠各家注解（rewrite、限流、TLS），碎片化严重。
- Gateway API：新一代入口标准，角色分离（GatewayClass/Listener/Route）、表达力强（L4/L7、跨命名空间引用）、端口/协议类型化（结果：取代注解黑魔法）。
- 现状答法：存量大量用 ingress-nginx，新项目可选 Gateway API；mesh（istio）也实现 Gateway API——能报出"Gateway API 是为解决 Ingress 表达力不足而生"即可。

## 题 5：一个服务从公网访问完全不通，你的分层排查顺序？

1. 后端层：Pod 在跑吗、ready 吗（`get endpoints/endpointslice` 空则前面白搭，回查 readiness s1-3）。
2. Service 层：selector 是否匹配 Pod label、targetPort 是否等于容器监听端口（结果：selector 打错是最常见低级事故）。
3. 入口层：Ingress 规则 host/path/后端 Service 是否对、Controller Pod 是否健康、TLS Secret 是否有效。
4. 云/网络层：LB 状态、安全组/防火墙端口放行、externalIP/DNS 解析（说明：从上到下四层，比乱猜快一个数量级）。

## 题 6：gRPC 服务部署到 K8s，为什么要特别处理 Service 类型？

- 症状：用普通 ClusterIP，扩了副本但新 Pod 收不到流量、负载长期压在少数实例（原因：gRPC=HTTP/2 长连接，四层 LB 只在建连时选后端，之后连接复用不再重选）。
- 解法：Headless Service + 客户端负载均衡（grpc 原生 LB / Spring Cloud LoadBalancer 拿全端点列表自己均衡）；或上 mesh 做 L7 感知负载均衡（istio 能按请求而非连接分）。
- 加分：还要配 s1-3 就绪与优雅退出，否则滚动发布长连接不会主动断到新实例（结果：入口/发现/发布三节知识在 gRPC 场景叠加）。
