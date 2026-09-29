# 调度、亲和/污点与命名空间/RBAC

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能用 nodeSelector/亲和/污点容忍表达调度意图，理解多副本打散与独占节点的正确工具选择，掌握 Namespace 资源隔离边界与 RBAC 最小权限建模，能解决"Pod 一直 Pending 无处可调度"类问题。

## 一、调度的两阶段：过滤与打分

```text
图目的：kube-scheduler 如何为 Pending Pod 选出节点。
过滤（Filter）：逐节点淘汰硬条件——资源够吗（request 口径 s3-1）、nodeSelector/亲和是否匹配、污点是否被容忍（结果：全淘汰→Pending 且事件写 0/N nodes available）。
打分（Score）：对存活节点按插件打分——LeastAllocated（剩余资源多优先）、ImageLocality、亲和权重等，取最高分绑定。
说明：现代集群用调度框架（Scheduling Framework）把这两阶段扩成 10+ 扩展点，自定义调度器/多调度器都插在这里。
```

## 二、表达调度意图的四件工具

```yaml
# 工具1 nodeSelector：最简单的硬标签匹配（反例：用它做业务隔离，标签失控后没人敢动）
nodeSelector: { disktype: ssd }
# 工具2 Pod 亲和/反亲和：按"别的 Pod 的标签"决定就近或打散
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:      # preferred 软约束尽力而为
    - weight: 100
      podAffinityTerm:
        topologyKey: kubernetes.io/hostname               # 同节点打散；换 zone 键实现跨可用区
        labelSelector: { matchLabels: { app: order-service } }
# 工具3 污点与容忍：节点"排他"，只有带容忍的 Pod 能进（错误预期：只加亲和不加污点，别的 Pod 照样挤进来）
# tolerations 写在 Pod 上，nodeAffinity 也写在 Pod 上——方向别记反：亲和是"我去哪"，污点是"谁别来"
```

- 典型组合：GPU 节点 `nvidia.com/gpu=true:NoSchedule` 打污点 + GPU 应用同时写 nodeAffinity（去得了）与 toleration（留得下）；核心交易大促时给专属节点池打污点实现"独占"。
- `NoSchedule`（新 Pod 不进）/`PreferNoSchedule`（尽量不进）/`NoExecute`（已有 Pod 也驱逐，配 tolerationSeconds 定存活秒数）三强度要分清。

## 三、Namespace：隔离的管理边界

```bash
kubectl create namespace shop-prod
kubectl apply -n shop-prod -f order.yaml            # 资源归 ns；Service DNS 带 ns 后缀（s2-1）
kubectl get pods -A                                  # 跨全部命名空间查看
# 注意边界：Namespace 隔离的是 API 对象与权限，不是网络也不是资源池——
# 网络默认全通（要 NetworkPolicy 才关，反例：以为不同 ns 互相隔离）；
# 资源配额要靠 ResourceQuota/LimitRange 显式声明，否则 ns 之间随便互抢节点容量。
```

## 四、RBAC：谁能对哪些资源干什么

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role                      # Role 只作用于本 Namespace；要管集群级资源用 ClusterRole
metadata: { name: pod-reader, namespace: shop-prod }
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]     # 最小权限示例：开发只读 Pod 与日志
  verbs: ["get", "list", "watch"]
# 错误预期：给 CI 机器人绑 cluster-admin"先跑起来再说"（异常：一次凭证泄漏=整个集群沦陷，事故常客）
```

- 四元组记忆：Subject（用户/组/ServiceAccount）—Role(规则)—RoleRef—Binding；授权=Role/ClusterRole 定义权限 + RoleBinding/ClusterRoleBinding 把人绑上去。
- 落地习惯：先 `kubectl auth can-i delete pods -n shop-prod --as=system:serviceaccount:ci:gitlab-runner` 验证，再上线；生产开审计日志。

## 五、"调度不上"标准排查

1. `kubectl describe pod` 看 Events 的 FailedScheduling 文案——资源不足/亲和不满足/污点未容忍三类话术各对应上面一条根因（结果：文案直接告诉你 0/5 nodes 的淘汰原因计数）。
2. 对照节点：`kubectl get nodes -o wide` + `describe node` 查已分配量（request 口径）与污点列表。
3. 扩容侧兜底：节点池缩到 min、cluster-autoscaler 没起来，也会表现为同样 Pending（关联弹性伸缩 s3-1）。

## 六、关联技术

- request/limit 与 QoS 是过滤阶段资源打分的事实源（s3-1）；HPA 扩出的新副本同样要走这套调度，反亲和决定它是否真跨节点打散。
- ServiceAccount 是 RBAC 的主体之一，与工作负载身份绑定；集群多租户配额治理（ResourceQuota）与 Namespace 成对出现。
- kubelet 侧的节点压力驱逐与调度约束共同决定"Pod 最终落在哪、能活多久"。
