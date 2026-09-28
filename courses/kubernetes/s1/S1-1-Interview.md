# 架构、控制平面与 Pod 生命周期 · 面试题

## 题 1：讲讲 K8s 架构，一次 kubectl apply 发生了什么？

- 控制平面：API Server（唯一入口，鉴权/校验/准入）↔ etcd（持久化）+ Scheduler（选节点）+ Controller Manager（各类调和循环）；数据平面：每节点 kubelet（起容器）+ kube-proxy（Service 流量规则）+ 容器运行时（CRI）。
- apply 流：kubectl→API Server（认证/校验/准入）→写 etcd→相应控制器 watch 到差异→调度→kubelet 落地→状态回报（结果：全程无"命令式指挥"，靠 watch 调和收敛）。
- 加分：强调 API Server 是单点入口，etcd 只它可写——理解这点才懂 RBAC/准入为何都在它这层。

## 题 2：Pod、Container、Deployment、ReplicaSet 的关系？

```text
图目的：一层管一层的期望副本链。
Deployment 管 ReplicaSet（用于滚动/回滚的版本载体）；ReplicaSet 管 Pod（保证 replicas 数）；Pod 管 Container。
你声明 Deployment(reprlicas=3) → RS 确保有 3 个符合模板的 Pod → 每个 Pod 按 spec 起容器。
错误理解：删了 Pod 就没了 —— 实为 RS 立刻补（desired 在 RS 层记着）。
```

## 题 3：Pod 一直 Pending，你的排查 SOP？

1. `kubectl describe pod` 看 Events：FailedScheduling 会直说原因（Insufficient cpu/mem、node 亲和不匹配、污点未容忍、PVC 未绑定）。
2. 资源类→查 requests 与节点可用（`kubectl top nodes`/`describe node` 的 Allocated 段）；亲和/污点类→核对 pod spec 与节点标签（关联 s3-2）。
3. 存储类→PVC Pending 说明没供给上（见 s2-2 CSI）。
4. 说明：Pending ≠ 应用问题，容器还没起，去看日志是徒劳——先定位是"调度失败"还是"创建沙箱/镜像阶段卡住"。

## 题 4：为什么 Pod 内多容器共享网络、跨 Pod 却不互通要用 Service？

- Pod 是网络原子：内容器共享一个 NET Namespace（同 IP、localhost 互通），这是 sidecar 模式基础（呼应 docker s2-1 的容器名 DNS 思路）。
- 跨 Pod：Pod 是"牛马"，随时重建、IP 漂移（结果：直连 IP 不可靠），所以用 Service 提供一个稳定的虚拟入口（ClusterIP）+ 负载均衡，后端随 Pod 变化由 EndpointSlice 自动更新。
- 加分：默认同集群 Pod 跨节点可路由（CNI 保证），不像 Docker 需显式同网——"默认可通、靠 NetworkPolicy 收紧"（详见 s2-1）。

## 题 5：Init 容器和普通容器、Sidecar 的区别？

- Init 容器：主容器前串行运行、跑完退出（成功才继续）——做迁移/等依赖/生成配置（对应 s1-1 生命周期 ContainerCreating 阶段）。
- Sidecar：与主容器并行常驻、共享网络卷——做日志采集/mTLS 代理（istio 就是注入 sidecar）。
- 新版 K8s 用 `initContainers` + `restartPolicy: Always` 实现"原生 sidecar"，解决启动/停止顺序治理（追问：普通 Init 不会常驻）。

## 题 6：etcd 挂了或 API Server 不可用会怎样？

- 已运行的 Pod 不受影响（kubelet 本地有 PodSpec 缓存，容器继续跑）——这是"数据平面自治"设计（结果：控制面短暂故障不等于业务中断）。
- 但无法做变更：不能调度新 Pod/改配置/自愈（新节点加不进来、挂掉的 Pod 补不了，因为调和依赖 API Server）。
- 运维含义：控制面高可用（多副本 API Server + etcd 奇数节点）与"业务面降级仍可服务"要分开评估（说明：这也是把关键配置缓存本地的原因）。
