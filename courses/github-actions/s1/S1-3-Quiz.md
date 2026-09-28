# 与 GitLab CI 的取舍（关联） · 小测

### 1. GitLab 的 artifacts 自动传递迁到 Actions 后必须（6分）

- A. 改用 cache
- B. 显式 upload-artifact / download-artifact 两步
- C. 放同一台机器
- D. 无需改动

> 答案：B
> 解析：Actions 的 job 间工作区隔离且无自动带入机制——迁移后下游忘 download 是最高频错误用例。

### 2. Actions 中忘写 needs 时 job 的行为是（6分）

- A. 按定义顺序串行
- B. 全部并行
- C. 报错
- D. 随机

> 答案：B
> 解析：没有 stage 屏障兜底，并行是默认——从 GitLab 迁移的思维直译会让"发布 job 与测试 job 同跑"，门禁失效（异常场景）。

### 3. Maven 依赖缓存在两平台的目录要求差异是（6分）

- A. 两边都必须放项目目录内
- B. GitLab 需把本地仓指进工作目录才可缓存，Actions 可直接缓存 ~/.m2
- C. Actions 不支持 Maven
- D. 差异不存在只是写法

> 答案：B
> 解析：GitLab cache 只抓 paths 下的工作目录内容（MAVEN_OPTS 改 repo.local 是必修课）；Actions 的 actions/cache 可访问任意路径。

### 4. workflow_dispatch 在 GitLab 中的最接近对位是（6分）

- A. schedule
- B. when: manual（配 rules 控制出现范围）
- C. only: web
- D. trigger pipeline API 独享

> 答案：B
> 解析：两者都是"流水线建好等人点"；GitLab 另有网页/API 手动触发整条流水线的入口，粒度语义上 manual 最贴近。

### 5. 关于 Runner 默认形态正确的说法是（6分）

- A. Actions 以自建为主、GitLab 以托管为主
- B. Actions 托管开箱即用、GitLab 生态以自建 Runner 为主流
- C. 两边都只能托管
- D. 两边都只能自建

> 答案：B
> 解析：方向恰好相反——这决定了成本模型（分钟计费 vs 自养机器）与合规路径（出网 vs 内网闭环）。

### 6. "CI 语义收敛到脚本层"的含义与收益是（6分）

- A. 把 YAML 写复杂、脚本写简单
- B. 质量逻辑放进 make/构建脚本，YAML 只做触发凭证产物胶水——本地可复现、换平台成本低
- C. 取消 YAML
- D. 只用 shell 写流水线

> 答案：B
> 解析：mvn verify 该不该跑、怎么跑属于脚本层；何时跑、用什么身份跑属于平台胶水层——分层清晰则双平台共存不再是负担（结果：平台成为可替换决策）。

### 7. 私有化合规硬要求（代码不出内网）时更稳妥的默认选择是（6分）

- A. GitHub 免费版 + 托管 Runner
- B. 自建 GitLab + 内网 Runner
- C. 任意托管 SaaS
- D. 本地手工打包发布

> 答案：B
> 解析：Actions 托管 Runner 运行在公有云，代码与日志需出内网边界（A/C 违背约束）；D 失去自动化价值；自建 GitLab 全栈内闭环。

### 8. 关于两平台表达式/语法差异正确的有哪些（多选）（9分）

- A. 上下文引用 Actions 用 ${{ }}，GitLab 用 $变量 风格
- B. matrix 两边都有（strategy.matrix 与 parallel:matrix）
- C. GitLab 没有 DAG 能力
- D. Actions 用 on、GitLab 用 rules/workflow 控制触发

> 答案：ABD
> 解析：C 错——GitLab 的 needs 就是 DAG，且与 stages 屏障可混用；A/B/D 均为官方对位特性。

### 9. 双跑（一次提交两条流水线）问题在哪一侧更"天生"，原因与对策是（多选）（9分）

- A. Actions 侧更常见：push 与 pull_request 事件独立叠加
- B. 对策之一是 job 级 if 按 github.event_name 分工
- C. GitLab 侧天然无解只能忍
- D. GitLab 可用 workflow:rules 在流水线级一次裁决

> 答案：ABD
> 解析：Actions 的事件"或"语义导致重叠触发（A/B 对）；GitLab 的 workflow:rules 在整条流水线创建前就裁决、Job 级 rules 二次裁剪（D 对 C 错——并非无解）。

### 10. 公司拟把核心交易系统 CI 从 GitHub Actions 迁回自建 GitLab，请列出至少 4 个迁移要点。（40分）

- 要点1：合规边界盘点——哪些 secrets/内网资源此前靠 self-hosted runner 打通，迁移后 Runner 网络与标签路由方案（说明：先画可达性矩阵）。
- 要点2：语义映射清单——on/if→workflow/job rules、upload/download→artifacts 自动传递、actions/cache→MAVEN_OPTS+cache key 重构（结果：缓存直译必全空）。
- 要点3：复用层重写——reusable workflow/composite 对应换成 include 模板仓 + 脚本层下沉，避免组织模板两版并行漂移。
- 要点4：门禁与审批迁移——environment reviewers 换成 GitLab protected environments/approval rules，K8s 凭证改受保护变量+最小 SA（关联 k8s RBAC）。
- 要点5：灰度与回退：双平台并跑比对时长/稳定性两周，构建命令层不动以保一致性；下线旧侧前归档运行历史满足审计。

> 答案：见要点
