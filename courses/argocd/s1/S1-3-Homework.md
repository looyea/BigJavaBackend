# 与 Flux 及推拉模型对比（关联） · 作业

## 作业 1：同一应用的双工具落地（动手题）

**目标**：亲手感受 Argo CD 的 Application 与 Flux 的 CR 组合在表达同一意图时的差异。

**任务**：
1. 选一个已有的 Spring Boot 演示应用，分别用 Argo CD Application 与 Flux（GitRepository + Kustomization）声明对 `deploy/overlays/prod` 目录的同步；
2. 各制造一次漂移（`kubectl edit` 改副本数），记录两者被发现与纠正的耗时，并解释 interval 参数如何影响该指标；
3. 各删除 Git 中一个资源清单，对比 prune 与 GC 的默认行为差异；
4. 输出对比记录表：部署时延、排障入口（UI vs `flux get` 各命令）、权限模型落点。

**验收标准**：两份声明均达到 Synced/Ready；能用自己的数据说明"检测延迟上界 = 拉取 interval"，并指出两套工具里谁在直连 Git、谁在读缓存制品。

**参考解法要点**：Flux 侧观察 `GitRepository` 的 `artifact.revision` 与 `Kustomization` 的 `ready` 条件；Argo CD 侧看 Application 的 `status.sync.revision`；删除语义差异要引用 `prune` 字段与 `spec.gcPolicies`（Flux 默认 `all`）说明。

## 作业 2：流水线边界重构（工程题）

**目标**：把一条"CI 直接 kubectl apply"的旧流水线改造成推拉分界清晰的形态。

**任务**：
1. 阅读给定的 GitLab CI 配置（含 `deploy_prod: kubectl apply` 作业），指出它违反 GitOps 哪几条原则、审计时会缺什么证据；
2. 改造为：CI 保留 test/build/package/push-image，新增 `update-gitops` 作业仅向配置仓库提交镜像 tag 变更 MR 或直推；
3. 删除 `deploy_prod` 中对集群的写操作，替换为 `argocd app wait`（或 Flux `--silent` 等待调和）作为流水线状态反馈通道；
4. 写出改造后"回滚一次生产发布"的完整操作步骤（从触发到 Git 固化）。

**验收标准**：改造后 Git 历史中每次生产变更都有对应提交；CI 日志不再出现任何 `kubectl apply/edit/delete`；能用 3 句话向面试官解释为什么 `argocd app sync` 不算破坏拉模型。

## 作业 3：选型建议书（文档题）

为所在组织（或虚构一个：20 服务电商 + 强审计金融各一集群）写一页 Argo CD vs Flux 选型建议书。**验收标准**：必须包含——两工具形态差异表、UI/多租户/资源占用三项评分、与现有 CI 的集成方式、迁移灰度计划（试点服务与回退路径）、以及"为什么落选者在其强项场景仍值得考虑"的反方陈述各一段。
