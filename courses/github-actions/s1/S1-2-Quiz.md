# Action 复用、Marketplace 与密钥 · 小测

### 1. 三种复用形态按粒度从小到大是（6分）

- A. reusable workflow → composite → 第三方 Action
- B. 第三方/本地 Action（step 级）→ composite Action（多步打包）→ reusable workflow（整条 job 级）
- C. composite 最大
- D. 三者粒度相同

> 答案：B
> 解析：uses 一步、composite 是一个"超级 step"、workflow_call 复用整个流程模板——治理含义也逐级增强。

### 2. composite action 里 run 步骤必须额外声明的是（6分）

- A. timeout
- B. shell（如 bash）
- C. needs
- D. if

> 答案：B
> 解析：composite 不继承调用方 shell 默认值，缺 shell 直接 lint 报错；Windows runner 上漏配是典型翻车点（错误用例）。

### 3. 组织级模板仓的最佳引用方式是（6分）

- A. uses 指到 @main 永远最新
- B. 钉到发布 tag（或 commit SHA），模板变更走版本评审
- C. 复制粘贴到每个业务仓
- D. 用相对路径跨仓引用

> 答案：B
> 解析：@main 意味着模板仓一次坏提交全组织 CI 雪崩（真实事故模式）；版本 tag 让升级可控可回滚，C 则失去复用意义。

### 4. fork 发来的 PR 能否读到仓库 secrets（6分）

- A. 一定能
- B. 默认不能；pull_request_target 且签出 PR 代码的危险写法才会泄漏
- C. 只有 org secret 能
- D. 管理员手动放行后常驻可读

> 答案：B
> 解析：fork PR 在只读上下文运行不注入 secrets；pull_request_target 跑在基线仓库权限里，若又 checkout PR 代码执行，等于把外部代码送进持密环境（高危反例）。

### 5. secrets 日志打码的准确理解是（6分）

- A. 等价于加密存储，泄漏也不怕
- B. 只遮蔽日志输出，主动外传（写产物/发请求）仍能带出明文
- C. 能防住所有泄漏
- D. 打码只对 GITHUB_TOKEN 生效

> 答案：B
> 解析：打码是展示层掩码；`echo $SECRET > artifact.txt` 再上传制品即绕过（异常演练常见），所以最小化与外传管控才是重点。

### 6. actions/cache 的 restore-keys 作用是（6分）

- A. 加密缓存
- B. 精确 key 未命中时按前缀回退复用旧缓存
- C. 清理旧缓存
- D. 跨仓库共享缓存

> 答案：B
> 解析：pom 小改导致哈希变化时仍能拿到大致可用的旧 .m2（结果：命中率曲线平滑）；A/C/D 均非其语义。

### 7. 下游 job 要用上游 job 的构建产物，正确做法是（6分）

- A. 直接读上游目录
- B. 上游 upload-artifact、下游 download-artifact
- C. 放进 cache 传递
- D. 用同一台 Runner 即可

> 答案：B
> 解析：job 间工作区隔离（甚至不同机器），artifacts 是唯一契约通道；C 是经典反例——缓存可能未命中且无语义保证，D 只在同 job 的 step 间成立。

### 8. 关于 Marketplace Action 的供应链安全，正确的有哪些（多选）（9分）

- A. 引用时固定到 commit SHA 比浮动 tag 更安全
- B. 官方 Action（actions/*）不需要审查
- C. 组织设置可限制 fork PR 允许使用的 Action 范围
- D. 冷门第三方 Action 引入前应审查源码与活跃度

> 答案：ACD
> 解析：B 错——任何第三方代码都可能被投毒（tag 重指向攻击真实存在），官方 Action 建议也钉版本；A/C/D 是 GitHub 官方推荐的三件套治理。

### 9. environment 级配置能提供哪些治理能力（多选）（9分）

- A. required reviewers 人工审批后才运行关联 job
- B. 限制哪些分支可用该环境的 secrets
- C. 自动优化缓存命中率
- D. 环境级变量与 secrets 作用域隔离

> 答案：ABD
> 解析：environment 是"发布治理单元"（审批+可见分支+作用域 secrets）；缓存性能与它无关，C 是凑数干扰项。

### 10. 团队 20 个 Java 仓库各自维护 workflow，复制粘贴漂移严重，请给出复用与治理方案（至少 4 点）。（40分）

- 要点1：建组织模板仓，reusable workflow 固化"门禁+构建+发布"流程，业务仓 uses 钉版本 tag 调用（说明：升级走 PR 评审）。
- 要点2：跨仓通用动作抽 composite action（如 maven-build 三件套），统一 shell/缓存键/报告输出。
- 要点3：secrets 收敛到 org + environment 分层，生产环境加 required reviewers，云凭证改 OIDC 短期化（结果：长期 token 清零）。
- 要点4：第三方 Action 全量钉 SHA + 组织 allowlist，配 Dependabot 升级评审（异常处理：禁用冷门未审查 Action）。
- 要点5：制品与缓存策略统一（hashFiles 键+retention-days），并输出命中率/时长指标驱动优化。

> 答案：见要点
