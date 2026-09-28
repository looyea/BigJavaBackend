# 与 Flux 及推拉模型对比（关联） · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. Argo CD 与 Flux 在架构形态上的根本差异是？（6分）

- A. Argo CD 是带 UI/API 的平台、以 Application 为中心；Flux 是无 UI 的控制器集合、以 Git 中的 CR 表达一切
- B. Argo CD 只支持 Helm，Flux 只支持 Kustomize
- C. Argo CD 是推模型，Flux 是拉模型
- D. Flux 需要自建数据库存储状态，Argo CD 不需要
> 答案：A
> 解析：两者都是拉模型 GitOps 实现，差异在"平台化 vs 控制器原语化"，A 是全部对比结论的源头。

### 2. Flux 中负责"从 Git 拉取并缓存制品"的组件是？（6分）

- A. kustomize-controller
- B. source-controller
- C. helm-controller
- D. notification-controller
> 答案：B
> 解析：source-controller 把 Git/Helm Chart/镜像来源物化为 Artifact，kustomize-controller 消费的是本地缓存而非直连 Git。

### 3. 关于多租户权限隔离，正确的表述是？（6分）

- A. Flux 提供 AppProject 原语做仓库/集群级隔离
- B. Argo CD 只能依赖 K8s RBAC，没有自己的隔离模型
- C. Argo CD 用 AppProject 原生隔离，Flux 依赖 K8s RBAC + Namespace 划分
- D. 两者都没有多租户能力
> 答案：C
> 解析：AppProject 是 Argo CD 独有抽象；Flux 走 K8s 原生路线，权限完全交给 RBAC。

### 4. 在 CI 流水线里执行 `kubectl apply` 部署到集群，最主要的问题是？（6分）

- A. 命令太慢
- B. 集群状态领先 Git，失去单一事实源与可审计性
- C. kubectl 不支持回滚
- D. Helm Chart 无法被解析
> 答案：B
> 解析：推命令不改 Git，"谁部署了什么"从 Git 历史消失，漂移无法被调和纠正，这正是拉模型要解决的痛点。

### 5. 关于资源删除语义，下列说法正确的是？（6分）

- A. Argo CD 默认删除 Git 中已移除的资源，Flux 从不删除
- B. Flux 默认删除托管资源（GC），Argo CD 需显式开启 prune
- C. 两者都必须显式开启才敢删除
- D. 开启 prune 后误删清单文件也不会影响集群
> 答案：B
> 解析：Flux 的 GC 策略更主动；Argo CD 默认保守、prune: true 才删——也因此 prune 误删风险要在根应用上谨慎开启。

### 6. 以下哪个场景仍然适合保留"推"模型？（6分）

- A. 超过 10 个微服务的日常发布
- B. 需要审计留痕的金融生产发布
- C. 一次性数据迁移脚本与紧急 patch
- D. 多环境配置同步
> 答案：C
> 解析：即时性高、一次性的操作推模型更直接；A/B/D 都能从 Git 单一事实源获得更大收益。

### 7. "CI 推镜像 → 机器人写 Git → CD 拉取调和"的混合形态中，真正改变集群状态的执行者是？（6分）

- A. CI 流水线
- B. 镜像仓库
- C. CD 控制器的调和循环
- D. Image Updater
> 答案：C
> 解析：Image Updater 只写 Git（提交新 tag），集群侧仍由 Argo CD/Flux 的调和循环 apply，事实源保持为 Git。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）相比 Flux，选择 Argo CD 的合理理由包括？（9分）

- A. 需要 Web UI 让测试与运维自助查看发布状态与历史
- B. 需要用 AppProject 限制不同团队可同步的仓库与命名空间
- C. Flux 完全不支持 Helm 部署
- D. 希望借助 Repo Generator/Image Updater 让发布尽量脱离 CI 脚本
> 答案：ABD
> 解析：C 错误——helm-controller 原生支持 HelmRelease 与 OCI Chart；A/B/D 均是 Argo CD 平台化形态的直接收益。

### 9. （多选）关于推拉模型的判断，正确的有？（9分）

- A. 拉模型下 `kubectl edit` 造成的漂移会在下个调和周期被纠正
- B. `argocd app sync`、`flux reconcile` 属于"加速拉取"，不破坏 GitOps 语义
- C. 只要用了 Git 仓库，就自动满足 GitOps
- D. 推模型的最大优势是无需任何 CD 系统，冷启动成本低
> 答案：ABD
> 解析：C 错误——把 Git 当配置存储但由人肉 apply，不满足"自动拉取 + 持续调和"；B 中手动 sync/reconcile 只是立即执行一次收敛，声明源没变。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 你的团队要为一个 20 个 Spring Boot 服务的电商集群选型 CD 工具（Argo CD vs Flux），并说明与现有 GitLab CI 的边界划分。请给出完整论证。（40分）

> 参考答案：
- 要点1：先陈述两者共同的 GitOps 底座（声明式、Git 单一事实源、拉取调和），说明选型不改变原则只改变形态；
- 要点2：列出 Argo CD 优势——Web UI 自助、AppProject 多租户、Image Updater/Repo Generator 降低 CI 耦合；
- 要点3：列出 Flux 优势——无额外平台、K8s 原生 RBAC/Secret、控制器可组合、资源占用小；
- 要点4：给出团队判据——是否有平台角色、是否需要给非开发角色开界面、K8s 功力强弱；
- 要点5：边界划分——GitLab CI 负责测试/构建镜像/推仓库/向配置仓库提交版本 MR 或直推 main，CD 工具负责调和与状态反馈，失败信号回写 MR；
- 要点6：补充演进与风险——prune/GC 误删防护、Sync Window 与金融审计日志来源差异，给出灰度迁移（先单服务试点）路径。
