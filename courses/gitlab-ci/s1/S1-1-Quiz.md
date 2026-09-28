# 流水线模型：Stage/Job/Script 与 Runner · 小测

### 1. GitLab CI 中 Stage 之间的关系是（6分）

- A. 并行执行
- B. 严格串行，同 Stage 内 Job 并行
- C. 由 needs 决定唯一顺序
- D. 随机调度

> 答案：B
> 解析：Stage 是串行屏障（barrier），全部成功后才进下一 Stage；同一 Stage 内的 Job 并行。

### 2. needs 配置的核心价值是（6分）

- A. 替代 stages 彻底删除阶段概念
- B. 让 Job 只依赖指定上游，越过 Stage 屏障提前开跑（DAG）
- C. 自动重试失败 Job
- D. 缓存依赖目录

> 答案：B
> 解析：needs 把"阶段屏障"变成"按需依赖图"，构建耗时按关键路径走；并非必须删掉 stages，二者常混用。

### 3. script 数组中某条命令返回非 0，默认行为是（6分）

- A. 忽略继续执行后续命令
- B. 该 Job 立即失败，后续命令不再执行
- C. 整个流水线立即中止，所有在跑 Job 杀掉
- D. 自动重跑三次

> 答案：B
> 解析：script 逐条执行、首败即停并标红；已在跑的其他并行 Job 不会被立刻中止（C 是常见误解）。

### 4. 想让发布 Job 只在默认分支出现且由人工点击触发，应写（6分）

- A. 写 only: [master] 即可同时实现限分支与人工触发
- B. rules 里 if 默认分支 when: manual，其余 when: never
- C. when: on_failure
- D. allow_failure: true

> 答案：B
> 解析：rules 控制"是否创建+触发方式"，manual 提供人工按钮；allow_failure 只影响失败是否阻塞流水线，管不了出现与否。

### 5. Docker executor 与 Shell executor 的本质差别是（6分）

- A. 前者每个 Job 起一次性容器、环境由 image 决定；后者直接跑在 Runner 宿主机
- B. 前者更快所以没有冷启动
- C. 后者不能执行 docker 命令
- D. 前者不需要注册 Runner

> 答案：A
> 解析：隔离性与可复现性来自容器；Shell executor 环境靠宿主机手装，最容易漂移（团队 CI"本地绿线上红"的高频根因）。

### 6. 流水线一直 pending，最优先检查（6分）

- A. YAML 语法
- B. 是否有匹配 tag 且在线的 Runner
- C. commit message
- D. artifacts 大小

> 答案：B
> 解析：pending=没有执行者领取 Job：Runner 掉线、tag 不匹配、并发占满三类最常见；语法错误会直接 lint 报错而非 pending。

### 7. interruptible: true 的作用是（6分）

- A. 允许 Job 中途被人工暂停
- B. 同分支新流水线产生时自动取消旧的进行中流水线
- C. 允许一个 Stage 内并行
- D. 失败不阻塞流水线

> 答案：B
> 解析：为"快速连续 push"场景省资源；release 等不可中断流水线用 interruption 组隔离，防止被误取消。

### 8. 关于 Job 失败与流水线状态，说法正确的有哪些（多选）（9分）

- A. allow_failure: true 的 Job 失败后流水线仍可整体成功
- B. 任一必需 Job 失败则流水线标记失败
- C. 手工 Job 未点击时流水线显示"阻塞（blocked）"
- D. Job 失败会立即终止所有并行 Job

> 答案：ABC
> 解析：allow_failure 即"软失败"；manual 未触发产生 blocked 状态；D 错——失败只阻止后续 Stage，在跑的并行 Job 继续完成。

### 9. 哪些手段能缩短整条流水线的墙钟时间（多选）（9分）

- A. 用 needs 建立 DAG 减少无谓等待
- B. 把所有 Job 塞进同一个 script 串行跑
- C. rules:changes 让无关目录改动不触发重构建
- D. default.image 用轻量固定 tag 避免每次拉新大镜像

> 答案：ACD
> 解析：B 反其道——合并 Job 丧失并行度；A/C 砍依赖等待与触发面，D 降低环境准备开销（缓存镜像是更进阶做法）。

### 10. 评审一条"构建 25 分钟、发布全靠手动且经常点错环境"的 .gitlab-ci.yml，请给出至少 4 条结构化改进。（40分）

- 要点1：拆 Stage + needs DAG——测试不必等全部构建产物，重模块并行化（结果：墙钟按关键路径走）。
- 要点2：镜像固定 tag 并配 cache/Runner 镜像预热，消除每次 mvn 全量下载依赖（说明：-Dmaven.repo.local 指到缓存目录）。
- 要点3：发布 Job 用 rules 限定默认分支 + environment 声明，按分支自动绑定目标集群，杜绝"点错环境"。
- 要点4：生产发布加人工确认与受保护分支/受保护变量（protected）双重闸（异常：测试变量误注入生产是常见事故）。
- 要点5：interruptible 与新产物过期策略（expire_in）控制资源与存储成本。

> 答案：见要点
