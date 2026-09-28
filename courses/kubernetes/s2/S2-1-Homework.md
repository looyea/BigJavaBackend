# Service 四种类型、Ingress 与 DNS · 作业

## 作业 1：四种类型对比实验

**目标**：观察同一后端在不同 Service 类型下的可达性。

1. 一个后端 Pod 依次配 ClusterIP、NodePort、LoadBalancer(minikube/kind 模拟)，用 `kubectl get svc` 看分配差异，从集群内/节点外/公网分别尝试访问（输出：三张可达性对照）。
2. 改成 Headless，进另一 Pod `nslookup <svc>` 观察返回的是 Pod IP 列表而非虚拟 IP（验收：解析结果随 Pod 增减变化）。
3. 记录 ClusterIP `ping 不通但 curl 端口通`的现象（错误预期：用 ping 判活是外行排查）。

## 作业 2：DNS 解析链验证

**目标**：走通 service 名→ClusterIP 的全过程。

1. 进 Pod `cat /etc/resolv.conf`，看 nameserver 与 search 域（说明：nameserver 指向 CoreDNS 的 Service IP）。
2. 用同 ns 短名、跨 ns 全名分别 `nslookup`，对比补全结果（输出：shop-order vs shop-order.other-ns.svc.cluster.local）。
3. 故意把 CoreDNS Pod 副本缩 0，观察集群内服务名解析异常而 IP 直连仍通（异常用例：坐实"名字变 IP"完全依赖 DNS）。

## 作业 3：Ingress 七层路由

**目标**：一条入口分流两个服务。

1. 装 ingress-nginx，写 Ingress 把 shop.example.com 的 /order、/user 路由到两个 Service，用 `curl --resolve` 带 Host 头验证分流（验收：两路径命中不同后端）。
2. 加 TLS（自签证书 Secret），https 访问验证；关掉 Controller 观察 Ingress 立刻失效（结果：证明 Ingress 只是声明、Controller 才落地）。
3. 配一条 rewrite-target 注解体验路径重写（说明：注解能力属于 Controller，不是 Ingress 资源本身）。
