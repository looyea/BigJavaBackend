# 调度、亲和/污点与命名空间/RBAC · 小测

### 1. kube-scheduler 过滤阶段判断节点资源是否够用，依据的是（6分）

- A. 容器实际用量
- B. Pod 的 requests
- C. Pod 的 limits
- D. 节点物理总量

> 答案：B
> 解析：调度按"预订口径"requests 计算节点已分配量；实际用量只有 kubelet 驱逐时才看。

### 2. 想让 order-service 的多个副本尽量不在同一节点，应使用（6分）

- A. nodeAffinity
- B. podAntiAffinity 的 preferred + topologyKey: hostname
- C. tolerations
- D. nodeSelector

> 答案：B
> 解析：反亲和按"其他 Pod 的标签"排斥同节点部署；preferred 是软约束尽力打散，required 则可能直接 Pending。

### 3. 关于污点与容忍，正确的说法是（6分）

- A. toleration 写在节点上，taint 写在 Pod 上
- B. 节点打了 NoSchedule 污点后，已有 Pod 会立刻被驱逐
- C. NoExecute 污点会驱逐不容忍的已运行 Pod
- D. 只要加了 toleration，Pod 就一定调度到该节点

> 答案：C
> 解析：NoSchedule 只管新 Pod 不拦已有；NoExecute 才驱逐存量（配 tolerationSeconds）。D 错：容忍只是"允许进"，还要 nodeAffinity/资源满足才行——"去得了"与"愿意去"是两回事。

### 4. Namespace 隔离不能覆盖哪个维度（6分）

- A. API 对象归属
- B. RBAC 授权范围
- C. 网络连通性
- D. 资源配额（配合 ResourceQuota）

> 答案：C
> 解析：不同 ns 的 Pod 默认网络全通，必须显式 NetworkPolicy 才收紧；ns 是"管理与权限"边界而非安全边界。

### 5. Role 与 ClusterRole 的区别是（6分）

- A. ClusterRole 权限数值更大
- B. Role 作用于指定 Namespace，ClusterRole 作用于集群级
- C. Role 不能绑 ServiceAccount
- D. 二者可互换无差别

> 答案：B
> 解析：差别在作用域：Role+RoleBinding 限命名空间；集群级资源（nodes、namespaces 本身）或"跨所有 ns 同规则"才用 ClusterRole+ClusterRoleBinding。

### 6. Pod 一直 Pending，Events 显示 "0/5 nodes are available: 5 node(s) had taint ..."，根因是（6分）

- A. 镜像拉取失败
- B. 未容忍节点污点导致过滤全部淘汰
- C. CPU limit 过高
- D. 探针配置错误

> 答案：B
> 解析：事件文案直接给出淘汰原因计数；所有节点带污点而 Pod 无对应 toleration，过滤阶段即全军覆没。

### 7. 验证某 ServiceAccount 能否在 shop-prod 删除 Pod，正确的命令是（6分）

- A. kubectl get sa -n shop-prod
- B. kubectl auth can-i delete pods -n shop-prod --as=system:serviceaccount:shop-prod:order-sa
- C. kubectl describe role
- D. kubectl top pod

> 答案：B
> 解析：auth can-i 是 RBAC 判定试金石，--as 模拟主体身份；上线前用它能避免"部署了才发现 403 Forbidden"。

### 8. 关于独占节点池的正确做法，下列哪些是对的（多选）（9分）

- A. 给专属节点打 taint（NoSchedule）防止他人进入
- B. 仅靠 nodeSelector 就能保证别人不会调度进来
- C. 业务 Pod 同时配置 toleration 与 nodeAffinity
- D. 把独占节点的 CPU 调高即可实现隔离

> 答案：AC
> 解析：nodeSelector 只约束"我去哪"，拦不住别人也选这些节点（B 错，典型反例）；D 与调度约束无关。独占=污点挡住外人+亲和+容忍保证自己进得来，双向配对。

### 9. 下列哪些属于 RBAC 里的 verbs（多选）（9分）

- A. get
- B. watch
- C. evict
- D. list

> 答案：ABD
> 解析：RBAC verbs 是 API 动作集合（get/list/watch/create/update/patch/delete/deletecollection 等）；evict 是子资源行为——驱逐权限实际体现为对 pods/eviction 子资源的 create。

### 10. 大促前评审 order-service 调度配置，请列出至少 4 个高可用检查点及理由。（40分）

- 要点1：podAntiAffinity/拓扑分布约束是否保证副本跨节点、跨可用区打散（结果：单节点故障不致全灭）。
- 要点2：requests 是否按压测容量设置——过大导致扩容无处调度，过小节点超卖（关联 s3-1 驱逐）。
- 要点3：topologySpreadConstraints 或 Zone 级反亲和覆盖新扩容副本，防止 HPA 扩出的 Pod 扎堆单区（异常：扩了但同 AZ 断电全挂）。
- 要点4：专属节点池的污点与容忍是否配对完整，防止其他团队 Pod 挤占核心链路。
- 要点5：命名空间 ResourceQuota 余量是否够扩容到 maxReplicas（说明：配额打满同样表现为 Pending）。
- 要点6：CI/工作负载 ServiceAccount 权限最小化，避免误操作波及他 ns。

> 答案：见要点
