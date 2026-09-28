# GitOps 原理与 Argo CD 架构 · 面试题

## 题 1：GitOps 是什么？和"CI 里 kubectl apply"的本质区别？

- 四原则：声明式（期望状态全在 YAML）、版本化（Git 历史=部署历史）、拉模式（集群内 agent 调和）、持续调和（自动纠偏漂移）。
- 本质区别有三：①事实源方向——推模式里"最新一次 CI 成功"是事实，集群可能因失败半程而与任何记录都不符；GitOps 里 Git 是唯一期望态，未达成会一直重试并对齐；②凭证方向——CI 打出去（持生产密钥）vs agent 拉回来（CI 零生产凭证）；③审计形态——发布记录在 CI 日志 vs 在 Git diff+MR。
- 加分：说清 GitOps 只管部署侧，构建仍属 CI——职责切分是落地第一步。

## 题 2：画/讲 Argo CD 架构与一次同步的流程。

- 组件：API Server（入口/鉴权）、Repo Server（Git/Helm 渲染成期望清单）、Application Controller（diff+调和+执行 Sync）、可扩展 Notification Controller。
- 流程：Webhook/定时刷新 → RepoServer 渲染（Kustomize/Helm 参数化）→ AppController 与集群 live 状态 diff → UI 标 OutOfSync → 按 syncPolicy（automated?）与 Wave 顺序 apply → 资源健康评估（Readiness/Health Lua 规则）→ Synced+Healthy。
- 加分：数据面故障时 Argo 不影响应用运行（它只管控制回路）；istiod 类比——控制面与运行时解耦是共同设计哲学。

## 题 3：漂移（drift）怎么处理？生产着火要热修怎么办？

- 检测：diff 常亮 OutOfSync + Notification 规则外发告警（错误做法：靠人盯 UI）。
- 治理：selfHeal 自动掰回 + AppProject 限制可部署资源 + K8s 侧对人类 SA 收紧 prod namespace 写权限（双保险：Argo 纠偏、入口也少）。
- 热修标准动作：改 Git → 走加急 MR（预审批 CODEOWNERS+快速 CI）→ Argo 同步；紧急到分钟级也要留"事后补单"纪律，绝不允许 kubectl edit 裸改——它会被 selfHeal 掰走造成二次事故（真实事故模式）。
- 加分：灰度例外用 managed-by 注解或 ignoreDifferences 让 Argo 容忍受控差异（如 HPA 管的 replicas，s3-1 联动）。

## 题 4：App of Apps 解决什么问题？（预告 s1-2，先答概念）

- 问题：几十个 Application CR 手工 kubectl apply、批量操作与审计困难。
- 方案：一个"根 Application"的 source 指向存放 App 清单的目录，根应用调和时自动创建/更新全部子应用——应用清单本身也 GitOps 化（递归）。
- 风险：根仓一次坏提交炸全部应用（爆炸半径），要配 ignoreDifferences、分项目分根、以及子应用 syncWave 控制重启风暴。

## 题 5：GitOps 下 CI 的角色变成什么？

- CI 三件事不变：构建、测试、出镜像（sha 不可变 tag）；发布动作从"apply 到集群"改为"向 manifests 仓提 MR 改 image tag"。
- 效果：CI 凭证从生产 kubeconfig 降级为"manifests 仓窄写权限"（结果：攻击面质变）；CD 状态机归 Argo，CI 不再关心集群是否可达。
- 加分：晋级模型（dev→staging→prod 逐级 merge/promote）与环境提升自动化（Argo CD Image Updater 或自建机器人）说一个实际用过的。

## 题 6：Argo CD 自身挂了/被删了，集群会怎样？要注意什么？

- 运行中应用不受影响（声明已落 etcd，调和循环只是纠偏与推进）——但新变更停摆、漂移不再纠正、故障回滚也得等它活。
- 所以 Argo 是"集群里的生产系统"：多副本+反亲和（kubernetes s3-2）、PDB、备份（Application/Secret/RBAC ConfigMap 定时导出入 Git 或对象存储——argocd-autobackup 类方案）。
- 自举悖论加分答法：Argo 自己用 manifest 手工装+文档化 runbook（第一性原则：总有一个 GitOps 之外的 bootstrap 层要能人肉恢复）；删除 Argo CRD 会级联删 managed 资源吗——要演练验证（错误预期：不测就当它不会）。
