# 与 GitLab CI 的取舍（关联） · 面试题

## 题 1：两个平台你会怎么选？给个决策框架。

- 四问定方向：代码托管在哪（迁移摩擦最小）？合规边界（能否出内网/出境）？生态依赖（Marketplace 集成密度 vs All-in-one 内置件）？成本模型（分钟计费+并发上限 vs 自养 Runner 人力）？
- 倾向结论（答法）：GitHub 主阵地/开源项目→Actions；自建 GitLab 深度用户/强合规→GitLab CI；都不是非此即彼，脚本层统一后平台可换（结果：决策可逆性是架构属性）。

## 题 2：从 Actions 迁到 GitLab CI，哪些机制要重写？

1. 触发：on 事件+if → workflow:rules（流水线级）+ Job rules；双跑治理思路从"事件分工"换成"流水线裁决"。
2. 产物：upload/download-artifact → artifacts:paths 自动传递（可以更省代码）；缓存：actions/cache(key/restore-keys) → GitLab cache 必须把 .m2 指进项目目录+policy 模型（错误预期：paths 直译缓存全空）。
3. 复用：reusable workflow/composite → include 远程模板仓 + YAML anchors（GitLab 无"打包 step"原生形态，靠模板抽象）。
4. 凭证：secrets/environment 审批 → Protected+Masked 变量 + protected environments/approvals；matrix：strategy.matrix → parallel:matrix。

## 题 3：为什么 GitLab 用户常说"All-in-one"是优势？举例说明。

- MR 合入门禁直接消费流水线状态与代码所有者审批，同一平台闭环（Actions 侧要配 branch protection+多 check）。
- 内置容器 registry 与 CI 变量免密打通（CI_REGISTRY_USER 即登录凭证）；制品仓、环境页、部署 trace 同数据模型（示例：环境页回看每次部署对应哪条流水线哪个 commit）。
- 安全扫描（SAST/DAST/依赖）出报告进 MR 卡片统一查看（说明：省掉第三方集成维护）。
- 加分：承认代价——自建升级运维重、Marketplace 广度不及 Actions，权衡作答才显资深。

## 题 4：Actions 相对 GitLab CI 的强项呢？

- 生态：Marketplace 覆盖云厂商/工具链，setup-* 与 OIDC 集成成熟——新工具接入几乎零成本（结果：集成密度即开发速度）。
- 托管 Runner 体验：秒级领机、镜像常新、免运维；matrix+表达式系统写复杂逻辑更顺手（fromJSON 动态矩阵等）。
- 开源友好：公开仓库免费额度慷慨，社区 PR 协作门禁开箱即用（GitLab SaaS 共享分钟数相对紧）。
- 加分：指出托管的短板（内网不可达、分钟账单、macOS 高价系数）表明不是单边吹。

## 题 5：双平台长期共存的团队，怎么防止 CI 行为漂移？

- 分层纪律：构建/测试/扫描语义全部收敛到脚本或容器（make ci / devcontainer），两侧 YAML 只保留触发、Runner、凭证、产物四件胶水（可复现：本地跑同一条命令）。
- 单一事实源：共享脚本版本化在独立仓，两侧模板引用同一 tag；CI 变更走"脚本先合、胶水后补"顺序。
- 验证机制：契约测试——同 commit 双跑比对结果与产物指纹；漂移告警（两侧时长差、失败率差进看板）。

## 题 6：面试官问"CI 慢且贵，两平台各怎么治理"，各给三条。

- Actions：concurrency 取消过期跑；matrix 分级（PR 单 JDK、main 全矩阵）+paths 过滤缩触发面；缓存（setup-java/hashFiles）+托管换 self-hosted 混合（Linux 大 Job 复用长驻机摊薄分钟费）。
- GitLab：needs DAG 砍墙钟；cache key/policy 治理+私服（Nexus）消下载量；Runner 上 K8s 弹性+按 tag 分池，配 interruptible 与 expire_in 控资源与存储账单（结果：两边共性答案都是"少跑、并行、缓存复用"，说出共性即通透）。
