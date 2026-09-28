# GitOps 原理与 Argo CD 架构 · 作业

## 作业 1：kind 环境跑通最小 GitOps 闭环

**目标**：体验"合并即发布"完整链路。

1. kind 集群装 Argo CD（官方 install.yaml 清单或 helm chart），port-forward API；建 manifests 仓含一个 nginx Deployment 的 overlay 目录（验收：Application Synced+Healthy 绿图）。
2. 改一份副本数提交合并，观察 Argo 自动 Sync 的过程与 UI diff（输出：OutOfSync→Synced 时间线）。
3. `kubectl scale` 手改副本数，验证 selfHeal 在 3 分钟内把改动掰回并记录事件（错误用例体验：热修为何必须走 Git）。

## 作业 2：漂移收编与权限建模

**目标**：把"先跑着"的裸资源纳入声明式管理。

1. 在集群手工创建 3 个未入 Git 的资源，用导出+清洗（去 status/resourceVersion）把它们收编进 manifests 仓，让 diff 归零（结果：收编 PR 清单）。
2. 建 AppProject：team-a 只能在 shop-dev ns 部署 Deployment/Service/ConfigMap，尝试部署 ClusterRole 应被拒（输出：拒绝报错原文）。
3. 给"只读组"配 RBAC 查看两个 project 的应用，验证其 Sync 按钮不可见（说明：RBAC 生效证据截图）。

## 作业 3：Sync Wave 与迁移编排

**目标**：复现"schema 先于应用"的发布顺序。

1. 写一个 PreSync/wave -10 的 flyway Job + wave 0 的 Deployment，触发一次同步，用日志时间戳证明执行顺序（验收：wave 顺序证据表）。
2. 让迁移 Job 故意失败（错误 SQL），观察后续资源是否照常 apply，再配置 Hook 失败中断同步修复它（异常场景→治理闭环）。
3. 思考题：为什么"等 Job 成功"比"sleep 30"可靠，写 5 行答案。
