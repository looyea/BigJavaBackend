# GitOps 原理与 Argo CD 架构

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：能讲清 GitOps 四原则与"拉模式"相对推模式的价值，画出 Argo CD 四组件架构与调和循环，完成一次 Application/Sync Wave 落地并解释 RBAC 与凭证的收口方式。

## 一、GitOps 四原则

```text
图目的：把"部署"变成一次可审计的 git 合并。
1. 声明式：期望状态全部写进 YAML（K8s 资源清单），"点按钮传参"不算（反例：helm --set 参数散在人脑）。
2. 版本化：期望状态存 Git，每次变更有 commit/作者/评审记录，可回滚=revert。
3. 拉模式：集群内的 agent（Argo CD）主动盯 Git 差异并应用，而不是 CI 拿 kubeconfig 往外推。
4. 调和：实际≠期望就纠正（持续 reconcile）——人手工 kubectl edit 会被"无声掰回来"（结果：漂移不再是玄学）。
```

- 推模式的痛（被对比必考点）：CI 持有生产凭证（攻击面大）、部署历史在 CI 日志里难审计、环境与 Git 状态可能各说各话。

## 二、Argo CD 架构与调和循环

```text
图目的：四组件各干什么。
API Server：UI/CLI/Webhook 入口，鉴权与状态查询
Repo Server：克隆 Git/Helm 仓，渲染出"期望清单"（纯计算，可水平扩）
Application Controller：核心调和——比对 期望 vs 集群实际，驱动同步（watch + 调和循环）
（附属）Notification Controller：事件外发告警
循环：Git 变更/刷新 → 渲染 → diff → Healthy 与否判断 → Sync（按 Wave 顺序 apply）→ 状态回写 UI
```

## 三、第一个 Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: order-service, namespace: argocd }
spec:
  project: shop-prod
  source:
    repoURL: https://git.example.com/shop/manifests.git
    targetRevision: main                 # 错误预期①：指向 feature 分支就等着被合掉后漂移
    path: overlays/prod/order-service    # Kustomize overlay（或 Helm chart 目录）
  destination: { server: https://kubernetes.default.svc, namespace: shop-prod }
  syncPolicy:
    automated: { prune: true, selfHeal: true }   # prune=Git 删了集群也删；selfHeal=手改被掰回
    retry: { limit: 5 }                           # 同步失败自动重试；反例：prune 不开 → Git 删了资源集群残留（漂移的反方向）
# 错误预期②：manifests 仓与应用代码仓混一个 —— CI 每次构建提交触发全网状刷新且权限无法分级（惯例：分仓）
```

## 四、Sync Wave：有顺序的发布

```yaml
# 数据库/schema Job 先于应用 Pod 就绪，靠 wave 注解表达（说明：数字小者先 apply）
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-10"   # flyway schema 迁移
---
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "0"     # Deployment 主体
# 坑：wave 只管 apply 顺序，"等上一批 Healthy 再 apply 下一批"还需 Sync Phase Hook（PreSync）配合；
# 反例：迁移 Job 失败但后续 apply 照做（没配 Hook/Retry），应用连旧库结构启动即崩（异常链路完整复现过）
```

## 五、访问控制与凭证收口

- 身份：OIDC/企业 SSO 接入，本地账号只留给 break-glass；RBAC 策略写在 argocd-rbac-cm（`p proj:shop-prod:applications, get, ...` 按 project/group 授权）。
- 集群凭证：Argo 用"目标集群的 SA token"代管应用，项目(project)限制可部署 namespace 与资源白名单——把"谁能把什么带到哪"变成声明（结果：CI 不再需要生产 kubeconfig，git 合并即发布授权）。
- Git 凭证：deploy key 只读优先；写回（如 image updater）才给最小写权限并限定分支。

## 六、关联技术

- App of Apps/镜像升级/自动回滚见 s1-2；与 Flux 及推拉模型对照见 s1-3。
- CI 侧职责边界（构建镜像、提 MR 改 tag）承接 gitlab-ci s1-2 / github-actions s1-1；就绪与探针语义决定 Argo 判 Healthy 的依据（kubernetes s1-3）。
