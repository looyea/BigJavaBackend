# Service 四种类型、Ingress 与 DNS · 小测

### 1. Service 的 ClusterIP 本质是？（6分）

- A. 绑定在某网卡上的真实 IP
- B. 虚拟 IP，由 kube-proxy 规则把发往它的流量 DNAT 到后端 Pod
- C. Pod 自己的 IP
- D. 公网 IP

> 答案：B
> 解析：ClusterIP 不在任何设备、ping 不通，靠每条转发规则实现（结果：Pod IP 变化对它透明）。

### 2. Service 靠什么选中一组 Pod？（6分）

- A. 名字
- B. selector 匹配 Pod label（且只接 ready 端点）
- C. 命名空间
- D. 镜像

> 答案：B
> 解析：label selector 定义成员，readiness 决定谁进 EndpointSlice（错误预期：selector 匹配了但没 ready 仍收不到流量）。

### 3. 想让 gRPC 长连接负载均衡到每个后端，应选？（6分）

- A. ClusterIP
- B. Headless Service + 客户端负载均衡
- C. NodePort
- D. LoadBalancer

> 答案：B
> 解析：四层 LB 会把长连接一直哈希到同一后端、扩的实例分不到流量；Headless 返回全部 Pod IP 交客户端自平衡（结果：HPA 才真正生效）。

### 4. 把单个服务四层暴露到云公网最常用的类型是？（6分）

- A. ClusterIP
- B. LoadBalancer
- C. Headless
- D. ExternalName

> 答案：B
> 解析：LoadBalancer 让云厂商起一个外部 LB 转发到 NodePort；缺点是一服务一 LB（结果：入口成本与证书管理分散）。

### 5. 集群内 `nslookup shop-order` 最终补全的完整域名是？（6分）

- A. shop-order.local
- B. shop-order.<namespace>.svc.cluster.local
- C. shop-order.svc
- D. 公网域名

> 答案：B
> 解析：resolv.conf 的 search 后缀逐级补全为 `<svc>.<ns>.svc.cluster.local`；跨 ns 要显式写对方 namespace 段。

### 6. Ingress 与 LoadBalancer Service 的关键区别是？（6分）

- A. 没区别
- B. Ingress 在一条入口上按域名/路径做七层分流到多个 Service
- C. Ingress 只能四层
- D. LoadBalancer 支持路径路由

> 答案：B
> 解析：LB Service 多为四层、一服务一个；Ingress 复用一条入口做 L7 路由、统一 TLS/限流（结果：省 LB 且入口收敛）。

### 7. Ingress 资源要生效还依赖什么？（6分）

- A. 重启集群
- B. 一个 Ingress Controller（如 ingress-nginx）实现这些规则
- C. 更多 Service
- D. DNS 服务

> 答案：B
> 解析：Ingress 只是路由声明，Controller 才真正落地转发（错误预期：apply 了 Ingress 就自动有入口）。

### 8. 关于四种 Service 类型，正确的有（多选）（9分）

- A. ClusterIP 仅集群内可达
- B. NodePort 在每个节点开一个 30000-32767 端口
- C. Headless 不分配 ClusterIP，DNS 直接返回 Pod IP
- D. LoadBalancer 一定是七层入口

> 答案：ABC
> 解析：A/B/C 是各自特征；D 错——LoadBalancer 通常是云四层 LB，七层要靠 Ingress/Gateway（错误预期）。

### 9. 一个服务对外完全不通，合理的分层排查项有（多选）（9分）

- A. 后端 Pod 是否 ready（EndpointSlice 是否为空）
- B. Service selector 是否真匹配到 Pod label
- C. Ingress/Controller/云 LB/安全组是否正确配置放行
- D. targetPort 与容器实际监听端口是否一致

> 答案：ABCD
> 解析：端点、选择器、入口链路、端口映射是四个必查层（说明：readiness 挂→端点空→看似"服务挂了"其实 Pod 在跑）。

### 10. 简答题：设计电商集群对外入口与内部服务发现方案，说明 Service/Ingress/DNS 如何配合。（40分）

- 要点1：内部服务间一律 ClusterIP + 短域名（shop-order.shop.svc...），不各开 LoadBalancer（目的：入口收敛、成本可控，服务发现交给 CoreDNS）。
- 要点2：南北向统一走 Ingress（或云 LB 型 Ingress Controller），按 host/path 把 /order、/user 路由到对应 Service，TLS 在入口层集中挂证书（错误反例：每微服务直连公网 LB）。
- 要点3：gRPC/WebSocket 类长连接服务改 Headless + 客户端 LB，避免四层哈希把流量钉在旧实例、扩容失效（验收：扩副本后新 Pod 确实分到流量）。
- 要点4：入口后端就绪联动——各 Service 的 EndpointSlice 由 readiness 控制，发布期摘流靠 s1-3 时序 + Ingress 后端及时同步（说明：Ingress 转发目标仍是 Service，探针是共同闸门）。
- 要点5：可观测与灰度：入口层统一打访问日志/metrics（关联 prometheus），灰度按头分流用 Ingress 注解或升级到 mesh Gateway API（关联 istio）。
- 要点6：跨 ns/外部访问治理：需要命名空间隔离用 NetworkPolicy（s3-2）收紧"默认可通"，StatefulSet 中间件用 Headless 给每副本稳定 DNS 名（补充：ExternalName 可将内部名 CNAME 到外部服务做过渡）。

> 答案：见要点
