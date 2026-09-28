# GitOps 原理与 Argo CD 架构 · 小测

### 1. GitOps 的"拉模式"指的是（6分）

- A. 开发者拉取代码本地部署
- B. 集群内 agent 持续对照 Git 期望状态并主动调和
- C. CI 完成后拉取生产日志
- D. Argo 从镜像仓拉镜像

> 答案：B
> 解析：期望状态源在 Git，执行者是被集群内的 controller 轮询/监听驱动——CI 不再持生产凭证往外推。

### 2. Argo CD 中负责把 Git/Helm 渲染成"期望清单"的组件是（6分）

- A. API Server
- B. Repo Server
- C. Application Controller
- D. kubelet

> 答案：B
> 解析：渲染是纯计算负载可水平扩；Controller 拿渲染结果与集群实际做 diff 并驱动同步，职责分开了。

### 3. selfHeal: true 的语义是（6分）

- A. Pod 崩溃自动重启
- B. 人为改动集群资源后被自动回滚成 Git 声明的状态
- C. Git 仓损坏自动修复
- D. 同步失败自动重试

> 答案：B
> 解析：漂移治理项——kubectl edit 的热修会被"无声掰回"（生产热修必须走 Git 提交，A 是 K8s 重启策略的概念混淆）。

### 4. prune: true 解决的问题是（6分）

- A. 镜像体积过大
- B. Git 中已删除的资源在集群里同步删除，防残留漂移
- C. 日志爆盘
- D. 过期 Application 清理

> 答案：B
> 解析：不开 prune 时"从 Git 删掉 YAML"并不会让集群资源消失——反向漂移的经典来源。

### 5. Sync Wave 能表达的是（6分）

- A. 并发同步的线程数
- B. 资源 apply 的顺序分组（数字小先同步）
- C. 多集群分波发布
- D. 金丝雀流量批次

> 答案：B
> 解析：wave 只管 apply 顺序；"上一批健康后再继续"要配 Sync Phase Hook（PreSync/等健康策略），C/D 属其他系统概念。

### 6. manifests 仓与应用代码仓分仓的核心原因是（6分）

- A. Git 性能
- B. 变更节奏与权限分级不同：CI 改镜像 tag、人改配置，各自评审链不同
- C. 磁盘占用
- D. Helm 要求分仓

> 答案：B
> 解析：混仓时 CI 每次构建 commit 都触发 Argo 刷新且无法给机器人"只改 tag"的最小权限；分仓是 GitOps 惯例（错误预期：一个仓省事=审计与权限全糊）。

### 7. GitOps 下"生产发布授权"的实质载体是（6分）

- A. 运维值班表
- B. manifests 仓对应环境的合并权限（CODEOWNER/评审通过）
- C. 堡垒机
- D. CI 手动按钮

> 答案：B
> 解析：期望状态只认 Git，谁能改 main 的 overlays/prod 谁就有发布权——权限、审计、流程三者统一到 Git 平台原生机制。

### 8. 关于 Argo CD 的 RBAC 与凭证，正确的有哪些（多选）（9分）

- A. 用户权限策略可写在 argocd-rbac-cm 中按 group/project 授权
- B. Argo 访问目标集群使用注册的集群 SA 凭证，项目可限定 namespace 与资源类型
- C. 给所有用户 argocd-admin 便于推广
- D. Git 仓库凭证尽量只读，写回场景才授最小写权限

> 答案：ABD
> 解析：C 是推广期反模式——权限过宽后收紧极难（异常：一次账号泄漏=全集群应用可被篡改）；A/B/D 是官方推荐的三道收口。

### 9. 手工 kubectl 改了生产 Deployment 镜像后，GitOps 系统会怎样（多选）（9分）

- A. 开启 automated+selfHeal 时会被自动回滚成 Git 版本
- B. UI 出现 OutOfSync / 漂移提示
- C. 改动会永久生效因为集群优先
- D. 正确做法是把改动提交回 Git 让其受控生效

> 答案：ABD
> 解析：C 恰好说反——Git 是唯一事实源，集群是投影；紧急热修也必须"改 Git + 快速合并"，否则 selfHeal 会把救火改动掰走（事故温床）。

### 10. 团队准备从"CI 推 + kubectl apply"迁到 Argo CD，请给出落地步骤与收益验证点（至少 4 点）。（40分）

- 要点1：先建 manifests 仓（Kustomize/Helm 目录按环境 overlay），把现网状态导出为初始声明收编（说明：首次收编对不上就是漂移清单）。
- 要点2：装 Argo CD，接入 SSO、建 AppProject 限定各团队 namespace/资源白名单，RBAC 按项目授权。
- 要点3：应用逐个 ns 迁移接管（先 staging 后 prod），开 automated+prune+selfHeal，观察一周 OutOfSync 告警清零。
- 要点4：CI 改造为"构建镜像 + 向 manifests 仓提 MR 改 tag"，撤走 CI 内全部生产 kubeconfig（结果：凭证攻击面收敛是核心收益，要写进复盘）。
- 要点5：验证收益指标：发布审计=Git 历史、回滚=revert 合并时长、漂移事件数、MTTR 对比迁移前基线。

> 答案：见要点
