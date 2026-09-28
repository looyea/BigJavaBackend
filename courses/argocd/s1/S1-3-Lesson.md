# 与 Flux 及推拉模型对比（关联）

> 本节难度：★★★☆☆
> 本节重要性：★★☆☆☆
> 学习产出：能从架构形态、调和粒度、多租户与安全边界四个维度对比 Argo CD 与 Flux，准确表述推拉模型的适用边界，并给出团队场景下的选型结论。

## 一、同一套原则，两种形态

GitOps 四原则（声明式、版本化、自动拉取、持续调和）里，Argo CD 与 Flux 的差异不在理念而在形态：Argo CD 是一个带 Web UI 与 API Server 的"平台"，应用以自定义资源 Application 为中心，配置仓库与集群凭据都由它自己管理；Flux 是一组松耦合控制器（source-controller、kustomize-controller、helm-controller、notification-controller 等），没有 UI，一切通过 Git 里的 CR（GitRepository、Kustomization、HelmRelease）表达，凭据就是普通 Secret。理解这一点，下面的对比都是它的推论。

## 二、核心能力对照表

| 维度 | Argo CD | Flux CD |
|------|---------|---------|
| 调和单元 | Application（一个应用一棵资源树） | Kustomization/HelmRelease（一个目录/一个 Chart） |
| 界面 | 成熟 Web UI + CLI + API，适合多角色 | 仅 CLI（`flux get kustomizations`） |
| 多租户 | AppProject 原生隔离仓库/集群/权限 | 依赖 K8s RBAC + Namespace 划分 |
| 仓库访问 | 凭据存在 Argo CD，服务端渲染 | source-controller 拉取缓存为 Artifact，控制器读本地 |
| 应用内 Helm | 内置渲染 + HelmRelease 式参数 | helm-controller 原生管 HelmRelease，支持 OCI Chart |
| CI 集成 | 可完全脱离 CI（Repo Generator/Image Updater） | 天然搭配 CI 写 Git（无自动镜像升级内置，需 image-automation-controller） |
| 资源删除 | 开 prune 才删，默认保守 | GC 策略按 Kustomization 声明，默认删除托管资源 |
| 运维心智 | 一个系统一个入口 | 微服务化控制器，排障看多个组件 |

## 三、代码形态对比

Flux 侧声明一个应用同步的最小三件套：

```yaml
# 目的：Flux 用四类 CR 把"来源→制品→调和→通知"拆成独立控制器
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: demo-app            # 每个来源一个 Artifact 缓存，控制器不直连 Git
  namespace: flux-system
spec:
  interval: 1m              # 结果：拉取频率即检测延迟上界
  url: https://git.example.com/config/demo.git
  ref: { branch: main }
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: demo-app
  namespace: flux-system
spec:
  interval: 5m
  path: "./deploy/overlays/prod"
  sourceRef: { kind: GitRepository, name: demo-app }
  prune: true               # 说明：Flux 的 GC 默认更主动，Git 删了集群就删
  healthChecks:
    - kind: Deployment      # 依赖等待：等 Deployment Ready 才放行下游
      name: demo-frontend
```

Argo CD 等价物是一个 Application（见上一节），差别一目了然：Flux 把 Argo CD 内部的一个 Application 拆成了"来源 + 调和"两个可复用对象，多个 Kustomization 可以共享同一个 GitRepository。

## 四、推拉模型：什么时候"推"仍然是对的

反例是先看清边界再选工具：

```bash
# 错误用法：CI 流水线里直接推送到集群，绕过 Git 事实源
kubectl apply -f deploy/prod/            # ❌ 集群状态领先 Git，无法审计谁部署了什么
helm upgrade --install demo ./chart      # 异常时本地未提交的 values 造成配置漂移

# 正确用法一：CI 只写 Git（推的是"意图"，拉的是"状态"）
git commit -am "release: demo v1.4.2" && git push   # 结果：Argo CD/Flux 拉取调和

# 正确用法二：保留推模型的合理场景——即时性要求高的命令
argocd app sync demo --prune             # 说明：Sync Window 内的手动加速，Git 仍是声明源
flux reconcile kustomization demo-app --with-source   # 强制立即调和一次，语义无损
```

推模型（Jenkins `kubectl apply`）并非全错：一次性迁移脚本、紧急 patch、以及没有 K8s 平台团队的纯 VM 发布仍适用。但只要环境超过两套、参与者超过两人，拉模型带来的"Git 历史 = 部署历史"就开始压倒性胜出。混合形态（CI 推镜像 + Image Updater 写 Git + CD 拉取调和）是当前 Spring Boot 团队的主流落地。

## 五、选型判据

- 团队要 UI、要给开发/测试自助看发布状态、要 AppProject 多租户 → Argo CD；
- 团队 K8s 原生功力强、追求轻资产无额外系统、想用标准 RBAC 管权限 → Flux；
- 已有大规模 Jenkins、只想要一个"部署机器人" → Argo CD 的 sync window + CLI 更省事；
- 金融类强审计场景：两者都满足"部署历史即 Git 历史"，差异在 Argo CD 的 RBAC 事件日志更细、Flux 依赖 K8s audit log——把选型写进合规证据链即可，不必为此换工具。

## 六、关联技术

与 [GitLab CI](../../gitlab-ci/s1/S1-1-Lesson.md) 衔接：CI 止于"镜像 + Git 提交"，CD 段交给拉模型；与 [缓存、制品与 K8s 部署集成](../../gitlab-ci/s1/S1-2-Lesson.md) 衔接：两工具都是 Helm/Kustomize 渲染器的消费者；与 [Kubernetes](../../kubernetes/s1/S1-1-Lesson.md) 衔接：CR + 控制器模式是一切 GitOps 工具的同源设计。
