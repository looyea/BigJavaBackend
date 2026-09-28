# 流水线模型：Stage/Job/Script 与 Runner · 面试题

## 题 1：讲一下 .gitlab-ci.yml 的执行模型。

- stages 声明串行阶段，Job 归属某 stage，同 stage 并行、各跑各的容器（Docker executor）；script 是逐条 shell，首条非 0 退出即 Job 失败。
- 全局 default 收口 image/retry，variables 分层覆盖，include 引模板仓复用；rules 在"流水线构建时"决定 Job 创建与否及触发方式。
- 加分：needs 把阶段屏障改成 DAG，墙钟按关键路径；这题答出"声明式 YAML→Server 建流水线→Runner 领 Job"三层分工即及格。

## 题 2：Stage 屏障和 needs 有什么取舍？你们项目怎么选？

- 纯 stages：模型简单、语义是"质量门"——test 全绿才可能进 deploy，评审与合规友好。
- needs：提速明显（构建 10 模块时 test 不必等最慢模块），但滥用会让"门"破碎——deploy needs 了 build 却绕过了 test（错误用法：DAG 边漏配导致未测代码进生产）。
- 我方做法（答法）：主干保持 stage 语义做质量门，stage 内部用 needs/pipeline 拆并行；发布类 Job 的 needs 必须显式列全上游，CI 模板里用强制变量防漏。

## 题 3：共享 Runner、项目 Runner、K8s executor 怎么选型？

- 共享 Runner（GitLab.com SaaS/公司公共池）：零运维，按分钟计费/排队，环境靠 image 自拉——起步团队默认。
- 项目专属 Shell/Docker Runner（自建 VM）：贴近内网资源与特殊硬件（签名机、GPU），但要养机器、管升级（反例：Runner 宿主机装了 JDK8 所有 Job 被迫继承）。
- Kubernetes executor：Runner 把每个 Job 开成 K8s Pod，弹性与隔离最好、复用现有集群与私有镜像仓，运维成本是 RBAC/配额/日志方案（说明：规模化后的主流终态）。
- 加分：tag 路由 + concurrency 限流 + 缓存 S3 化是配套的三件事。

## 题 4：流水线 pending / 一直转圈，你的排查路径？

1. 有没有 Runner 接单：Job 详情看 token/tags 匹配、Runner 在线与并发占满（结果：最常见是 tag 打错或 Runner 掉线）。
2. 有 Runner 但起不来容器：镜像拉取慢/私有仓认证失败（image pull backoff 类错误在 Runner 日志不在 Job 日志，异常点常被忽略）。
3. 卡住不结束：script 里有交互式命令等 stdin、或 `docker:dind` 未配 privileged（说明：CI 里"等输入"表现为超时而非报错）。
4. 平台侧：流水线并发/项目配额、stages 循环依赖 lint 通过但调度死锁（needs 环）。

## 题 5：rules、only/except、workflow:rules 三者关系？

- only/except 是旧语法，功能子集；新项目一律 rules（表达能力：if/changes/exists + when + 变量判断）。
- workflow:rules 在**流水线级**决定这次 push/MR/定时要不要建整条流水线（示例：`workflow: rules: [{if: MR event}, {if: default branch}]` 避免 push 与 MR 双跑重复流水线——高频真实痛点）。
- Job 级 rules 决定单个 Job；两层组合才是完整触发模型，只答 Job 级则不完整。

## 题 6：如何防止"点错环境发布"这类人祸？

- 结构上：environment 与分支/变量绑定——deploy-prod 的 rules 仅放行受保护 tag/默认分支，KUBECONFIG 用 protected+masked 变量，feature 分支拿不到生产凭证（异常：环境变量作用域不设保护，测试流水线照样能发生产）。
- 流程上：when: manual + 审批（protected environments 的 approval rules），发布 Job 记录操作人进审计。
- 兜底：生产集群 RBAC 给 CI SA 限定命名空间（关联 kubernetes s3-2），即使 YAML 被改也打不出权限；再加 GitOps（ArgoCD）时 CI 只改 manifest，发布=合并 MR（结果：把"点按钮"变成"过评审"）。
