# 网络模型与容器互联 · 面试题

## 题 1：bridge、host、overlay 分别什么时候用？

- bridge（默认/自定义）：单机内容器互联，自定义网络才有服务名 DNS 与网段隔离——日常首选。
- host：极致网络性能、需要直接用宿主网卡（如某些网关/低延迟代理），接受端口冲突与隔离丧失（异常：滥用导致端口撞车）。
- overlay：跨主机容器同一逻辑网络（Swarm），K8s 里由 CNI 插件承担同类职责。
- 加分：none 用于完全断网的批处理/纯计算，是"最小权限网络"的极端形态。

## 题 2：容器里 `localhost:8080` 为什么连不上同宿主的另一个服务？

- 每个 bridge 容器有独立 NET Namespace，localhost 指向的是它自己的回环，不是宿主也不是别的容器（结果：跨容器用 localhost 必失败）。
- 正确姿势：同自定义网络用服务名 `svc:8080`；要连宿主上进程用宿主可达 IP 或 host.docker.internal。
- 延伸追问：那 `-p` 暴露的端口谁用？答：给容器外部（宿主/公网）访问用，容器内部互访不经它。

## 题 3：`-p 8080:8080` 和 `-P`（大写）区别？端口不映射容器能被外部访问吗？

- `-p 宿主:容器` 显式绑定；`-P` 随机把 EXPOSE 的端口映射到宿主高端口（示例：多见于测试/临时）。
- 不映射：外部（含宿主 localhost）访问不到该容器端口，因为入口靠宿主端口 DNAT 进去（异常：只 EXPOSE 不 -p，本地 curl 宿主端口连不上）。
- 但同自定义网络的其它容器仍可用服务名直连——内部互通不依赖 -p（考点：区分南北向与容器间东西向）。

## 题 4：如何设计"公网只暴露网关、DB 藏后面"的 Docker 网络？

```bash
# 目的：用"网络即隔离边界"做纵深防御
docker network create frontend && docker network create backend
docker run -d --network frontend -p 443:8443 gateway        # 只有网关对外
docker run -d --network backend mysql                        # DB 不 -p、不在 frontend
docker run -d --network frontend --network backend order     # 订单双挂，作受控转发点
# 结果：公网入口被攻破也到不了 DB（跨网默认不通）；反例是所有服务同网且都 -p（内网横移零成本）
```

## 题 5：容器重建后连不上 DB，用服务名也连不上，可能原因？

1. 两容器不在同一网络（重建时漏 `--network`）——最常见（输出：`docker inspect` NetworkSettings 看归属）。
2. 服务名变了（--name 改了或用了 Compose service 名而非容器名）。
3. DB 容器还没就绪/监听在 127.0.0.1 而非 0.0.0.0（异常：只 bind 回环，同网也别人连不进）。
4. 网络驱动/iptables 异常或自定义网络被删。
- 排查顺序：网络归属 → 名字 → 监听地址 → 规则（说明：先看"同不同网"能省一半时间）。

## 题 6：Docker 网络这套认知迁到 K8s 还适用吗？

- 思想全适用、实现全换代：容器名 DNS → CoreDNS + Service；自定义网络隔离 → Namespace + NetworkPolicy；-p 暴露 → Service(NodePort/LB)/Ingress；overlay 跨主机 → CNI 插件（Flannel/Calico）。
- 关键差异：K8s 里 Pod 间默认同集群可路由（不像 Docker 需显式同网），隔离靠 NetworkPolicy 白名单反向收紧（结果：从"默认不通、要连"变成"默认可通、要隔"）。
- 答出"默认可达性方向相反"这一点，是区分用过 Docker 和懂 K8s 网络的分水岭（详见 kubernetes s2-1）。
