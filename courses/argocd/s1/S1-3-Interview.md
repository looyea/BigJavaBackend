# 与 Flux 及推拉模型对比（关联） · 面试题

## 题 1：Argo CD 和 Flux 的本质差异是什么？

- 理念相同（都是拉模型 GitOps），差异在形态：Argo CD 是带 UI/API Server 的平台，以 Application CR 为中心，凭据自管理；Flux 是一组无 UI 的解耦控制器，一切靠 Git 里的 CR 表达。
- 推论：Argo CD 服务端直连 Git 渲染；Flux 的 source-controller 先拉取缓存成 Artifact，下游控制器读本地制品。
- 一句话：Argo CD 卖"系统"，Flux 给"原语"，选型其实是"要平台还是要 K8s 原生组合"。

## 题 2：多租户与权限模型两家怎么做？

- Argo CD：AppProject 声明可同步的仓库、目标集群、资源白名单与角色 RBAC，是应用层隔离，适合给非平台团队开自助。
- Flux：没有中间层，权限就是 K8s RBAC + Namespace 边界，Secret 存凭据——审计走 K8s audit log 即可，天然贴合现有合规链路。
- 加分点：Argo CD 的 project 配错等于旁路 RBAC，要定期审 project 的 sourceDestinationsRestriction；Flux 配错 RBAC 则是控制器直接失权，故障更显性。

## 题 3：CI 里 kubectl apply 到底错在哪？什么场景还能用？

- 错在破坏"Git 单一事实源"：集群领先 Git、变更无提交记录、漂移无人纠正，审计时拿不出"谁在何时部署了什么"的证据链。
- 仍适用：一次性迁移脚本、紧急 patch、无 K8s 平台团队的纯 VM 发布——本质是"环境少、人少、时效压倒一切"时推模型成本更低。
- 边界口诀：推的是"意图"（写 Git 提交）永远没错，推的是"状态"（直接改集群）才需要豁免流程与事后补 Git。

## 题 4：删除语义上两家有什么差异？各有什么坑？

- Flux 的 GC 默认主动：Kustomization 托管的资源从 Git 消失即从集群删除；Argo CD 默认保守，须开 `prune: true`。
- 坑一：Argo CD 根应用开 prune + 误删子应用清单 = 级联删整棵业务树，须 finalizer/叶子级 prune 兜底。
- 坑二：对"Git 删除即集群删除"有恐惧的团队，可用 `ignoreDifferences`/keep annotation 给关键资源（如 PV、带 finalizer 的 CR）开豁免白名单。

## 题 5：已经选了其中一家，面试官问"为什么不选另一家"，怎么答不失分？

- 结构化：先给判据（是否需要 UI 自助、多租户模型偏好、团队 K8s 功力、平台资产预算），再逐条对号，落选者的强项如实承认。
- 例：选 Argo CD 因"测试/运维要界面 + AppProject 隔离 20 个团队应用"；同时承认 Flux 更轻、更 K8s 原生，若团队只有两名平台工程师它更合适。
- 大忌：说"另一个不支持 Helm/GitOps"这类事实错误——两家都支持 Helm、Kustomize、OCI。

## 题 6：GitOps 迁移怎么做，怎么防止"半 GitOps"状态？

- 半 GitOps 形态：清单进了 Git 但人还在 kubectl 改、或 CI 仍保留 apply 作业——漂移让 Git 历史失去可信度，比不用更危险。
- 路径：先收事实源（import-only 模式把现有资源纳管不 reconcile）→ 开 selfHeal 前完成全部存量回写 Git → 删 CI 中所有集群写操作 → 加 drift 告警（OutOfSync 持续 N 分钟即报警）。
- 灰度与回退：单服务试点跑一个发布周期对比 MTTR，再批量迁移；保留 `argocd app set --sync-policy none` 作为熔断开关。
