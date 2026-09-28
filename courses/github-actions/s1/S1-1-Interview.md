# Workflow 语法、触发器与 Runner · 面试题

## 题 1：描述一个 workflow 文件的结构层次。

- 文件在 .github/workflows/，顶层键：name/on（可多事件）/permissions/concurrency/env/jobs。
- jobs 默认并行、needs 建 DAG；job 内 steps 严格串行，step 二形态：uses（调 Action）或 run（shell，默认 bash，Windows 上 pwsh 需显式）。
- `${{ }}` 表达式贯穿：github.* 上下文、inputs/secrets/matrix/env；job 与 step 都能挂 if 条件。
- 加分：说清"job 之间工作区不共享，要靠 artifacts；step 之间共享"（异常：下游 job 忘 download-artifact 找不到文件）。

## 题 2：一个 PR 合并到 main，会触发哪些运行？怎么控制？

- 取决于 on：pull_request（PR 关闭时再触发一次 closed 事件）+ push(main) 会各自建运行——这就是双跑来源（错误预期：以为 PR 只跑"打开时"那一次）。
- 控制面三层：on 收窄 branches/paths；job 级 `if: github.event_name == 'pull_request'` 分工；concurrency 组取消过期运行。
- 设计答法：PR 事件跑门禁（测试），push main 跑交付（构建/发布），cron 跑全量回归，dispatch 留人工发布口——四触发器各司其职。

## 题 3：hosted 与 self-hosted Runner 怎么选？自建要注意什么？

- hosted：零运维、镜像新、隔离好；按分钟计费有并发上限、够不到内网、预装软件靠 setup-* Action。
- self-hosted：内网可达、特殊硬件、成本可控（复用机器）；但要管补丁更新、并发排队、环境漂移——推荐 ephemeral（一次一毁）或容器化 runner（K8s 上 actions-runner-controller 是规模化解法）。
- 安全要点（必答）：runner 机器不与凭证/业务混居；org/repo 级限制可用 Action 与 fork PR 权限；结果：混合策略最常见——门禁托管、涉内网的构建自建。

## 题 4：matrix 用过吗？讲讲展开与失败语义。

- `strategy.matrix: {java: [17,21], os: [...]}` 展开成组合 job 并行跑，可用 exclude/include 增删组合、max-parallel 限流（示例：JDK×模块分片测试）。
- 失败语义：默认 fail-fast:true，一个组合挂就取消其余——排障期看不全结果，建议 false；整体成功判定看所有必需组合。
- 加分：matrix 值可来自前置 job 动态生成（`fromJSON(outputs矩阵)`——脚本算出版本列表再展开，说明：发布多环境时矩阵不写死）。

## 题 5：workflow 里如何安全地使用凭证？

- 长期密钥进 secrets（repo/org/environment 三级作用域），environment 级配审批与可见分支规则；日志里 secrets 自动打码但别依赖它防"主动外传"（反例：把 secret echo 进 curl body 发到外部地址仍会泄漏）。
- 短期方案优先：云厂商 OIDC 联合（免存 AK/SK）、GITHUB_TOKEN 限定本仓库操作并 permissions 收口（错误预期：拿全局 PAT 存 secret 图省事——权限过大且不过期）。
- 加分：第三方 Action 固定到 commit SHA 而非 tag（防 supply chain 换 tag 投毒）。

## 题 6：一次运行卡了 2 小时最后超时失败，排查思路？

1. 看卡点在哪个 step：拉取镜像/依赖下载慢（网络或缓存失效），还是等 Runner——`Waiting for a runner` 说明 self-hosted 全忙或标签无匹配（结果：queue 时间也算超时预算）。
2. 交互式命令挂等输入：script 里 git 要凭证、mvn 弹认证（异常：CI 里表现为静默到超时而非报错——所有工具先配非交互参数 -B）。
3. 死锁类：service 容器未就绪、测试起了不退出线程（jstack/线程 dump 介入，关联 jvm 包）；job 级 timeout-minutes 显式设短防烧额度。
4. 平台侧：Actions 状态页与限流（异常时段全局变慢，与仓库无关）。
