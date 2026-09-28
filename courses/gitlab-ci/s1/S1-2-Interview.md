# 缓存、制品与 K8s 部署集成 · 面试题

## 题 1：cache 和 artifacts 分别用来存什么？用错过出过事吗？

- artifacts=流水线内的交付契约：jar/测试报告/覆盖率，随流水线保留、被下游 Job 自动带入，生命周期跟流水线（可设 expire_in）。
- cache=跨流水线的可丢加速层：.m2/repository、node_modules，key 命中才恢复，随时可清不影响正确性。
- 反例（加分答法）：把构建产物塞 cache"以为能传下去"——未命中或被新 key 挤出时下游 Job 拿不到文件，随机失败（异常：只在缓存冷的凌晨出现，极难复现）。

## 题 2：Maven 项目在 GitLab CI 上缓存怎么做才有效？

1. MAVEN_OPTS 设 `-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository`——cache 只抓工作目录内路径（第一大坑，不设等于没缓存）。
2. key 用分支 slug + pom 校验和（cache:key:files），依赖变更自动换代；policy 拆 pull-push/pull 控制谁有权写缓存。
3. SNAPSHOT 依赖要 `-U` 强更并考虑排除出缓存，否则旧快照钉死版本（结果：永远拉到不过期的旧制品）。
- 加分：缓存后端 S3 化 + 命中率指标；私服（Nexus）本身已消掉大半下载量，缓存是二阶优化。

## 题 3：CI 里构建 Docker 镜像有哪些方案？怎么选？

- dind（services 起 docker daemon）：直观，但自建 Runner 要 privileged，有容器逃逸面。
- 挂宿主机 docker.sock（shell/共享 socket）：无特权但 Job 直接操控宿主机 daemon，隔离更差，共享 Runner 禁用（安全隐患更大）。
- kaniko/buildah/img 无 daemon 构建：SaaS 与 K8s executor 主流，慢一点换安全；BuildKit + 缓存 registry 可追回速度。
- 选型答法：托管 Runner→kaniko；自建专属 Runner 且吞吐优先→dind+特权隔离在专用机器；所有方案统一 sha tag+推内置 registry。

## 题 4：讲讲你们从 merge 到生产的流水线交付链。

- 构建：mvn verify（缓存加速）→ jar；镜像：多阶段 Dockerfile 打 sha tag 推 registry → Trivy 扫描阻断高危。
- 发布：helm upgrade --wait 到 staging，冒烟测试 Job 过 → 生产 manual/审批或 GitOps MR 合并；environment 记录版本对应关系。
- 回滚：helm rollback 或旧 sha 重放发布 Job；数据库变更走独立 flyway 阶段且有回滚脚本（结果：应用回滚与数据回滚解耦说明）。
- 加分：讲清"谁触发、谁审批、凭证作用域、就绪门禁"四个治理点即资深水位。

## 题 5：发布 Job 绿了但线上没新版本，可能的原因？

1. tag 语义失效：镜像用 latest 或固定 tag，节点缓存旧镜像（ImagePullPolicy IfNotPresent）——部署"没生效"头号假象（异常：describe pod 看 imageID 仍是旧 digest）。
2. 变量没贯通：helm --set 的 image.tag 没引用到 CI 变量，values 覆盖了模板（错误用法：优先级 values.yaml > --set 搞反）。
3. rollout 实际没完成就返回：没加 --wait/rollout status，新 Pod 卡 Pending/探针失败旧版本还在服务（结果：绿是提交绿不是可用绿）。
4. 发错了集群/namespace：kubeconfig 环境指向错、或 GitOps 仓库与集群不同步。
- 答题结构：镜像层→模板层→门禁层→环境层，四层各给一条验证命令。

## 题 6：CI 凭证管理的底线做法？kubeconfig 泄漏怎么止损？

- 底线：Protected+Masked 变量、按 Job/环境作用域注入（环境级变量而非全局）、最小权限 SA（只给目标 ns 的 deploy 权限）、日志脱敏与定期轮换；绝不写 YAML 提交仓库。
- 泄漏止损：立刻吊销 SA/换 kubeconfig → 审计该凭证的 API 调用（K8s audit/云操作日志）→ 检查集群是否被植入（异常：恶意 ClusterRoleBinding、挖矿 DaemonSet 是常见驻留手法）→ 全量轮换同集群其他秘密。
- 加分：更优形态是 CI 不持长期 kubeconfig——用 OIDC 短凭证或 GitOps（ArgoCD）让集群侧拉取，CI 与生产凭证彻底解耦。
