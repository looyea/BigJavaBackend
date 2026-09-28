# Workflow 语法、触发器与 Runner · 小测

### 1. GitHub Actions 的 workflow 文件必须放在（6分）

- A. 仓库根目录 ci.yml
- B. .github/workflows/ 目录下的 yml/yaml 文件
- C. 只能在 org 设置里配置
- D. .git/hooks 内

> 答案：B
> 解析：默认分支（或 PR 来源分支按安全规则）里 .github/workflows/*.yml 自动被识别；根目录 ci.yml 是 GitLab 的习惯（.gitlab-ci.yml）。

### 2. jobs 之间的默认执行关系是（6分）

- A. 串行
- B. 并行，needs 声明依赖形成 DAG
- C. 按字母序
- D. 随机

> 答案：B
> 解析：Actions 没有 stage 屏障概念，job 默认全并行；要顺序/依赖必须显式 needs——从 GitLab 迁移最容易想反的一点。

### 3. 想让同一 PR 的旧运行在新 push 后自动取消，应配置（6分）

- A. fail-fast
- B. concurrency 组 + cancel-in-progress: true
- C. if: github.event_name
- D. max-parallel

> 答案：B
> 解析：concurrency 按 github.ref/head_ref 分组互斥并取消进行中旧跑；省托管分钟数、防产物覆盖错乱。

### 4. workflow_dispatch 的用途是（6分）

- A. 定时任务
- B. 在网页手动触发工作流（可带输入参数）
- C. 响应 issue
- D. 跨仓库调用

> 答案：B
> 解析：等价 GitLab 的 when: manual 整条粒度触发，配合 inputs 可做参数化发布按钮；定时是 schedule，跨仓调用是 workflow_call。

### 5. push 与 pull_request 同时命中 main 造成双跑，最常见的治理是（6分）

- A. 删掉其中一个事件不再测 PR
- B. 用 paths 过滤
- C. on 收窄分支 + job 级 if 按 github.event_name 分工（PR 跑测试、push 才发布）
- D. 提高并发上限

> 答案：C
> 解析：双跑根源是事件"或"关系叠加；按事件分工既去重又语义清晰，A 牺牲门禁、B/D 不解决问题。

### 6. self-hosted Runner 相对 hosted 的适用场景是（6分）

- A. 想省注册机器的时间
- B. 需要访问内网私服/GPU/合规环境
- C. 想要永远新的系统镜像
- D. 不想付任何费

> 答案：B
> 解析：hosted 开箱即用但到不了内网；self-hosted 换来可达性，代价是补丁、隔离、弹性自理（C/A 恰是 hosted 的优势）。

### 7. strategy.matrix 里 fail-fast: false 的效果是（6分）

- A. 失败不标红
- B. 某组合失败时其他并行组合继续跑完
- C. 关闭缓存
- D. 禁止重试

> 答案：B
> 解析：默认 true 会"一个红全队杀"，排障时看不到其他组合结果；A 混淆了 allow_failure（continue-on-error 才是软失败）。

### 8. 关于 GITHUB_TOKEN 与 permissions，说法正确的有哪些（多选）（9分）

- A. 不写 permissions 时 token 可能拿到较宽默认权限
- B. 显式声明最小权限（如 contents: read）能降低恶意脚本危害
- C. token 可被写入日志明文而无风险
- D. 同 run 内多个 step 共享工作区文件

> 答案：ABD
> 解析：C 错——运行时 token 泄漏到日志/产物是真实攻击面（masked 也防不住自印变量再外传）；A/B 是官方推荐的收紧动作，D 是 job 内 step 共享 workspace 的基本事实。

### 9. 哪些写法能有效缩短 CI 总耗时或成本（多选）（9分）

- A. concurrency + cancel-in-progress 取消过期运行
- B. paths 过滤让文档改动不触发构建
- C. setup-java 配 cache 或 actions/cache 缓存依赖
- D. 所有 job 改用 macOS hosted Runner

> 答案：ABC
> 解析：A 省重复跑、B 减触发面、C 减下载；D 反向——macOS 计价系数高且与需求无关，是成本反例。

### 10. 评审一个开源 Java 项目的 workflow："每个 PR 跑 40 分钟、发布手动容易漏"，给出至少 4 条改进。（40分）

- 要点1：拆 job + needs 建 DAG，测试/构建/发布解耦并行（说明：单 job 内串行 steps 是最慢形态）。
- 要点2：matrix 收窄——PR 只跑 JDK17，push main 才双 JDK 全矩阵（结果：门禁耗时砍半）。
- 要点3：依赖缓存（setup-java cache: maven）+ 增量测试/分片，命中缓存后时长可再降。
- 要点4：发布用 workflow_dispatch+inputs 或 tag 触发，配 environment 审批，杜绝"记得点"式流程。
- 要点5：concurrency 去重 + 失败快速反馈（fail-fast 在门禁侧保留），并声明 permissions 最小化安全面。

> 答案：见要点
