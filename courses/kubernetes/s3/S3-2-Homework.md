# 调度、亲和/污点与命名空间/RBAC · 作业

## 作业 1：打散与独占实操

**目标**：在 kind 多节点集群复现两类调度约束的效果。

1. 3 节点集群部署 6 副本 nginx，先不加约束观察分布，再加 podAntiAffinity（preferred, hostname）重部署，记录两次的节点分布表（验收：打散前后对比）。
2. 给 node3 打 `dedicated=promo:NoSchedule` 污点，验证普通 Pod 调度不进去（输出：FailedScheduling 事件原文），补 toleration+nodeAffinity 后验证只落 node3（错误用例→修复完整链路）。
3. 思考题（写在报告里）：把污点换成 NoExecute 再观察已有 Pod 命运，说明 tolerationSeconds 的作用。

## 作业 2：多租户权限建模

**目标**：为一个"开发只读、运维可改"的双团队场景建 RBAC。

1. 建 shop-dev/shop-ops 两个 ns，各配 ResourceQuota（pods 上限 10）（说明：故意在 dev 建第 11 个 Pod，记录配额拒绝的报错原文）。
2. 创建 role：dev-team（只读 pods/pods/log）与 ops-team（可 deployments 增删改），分别绑定两个真实 kubeconfig 用户。
3. 用 `kubectl auth can-i --as` 交叉验证 6 种组合（读/写 × dev/ops × 本 ns/跨 ns），输出一张允许矩阵（验收：跨 ns 全 Forbidden、ops 不能删 pods）。

## 作业 3：Pending 事故模拟复盘

**目标**：制造并解决一次多原因叠加的"调度不上"故障。

1. 组合出至少两种同时成立的原因（如 requests 总量超节点池 + 未容忍污点），部署后抓取 describe 的 Events（结果：多原因计数文案如何读）。
2. 按"事件→节点→配额→ autoscaler"四步写排查手册，每步给命令与期望输出。
3. 修复后记录每步动作与生效证据（至少 3 项）。
