# 缓存、制品与 K8s 部署集成 · 小测

### 1. artifacts 与 cache 的本质区别是（6分）

- A. 前者存对象存储，后者只存本地
- B. 前者是流水线内的交付物随依赖自动传递，后者是跨流水线可丢可重建的加速快照
- C. 前者能存 jar，后者不能
- D. 二者只是叫法不同

> 答案：B
> 解析：语义优先——发布用的产物必须 artifacts（保证存在与传递）；.m2/node_modules 才是 cache（删了只是变慢）。

### 2. 要让 Maven 本地仓库被 GitLab cache 抓到，必须（6分）

- A. 安装专用插件
- B. 用 MAVEN_OPTS 把 maven.repo.local 指到项目目录下再缓存该路径
- C. cache 会自动包含 ~/.m2
- D. 改用 gradle

> 答案：B
> 解析：cache 只备份"工作目录内的 paths"，默认 ~/.m2 在项目外抓不到——这是 GitLab Maven 缓存第一大坑。

### 3. cache key 按 CI_COMMIT_REF_SLUG 分支隔离的动机是（6分）

- A. 节省存储空间
- B. 避免不同分支的 SNAPSHOT/依赖版本互相污染
- C. 提高镜像推送速度
- D. 让 Job 并行度更高

> 答案：B
> 解析：共用一个 key 时，feature 分支写入的半成品 SNAPSHOT 会被主干命中（异常：构建结果依赖了别人没合的改动）。

### 4. 自建 Runner 上用 docker:dind 服务，通常必须配置（6分）

- A. services 留空
- B. Runner privileged = true
- C. 关闭 TLS
- D. 改用 shell executor

> 答案：B
> 解析：容器里再起 docker daemon 需要挂载/控制 cgroup 的特权；也因此 dind 有逃逸风险，托管环境优选 kaniko 等无 daemon 方案。

### 5. 镜像 tag 用 CI_COMMIT_SHORT_SHA 而不是 latest 的主要收益是（6分）

- A. 镜像更小
- B. 可追溯可回滚，K8s 端换 tag 必触发滚动更新
- C. 推送更快
- D. 避免漏洞扫描

> 答案：B
> 解析：latest 在节点上可能复用旧镜像导致"发布没生效"（典型假象）；sha tag 让 rollout、回滚、审计都有确定锚点。

### 6. helm upgrade --wait 的作用是（6分）

- A. 等待人工审批
- B. 阻塞到所有资源就绪才返回成功，使流水线绿=发布真的可用
- C. 只渲染模板不安装
- D. 自动回滚失败版本

> 答案：B
> 解析：不带 --wait，命令成功只代表"提交成功"；就绪判定依赖 Pod 探针配置正确（kubernetes s1-3），D 要靠额外工具（如 helm 3 本身不自动回滚）。

### 7. kubeconfig 放进 CI 变量的正确姿势是（6分）

- A. 写进 .gitlab-ci.yml 提交仓库
- B. Protected + Masked，且只在受保护分支/tag 的发布 Job 注入
- C. 打印到 Job 日志方便复制
- D. 存进 artifacts

> 答案：B
> 解析：protected 限定可见范围、masked 防日志泄漏；写进 YAML/artifacts/日志等于公开广播（反例都是真实事故源）。

### 8. 关于 cache 策略正确的有哪些（多选）（9分）

- A. pull-push 适合"上游写、下游只读"的拆分场景
- B. pull 策略的 Job 不会回写缓存
- C. cache 未命中会直接使 Job 失败
- D. 用 key:files 监听 pom.xml 变化可实现依赖变更自动换缓存

> 答案：ABD
> 解析：C 错——cache 未命中是合法状态（空目录开跑，只是变慢），这也是"可丢可重建"语义的体现；A/B/D 均为控制缓存写入面与命中率的正规手段。

### 9. 一次流水线里 Job A 产出的 jar 要交给 Job B 部署，需要哪些配置（多选）（9分）

- A. A 声明 artifacts:paths 覆盖 jar 相对路径
- B. B 通过 needs 或默认 stage 依赖获得 A 的成功前提
- C. 把 jar 打入镜像是最正确的交付方式
- D. A 设置 cache 让 B 恢复目录

> 答案：ABC
> 解析：同流水线传递走 artifacts；K8s 部署场景"jar 进镜像"是唯一能被集群拉取的形态（D 用 cache 传交付物是反例——可能未命中且无语义保证）。

### 10. 团队抱怨"CI 慢、缓存像抽奖、发布偶发假绿"，请给出至少 4 条治理措施。（40分）

- 要点1：MAVEN_OPTS 指向项目内 .m2 + cache key 按分支/pom 校验和隔离（说明：命中率可度量后优化才有依据）。
- 要点2：缓存外置对象存储并限制 expire_in，artifacts 只收必要产物（结果：存储与传输双降）。
- 要点3：镜像 tag 用 commit sha，部署以 sha 为唯一变量，杜绝 latest 假象。
- 要点4：发布 Job 加 --wait/rollout status 就绪门禁，并保证探针配置正确（关联 k8s 探针），否则"绿着没生效"。
- 要点5：凭证 Protected+Masked+按 Job 作用域注入；dind 场景评估 kaniko 降特权面（异常面收敛也是提速之外的治理目标）。

> 答案：见要点
