# 与 GitHub Actions 的取舍（关联） · 小测

### 1. GitLab 的 artifacts 在 GitHub Actions 中的对位机制是（6分）

- A. actions/cache
- B. upload-artifact / download-artifact 显式上传下载
- C. gist
- D. pages 部署

> 答案：B
> 解析：Actions 的产物传递是显式两步，下游必须主动 download；GitLab 则随依赖关系自动带入工作区。

### 2. GitHub Actions 中同一提交可能触发两条流水线的原因是（6分）

- A. Runner 重复领取
- B. push 与 pull_request 事件同时命中，需要条件去重
- C. cache 冲突
- D. matrix 展开

> 答案：B
> 解析：on 里同时列 push 与 pull_request 且分支重叠时双跑（真实高频痛点），常用 `if: github.event_name == 'pull_request' || ...` 或收敛触发器治理。

### 3. 以下哪项是 GitLab CI 相对 Actions 的典型优势（6分）

- A. Marketplace 插件数量
- B. 开源仓库免费额度
- C. 代码评审、容器仓、CI/CD、环境管理同平台一体化
- D. 事件类型丰富度

> 答案：C
> 解析：A/B/D 恰是 Actions 的强项；GitLab 的卖点是 All-in-one 平台与私有化自建。

### 4. 代码必须不出内网的团队，更省事的方案通常是（6分）

- A. GitHub 免费版 + self-hosted runner
- B. 自建 GitLab + 内网 Runner
- C. 任意平台都行
- D. 只用 Actions 托管 Runner

> 答案：B
> 解析：Actions 托管 Runner 在微软云上跑 script，代码/凭证需出内网；GitLab 整套自托管天然满足合规（D 直接违背约束）。

### 5. 关于缓存迁移，正确的说法是（6分）

- A. GitLab 的 cache paths 语法可原样复制到 Actions
- B. Actions 用 key+restore-keys 做精确匹配与回退，语义与 GitLab 不同
- C. Actions 没有缓存能力
- D. setup-java 不能管依赖缓存

> 答案：B
> 解析：Actions 缓存是"键+回退键"模型（找不到精确键可部分匹配旧的），GitLab 是目录快照+policy 模型；setup-java/caching 实际就是官方封装。

### 6. matrix 能力在两边的对应写法是（6分）

- A. GitHub 的 matrix 对应 GitLab 的 rules
- B. GitHub 的 strategy.matrix 对应 GitLab 的 parallel:matrix
- C. 两边都只有 shell 循环
- D. GitLab 的 matrix 对应 GitHub 的 needs

> 答案：B
> 解析：都是"一个 Job 定义展开成多组合副本"（如 JDK17/21 × ubuntu/windows），语法与展开细节需重写而非直译。

### 7. "把 CI 语义收敛进共享脚本，YAML 只做薄胶水"的收益是（6分）

- A. 规避平台 lint
- B. 本地可复现、迁移成本被脚本层吸收
- C. 不需要缓存了
- D. 流水线不再需要 Runner

> 答案：B
> 解析：`make verify` 本地与 CI 同一条命令（可复现性），换平台只重写触发/凭证层——多平台战略下的标准解。

### 8. 关于两平台 Runner 的说法正确的有哪些（多选）（9分）

- A. Actions 托管 Runner 免运维、按分钟计费
- B. GitLab 自建 Runner 并发不受平台账单限制
- C. self-hosted runner 意味着零安全义务
- D. 两平台的自建 Runner 都能解决"内网资源访问"问题

> 答案：ABD
> 解析：C 错——self-hosted 反而把补丁、隔离、凭证管理责任揽回自己（异常：公网可达的自托管 runner 被投毒是知名攻击路径）。

### 9. 从 GitLab CI 迁到 Actions 需要重写的部分通常包括（多选）（9分）

- A. 触发与分支控制（rules → on/if）
- B. 产物传递（自动带入 → 显式 upload/download）
- C. 构建命令本身（mvn 参数）
- D. 凭证注入（CI 变量 → secrets/environment）

> 答案：ABD
> 解析：C 不该变——mvn/gradle 命令属于脚本层，正是"薄胶水"策略要保护的部分；A/B/D 是 YAML 语义与平台机制差异所在。

### 10. 团队讨论"要不要从 GitLab 整体迁 GitHub"，请列出至少 4 个评估维度与结论建议。（40分）

- 要点1：合规与部署形态——代码/凭证是否必须留在自建边界内（GitLab 自建优势）。
- 要点2：生态依赖——大量使用 Marketplace 集成/OSS 项目协作则 Actions 增益明显（说明：集成密度决定重写成本）。
- 要点3：成本模型——分钟计费+并发上限 vs 自养机器与运维人力，给出量化对比。
- 要点4：迁移工程量盘点——缓存/产物/触发/凭证四类语法映射与流水线数量（结果：先做 PoC 双跑再切换）。
- 要点5：组织因素——评审流程、权限体系、团队学习曲线；建议脚本层先行统一，保留平台可换性。

> 答案：见要点
