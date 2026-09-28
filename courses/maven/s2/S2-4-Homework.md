# 多模块构建、Profile 与 CI 集成 · 作业

### 作业 1：把全量构建改造成定向增量构建

- 目标：在不牺牲正确性的前提下，把 CI 从"每次全量"压到"按变更构建"。
- 任务：给一个多模块工程（含 common、service-a、service-b 依赖 common），编写脚本根据 git diff 命中的模块，用 `mvn -pl <模块> -am` 构建；当改动落在 common 时改用 `-amd` 连带所有下游。记录优化前后构建耗时。
- 验收标准：只改 service-a 时不重建无关模块；改 common 时下游被正确带上；构建顺序由 reactor 保证、无"找不到上游产物"。
- 参考解法要点：-am 向上补依赖、-amd 向下补依赖者；并行加 `-T 1C`；必要时 `-o` 离线复用缓存。

### 作业 2：Profile 化环境差异 + 版本单点管理

- 目标：消除"每环境一份 pom.xml"的漂移，并实现全工程版本一处修改。
- 任务：把 dev/test/prod 的库地址、仓库差异收敛为同一 POM 的 Profile，用 `<activation>` 按 `-Denv=xxx` 自动激活；将各模块 version 统一为 `${revision}`，配置 flatten-maven-plugin 使 install 后 POM 中不再残留占位符。
- 验收标准：`-Denv=prod` 正确命中 prod 档案；子模块 target 下 flattened POM 的版本是真实值而非 `${revision}`；不存在多份重复 pom.xml。
- 参考解法要点：敏感值从 CI 变量注入、别写死进 POM；flatten 绑定 process-resources/package 阶段。

### 作业 3：CI 依赖缓存与脏快照防护

- 目标：加速依赖解析同时避免拿到过期 SNAPSHOT。
- 任务：在 CI 配置中缓存 `~/.m2/repository`（以 pom 哈希为 key），为 Release 设长缓存、对 SNAPSHOT 构建加 `-U` 或缩短缓存 TTL；模拟上游发布新 SNAPSHOT 后，验证本作业能拉到最新而非旧快照。
- 验收标准：命中缓存时不再重复下载依赖；上游 SNAPSHOT 更新后能强制刷新、不复用脏快照；Release 构建可完全离线。
- 参考解法要点：区分不可变(Release)与可变(SNAPSHOT)缓存策略；缓存 key 关联 POM 与 settings.xml。
