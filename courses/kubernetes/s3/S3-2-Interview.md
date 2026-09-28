# 调度、亲和/污点与命名空间/RBAC · 面试题

## 题 1：讲讲一个 Pod 从 Pending 到 Bound 的完整调度过程。

1. 创建后 API Server 写入 etcd，scheduler 的 watch 队列感知到"spec.nodeName 为空"的 Pod。
2. 过滤阶段：逐个节点跑 Filter 插件——资源（按 requests）、nodeSelector/nodeAffinity、拓扑约束、污点容忍（结果：全被淘汰则事件里输出 0/N nodes 及原因计数）。
3. 打分阶段：对存活节点按 Score 插件加权（剩余资源多优先、镜像本地性等），同分随机。
4. Bind：API Server 写 binding 子资源，kubelet 看到"点名给自己"才开始拉镜像起容器（说明：调度只看声明态，节点真实水位是 kubelet 驱逐负责的的另一套）。

## 题 2：nodeSelector、亲和、污点三者的分工？只给亲和够吗？

- nodeSelector：等值硬匹配，简单但无法表达权重与"就近其他 Pod"。
- nodeAffinity：运算符丰富（In/NotIn/Exists），支持 required（硬）与 preferred（软）；podAffinity/AntiAffinity 按其他 Pod 标签做吸引/排斥。
- taint+toleration：站在节点侧说"谁别来"，与 Pod 侧的亲和方向相反（错误理解：加了 nodeSelector 选 GPU 节点就独占——别人也能选，标签不是门）。
- 独占的正确解是双向配对：节点打污点（挡别人）+ Pod 写 toleration（让自己进）+ nodeAffinity（保证自己真去）。

## 题 3：NoSchedule、PreferNoSchedule、NoExecute 区别？

- NoSchedule：新 Pod 不容忍就不进，存量不动。
- PreferNoSchedule：尽量不进，资源枯竭时仍可能进（软约束）。
- NoExecute：进不去 + 存量不容忍的立刻驱逐；存量带 toleration 时可配 tolerationSeconds 定"多活几秒"（示例：节点 NotReady 时 controller 自动加 NoExecute 污点，5min 后 Pod 被驱逐重建——这就是"节点失联 Pod 为什么会被搬走"的机制）。

## 题 4：多团队共用集群，怎么做租户隔离？Namespace 之外还要什么？

- 权限层：每团队独立 ns + Role/RoleBinding（只给自己的 ns），敏感集群级操作收敛到平台组；ServiceAccount 按工作负载细分不用 default。
- 容量层：ResourceQuota（对象数与资源总量）+ LimitRange（默认 request/limit，兜住裸 Pod 变 BestEffort）——否则一个团队把节点 requests 订光，别的全 Pending（异常现象"我没动为什么部署不了"多半如此）。
- 网络层：NetworkPolicy 默认拒入或按 ns 白名单——ns 本身不隔离网络，这是最常见误区。
- 加分：配额治理、标签规范与成本分摊（关联 prometheus 资源监控）。

## 题 5：RBAC 四个概念怎么串起来？给 CI 配权限你的原则？

- 串法：Role/ClusterRole 定义"对哪些 resources 能做哪些 verbs"→ RoleBinding/ClusterRoleBinding 把 Subject（用户/组/ServiceAccount）绑到 Role 上；RoleRef 是 Binding 指向 Role 的那根线。
- CI 原则：目标 ns 的 workload 操作权用 Role 不用 ClusterRole（除 helm 需读 CRD 等集群资源外）；只给 pipeline 真正需要的 verbs；用 `auth can-i --as` 做上线前断言；凭证用短周期 Projected SA token，拒绝 cluster-admin"图省事"（反例：runner 被盗全网重）。
- 加分：GitOps 下 CD 机器人只需 apply 权限，删除走人工审批流。

## 题 6：HPA 扩容出来的新副本总是挤在同一批节点，可能什么原因？

1. 只给存量 Deployment 配了 hostname 级反亲和，但节点池扩容后新节点空载得分高，preferred 软约束下仍扎堆其他维度？——检查是否该升级为 topologySpreadConstraints（说明：minDomains/labelSelector 语义更完整）。
2. 可用区维度没配：topologyKey 用的 hostname 而非 zone，扩容节点全在同一 AZ（结果：AZ 故障时"打了散"假象破产，异常场景要按 zone 打散）。
3. 反亲和被后加的 Pod 模板绕过（如 HPA 指向的 template 与手工分析的不是同一份），或某个节点组带污点导致候选面过窄。
- 答题落点：约束强度（软/硬）、拓扑键粒度、与调度打分的相互作用三者都要覆盖。
