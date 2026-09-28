# App of Apps、镜像升级与自动回滚 · 作业

## 作业 1：搭建 App of Apps 根应用骨架

**目标**：用一个根 Application 管理整个集群的 GitOps 声明，体会 prune 级联删除的风险边界。

**任务**：
1. 在配置仓库建立 `apps/` 目录，为 `demo-frontend`、`demo-backend` 各写一个 Application 清单（Helm 或 Kustomize 均可）；
2. 编写根 Application（`type: sync` 的 App of Apps 模式），`destination` 指向本集群，`source.path` 指向 `apps/`；
3. 开启 `automated: {prune: true, selfHeal: true}`，观察根应用与子应用的健康传播；
4. **破坏性实验（在测试集群做）**：从 `apps/` 删除 `demo-frontend` 的 Application 文件并提交，观察发生了什么、多久发生；再用 `argocd app set demo-backend --sync-policy none` 验证如何临时摘除自动 prune。

**验收标准**：能截图展示根应用树下 2 个子应用均 Synced/Healthy；能准确说出删除清单文件后子应用被 prune 的时序；能说明把 prune 限定在子应用级别（根应用关 prune、子应用开 prune）的配置方法。

**参考解法要点**：根应用只负责"发现"子应用；prune/selfHeal 建议开在叶子应用上，根应用清单文件本身被删除时级联删除整棵子树，这是 App of Apps 最大的操作风险点，须配合 `resources-finalizer.argocd.argoproj.io` 或受限的 project 权限兜底。

## 作业 2：接入 Image Updater 完成一次自动镜像升级

**目标**：跑通"CI 推镜像 → Git 自动提交新 tag → Argo CD 自动同步"的完整链路。

**任务**：
1. 给目标应用注解 `argocd-image-updater.argocd.io/demo-image.update-strategy=latest`，并配置 allow-tags 只放行 `v*` 与 `main-*`，ignore-tags 排除 `*-rc*`；
2. 向镜像仓库推送 `v1.0.1` 与 `v1.1.0-rc1` 两个标签，等待一个轮询周期；
3. 检查 Git 提交：镜像升级提交必须只改 tag（或 digest），并带有 `[image-updater]` 标记信息；
4. 人为推送一个 `v1.0.2-bad` 版本并用 UI 回滚，随后补一次 `git revert` 把回滚落到 Git。

**验收标准**：`v1.1.0-rc1` 不触发升级；Git 中出现 image-updater 的自动提交且 Argo CD 显示 OutOfSync→Synced 收敛；回滚后 Git 与集群状态最终一致（不存在"集群新、Git 旧"或反向漂移）。

## 作业 3：设计三层回滚预案（文档题）

针对一个 Spring Boot 服务，写出三层回滚各自的操作、触发条件与数据兼容性约束：

| 层 | 操作手段 | 触发条件 | 数据结构约束 |
|----|---------|---------|-------------|
| 应用层 | Argo CD UI rollback / kubectl rollout undo | 错误率、RT 超阈值 | 需说明 DB migration 是否回滚 |
| Git 层 | git revert + 自动同步 | 应用层回滚成功后固化 | 必须与上层保持最终一致 |
| 流量层 | Ingress/Service 权重或回指旧版本 Deployment | Git 链路本身故障时 | 旧版本镜像须保留在仓库 |

**验收标准**：明确指出"只回滚应用不回滚 Flyway 已执行的 DDL"这类不可逆点，并给出版本前向兼容（expand-contract）的应对方式。
