# App of Apps、镜像升级与自动回滚 · 面试题

## 题 1：App of Apps 模式解决什么问题？有什么风险？

- 解决"应用注册也要人肉 `argocd app create`"的问题：子 Application 清单存进 Git，由根应用统一同步，全集群应用清单可审计、可灾备（重建集群只 apply 根应用）。
- 风险一：根应用开 prune 时，误删/移动子应用清单文件会级联删除整棵业务子树；风险二：仓库膨胀拖慢渲染；风险三：根应用权限收敛不当等于交出集群级 RBAC。
- 缓解：prune/selfHeal 只开在叶子应用、根清单加 `resources-finalizer.argocd.argoproj.io`、用 AppProject 限制子应用可管的命名空间与资源类型。

## 题 2：Image Updater 是推还是拉？违反 GitOps 原则吗？

- Argo CD 本体是拉模型；Image Updater 监视镜像仓库，把新版本 tag 写回 Git——写回的仍是 Git，集群依旧只认 Git 事实源，不违反四原则。
- 区别只在"版本字段的提交者从人变成机器人"；它与 CI 直接回调 `argocd app sync`（推命令、不改 Git）本质不同，后者造成集群领先 Git 的漂移。
- 追问点：allow-tags/ignore-tags、update-strategy（latest/semantic-version/digest）、写回路径要和 Helm values 或 Kustomize images 字段对应，否则写到不影响渲染的位置。

## 题 3：selfHeal 和手动 kubectl 改集群会打架吗？回滚时怎么配合？

- 会：selfHeal 开启后 `kubectl edit/delete` 会在下个调和周期被改回 Git 声明，线上手改是无效操作。
- UI rollback 让集群领先 Git（OutOfSync），selfHeal 又会把集群拉回有问题的版本，等于回滚被撤销。
- 三层回滚顺序：应用层 UI rollback 止血 → `git revert` 固化到 Git → 必要时流量层切回旧版本兜底；应急例外 `kubectl rollout undo` 事后必须补 Git 提交。

## 题 4：镜像升级用 tag 还是 digest？

- 可变 tag（latest/main）同名不同字节，会导致"Git 没变镜像变了"或回滚到已被覆盖的标签；语义化不可变 tag 是底线，生产禁 latest。
- digest 不可变、可精确重现，缺点是 diff 不可读；推荐 tag+digest 双写（Git 留可读 tag，生效靠 digest）。
- 回滚精度视角：Revision 回滚回的是"渲染结果"，只有 digest 才能保证那棵镜像字节没变。

## 题 5：一次 Sync 同时改 Deployment、Service、CRD 实例，如何控制顺序与失败半径？

- `argocd.argoproj.io/sync-wave` 排序：CRD/Namespace/migration Job 放负波次，工作负载 0，依赖方正波次。
- 需要"跑完再继续"用 Hook（PreSync/PostSync/SyncFail）+ `hook-delete-policy` 保证 Job 幂等。
- 失败半径：`create-resources=true` 防并发 Apply 打爆 API Server、调大 APPLY 超时、高风险变更拆独立 Application、AppProject 级 Sync Window 限制生产可同步时段。

## 题 6：Argo CD 或 Git 服务本身挂了，怎么回滚？

- Argo CD 是控制面，挂掉不影响运行中负载，但失去发布能力：bypass 通道 `kubectl rollout undo --to-revision=N`（revisionHistoryLimit 要提前调大），属允许漂移的应急例外，事后补 Git。
- Git 不可用时无法生成新期望状态，凸显集群内 Revision 兜底与镜像仓库保留旧版本。
- 体系化：Argo CD HA 部署（多副本 + Redis HA）、回滚 runbook 含人肉路径并定期演练——工具链故障时演练过的肌肉记忆是最后安全网。
