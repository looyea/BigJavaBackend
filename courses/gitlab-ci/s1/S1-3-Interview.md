# 与 GitHub Actions 的取舍（关联） · 面试题

## 题 1：GitLab CI 和 GitHub Actions，概念怎么互译？

- Job↔job、script↔steps(run)、Runner↔Runner（同名不同命：GitLab 自建为主流，Actions 托管开箱即用）。
- cache↔actions/cache（快照+policy vs key/restore-keys 回退模型）；artifacts↔upload/download-artifact（自动传递 vs 显式两步）；rules↔on+if（流水线/Job 两级过滤）。
- environment 两边都有但 Actions 绑 secrets 作用域与审批更紧（说明：面试答出"语义相似、机制不同，不能直译"即到位）。

## 题 2：你们为什么选 GitLab CI？（或为什么不选？）

- 背景先行：代码托管在哪、合规边界（自建不出内网）、既有平台一体化程度（评审/容器仓/环境同平台，MR 门禁天然联动）。
- 成本对照：Actions 开源免费/私有按分钟；自建 GitLab 是机器+运维人力，Runner 并发不设限（结果：高并发大规模自建占优）。
- 生态：Actions Marketplace 的第三步复用与第三方集成密度确实领先——若团队重度用云 OIDC/OSS 协作，选 Actions 合理；加分项是承认对方强项再讲取舍，而不是踩一捧一。

## 题 3：Actions 的 push+pull_request 双跑是怎么回事？怎么治？

- 成因：main 分支收到 push（合并后）与仍在开的 PR 事件重叠，或 fork PR 的 push+PR 双触发——on 的事件是"或"关系各建各的流水线（异常表现：一次提交两条一模一样的跑）。
- 治理：按事件分工——pull_request 只跑测试，push(main) 才构建发布；job 级 `if: github.event_name == ...` 裁剪；或用 `branches-ignore` 收窄。
- 对照 GitLab：workflow:rules 在流水线级统一裁决（MR 建测试流水线、分支 push 视情况不建），设计上少一层事后过滤（说明：两平台去重哲学不同）。

## 题 4：从 GitLab CI 迁移一个 Java 流水线到 Actions，列你的工作计划。

1. 盘点：流水线清单、自定义 Runner 依赖（内网私服/特殊硬件——先解决网络与 settings.xml）。
2. 语义映射：stages/needs→jobs/needs；cache 重写为 hashFiles 键；artifacts 改显式上传下载；rules 拆成 on+if+environment。
3. 凭证：CI 变量→secrets/environment 分层，Nexus 账密走 secrets，验证 Protected 仓库的注入范围（错误预期：变量名沿用没改引用语法，构建拉私服的 401）。
4. 双跑灰度：Actions 与 GitLab 并行两周比对时长与稳定性，再下线旧侧；构建命令本身不动（脚本层复用）。

## 题 5：双平台长期共存怎么把维护成本压到最低？

- 核心答案：CI YAML 只做"触发、凭证、Runner、上传下载"四类胶水，质量逻辑收敛到 `make ci`/构建脚本/容器化脚本（可复现且平台无关）。
- 复用机制：GitLab include 模板仓 + Actions 复用 workflow/composite action，两侧各自薄封装指向同一脚本仓（结果：改一处两边生效）。
- 防漂移：契约测试——同一 commit 在两边跑同一验收脚本比对结果；新特性按"脚本先行、胶水后补"的顺序落地。

## 题 6：自托管 Runner 在两个平台上的安全注意点？

- 共同底线：Runner 机器专人专用（不跑别的业务）、最小出网、及时打补丁；构建来的代码是"不可信输入"，repo 即攻击面（供应链视角）。
- Actions 特有：fork PR 默认拿不到 secrets（safe 模型），但别用 `pull_request_target`+签出 PR 代码的组合——secrets 泄漏给外部 PR 的经典漏洞（异常案例真实发生过）。
- GitLab 特有：共享 Runner 的项目隔离、run 标签控制、容器逃逸面（dind privileged）收敛到专用机（加分：token 轮换与并发上限防滥用）。
