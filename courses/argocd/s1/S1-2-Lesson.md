# App of Apps、镜像升级与自动回滚

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：会用 App of Apps/root 模式组织多应用清单，能搭起 Image Updater 的"新镜像→自动改 tag→自动同步"晋级链，并设计带门禁与止损的自动回滚策略。

## 一、App of Apps：应用清单也是应用

```yaml
# root-app：source 指向存放各 Application YAML 的目录，子应用由它调和创建（说明：目录组织即租户/环境树）
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: root-prod, namespace: argocd }
spec:
  project: platform
  source: { repoURL: https://git.example.com/shop/manifests.git,
            targetRevision: main, path: apps/prod }        # 该目录下每个 yml 是一个应用
  destination: { server: https://kubernetes.default.svc, namespace: argocd }
  syncPolicy: { automated: { prune: true } }
  # 反例：prune+递归一改动，误删目录里一个 yml=整应用被级联删除（异常：git revert 前集群已空——子应用要加 finalizer/分根控制）
---
# 子应用片段：syncWave 控制根同步时的创建次序
metadata:
  annotations: { argocd.argoproj.io/sync-wave: "5" }
```

- 治理点：根应用与子应用分 AppProject；平台组持根，业务组只改自己子应用的 overlay（结果：爆炸半径受控的层级授权）。

## 二、镜像晋级：Image Updater 链

```yaml
# Application 注解声明"盯哪个 registry、怎么提升"（示例：ECR/GitLab registry 半自动策略）
metadata:
  annotations:
    argocd-image-updater.argoproj.io/image-list: order=registry.example.com/shop/order
    argocd-image-updater.argoproj.io/order.pull-secret: pullmode:cluster
    argocd-image-updater.argoproj.io/order.writeback-method: branch         # 写回 manifests 仓新 commit
    argocd-image-updater.argoproj.io/order.allow-tags: stable,^v\d+\.\d+\.\d+$
    argocd-image-updater.argoproj.io/order.ignore-tags: dev-*              # 错误预期：不过滤 → dev 镜像一路裸奔进 prod
spec:
  syncPolicy: { automated: { prune: true, selfHeal: true } }
```

- 两种姿势：①直接写回 main+automated sync（快，但门禁只剩 tag 规则）；②写回开 MR，人/流水线批准后合并（金融/电力合规常选，结果：晋级=一次可评审的提交）。
- 更严的晋级：staging 验证过的 digest 用"promote 机器人"抄到 prod overlay（同 digest 不同 tag 是最稳的可追溯链）。

## 三、自动回滚的三层设计

```text
图目的：谁在什么信号下执行哪种回滚。
L1 Git revert：人/机器人把 manifests 仓回退旧 commit → Argo 同步回去（普适、可审计，默认主路径）。
L2 Argo rollback：argocd app rollback <app> <revision>（UI 历史版本一键）——应急用，会造成 Git 与集群短暂背离，事后必须补 revert（反例：只点按钮不改 Git=下次 selfHeal 又滚回坏版本，二次事故根源）。
L3 自动判定：接 Notification/Analysis（Argo Rollouts AnalysisTemplate 查 Prometheus：错误率/P99 超阈值 → 自动 git revert 或 rollout undo）。
```

- 门禁四件套才敢全自动：健康评估基于真实 readiness（kubernetes s1-3）+ 金丝雀放量 + 指标回滚阈值 + 冷却窗（错误预期："同步失败自动重试 5 次"当回滚用——重试的是坏版本，越重试越糟）。

## 四、一个可抄的 prod 发布流

1. CI：镜像 `:sha` 推仓 → 向 manifests 开 MR（staging 段）→ CI 绿+自动合并 → Argo 同步 staging。
2. 晋级：staging 冒烟 10min 无告警 → promote 机器人向 prod overlay 提 MR（同一 digest）→ 值班审批合并。
3. 防线：prod 开 automated+selfHeal；Argo Rollouts 金丝雀 5%→25%→100%，Analysis 查 err_rate>1% 自动 abort+revert；通知进值班群。

## 五、常见故障对照

- 应用莫名 OutOfSync 且 diff 抖动：writeback 与人工改动打架/Helm 渲染非幂等（异常：每次渲染时间戳入注释——repo 参数固定化解决）。
- Image Updater 不动：pull-secret 无权限、tag 正则不匹配、ignore 过宽（结果：先 `kubectl logs deploy/argocd-image-updater` 看拉取名单）。
- 回滚"回不去"：依赖资源（CRD/Secret）被 prune 先删——回滚单元要与依赖一起进 Git 历史。

## 六、关联技术

- 根模式的手动起点（单 Application）见 s1-1；推拉对比与 Flux 的 GC（image automation）见 s1-3。
- 指标门禁的查询侧是 prometheus/grafana 包；金丝雀与流量放大关系见 istio s1-2、argo-rollouts 与探针协同见 kubernetes s1-2/s1-3。
