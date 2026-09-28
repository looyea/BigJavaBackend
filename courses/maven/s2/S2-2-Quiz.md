# 私服 Nexus、mirror 与 settings.xml · 小测

### 1. 用户级与全局级 settings.xml 的优先级是？（6分）

- A. 全局覆盖用户
- B. 用户级（~/.m2）覆盖全局级（$MAVEN_HOME/conf）同名配置
- C. 合并冲突报错
- D. 随机生效

> 答案：B
> 解析：用户级面向个人/机器场景可覆盖全局团队默认，CI 常用 -s 显式指定另一个文件。

### 2. mirrorOf=* 的含义是？（6分）

- A. 只镜像 central
- B. 所有仓库请求（含自定义 repo）都改道该镜像
- C. 镜像本地仓库
- D. 禁用远程仓库

> 答案：B
> 解析：团队标准姿势就是全量走私服；例外用 `external:*` 或 `!id` 语法开洞。

### 3. server 配置生效（带上认证）的前提是？（6分）

- A. 写入 pom.xml
- B. server 的 id 与 mirror/repository 的 id 严格一致
- C. 用户名必须 email 格式
- D. 开启 https

> 答案：B
> 解析：id 是认证与仓库的关联键，对不上就 401——deploy 401 第一查 id。

### 4. release 库对同版本重复 deploy 的默认行为是？（6分）

- A. 静默覆盖
- B. 拒绝（400/409，不可覆盖保证构建可复现）
- C. 追加时间戳
- D. 自动升版本

> 答案：B
> 解析：release 不可变是仓库治理底线；snapshot 才有时间戳多版本机制。

### 5. "上游发了新 SNAPSHOT 但我构建还是旧的"最可能原因？（6分）

- A. Nexus 挂了
- B. 默认 updatePolicy=daily，今天已查过一次元数据
- C. 版本号写错
- D. Maven bug

> 答案：B
> 解析：`-U` 或改 updatePolicy=always（联调机）即可，先怀疑策略再怀疑玄学。

### 6. group 仓库（maven-public）的价值是？（6分）

- A. 提高磁盘利用率
- B. 团队只用一个 URL 获得 proxy+hosted 的聚合视图且可控来源顺序
- C. 加速编译
- D. 自动升级依赖

> 答案：B
> 解析：改后端仓库结构不用动全公司的 settings.xml，聚合层解耦了消费与治理。

### 7. 本地仓库构件损坏的正确清理方式是？（6分）

- A. rm -rf 整个 .m2
- B. dependency:purge-local-repository（可按 GAV 精准）
- C. 重启 IDE
- D. 手动改 jar

> 答案：B
> 解析：整层删除殃及并行构建且重下风暴打爆带宽；purge 支持范围与不重解参数。

### 8. 关于 snapshot 库的治理，正确做法包括（多选）？（9分）

- A. 配置最大快照保留数/清理策略防盘爆
- B. 正式对外发布禁止依赖 SNAPSHOT
- C. 把 snapshot 与 release 混在一个库
- D. CI 联调窗口用 -U 保证拉新

> 答案：A、B、D
> 解析：C 破坏不可变性语义且清理策略难两全，Nexus 默认也是两库分流。

### 9. 私服宕机时的正确应急动作包括（多选）？（9分）

- A. 临时启用预置的 direct-central profile 保持可构建
- B. 永久改为直连 central 省事
- C. 私有构件模块从 reactor 排除，其余先行构建
- D. 恢复后核对是否有"直连期间"产生的不可复现依赖并回收

> 答案：A、C、D
> 解析：B 触碰合规红线且私有包仍拉不到；应急要有开关、有范围、有回收。

### 10. 简答题：从 `mvn deploy` 一个 1.2.0 release 到下游团队用上的完整链路（写清每一跳与校验点）。（40分）

- 要点1：CI 带 Git tag 触发，`-Drevision=1.2.0`（去 SNAPSHOT）执行 deploy 生命周期段
- 要点2：distributionManagement 定位 maven-releases 库 URL，settings server id 出凭证（校验点：401 排 id/env）
- 要点3：Nexus 接收校验：同版本已存在则拒绝——发版重打必须先升版本号（说明：不可变性）
- 要点4：下游经 maven-public group 消费：proxy 未命中 → 查 hosted releases 命中返回（结果：一条 URL 全司可达）
- 要点5：下游 updatePolicy 影响首次可见时延，发布后在公告/流水线显式 `-U` 或等元数据刷新（错误用例："发了但同事拉不到"多为缓存策略）
- 要点6：审计与回滚：保留 GAV-Commit 映射，release 不可覆盖所以回滚=发更高版本或下游改回旧版本号（验收：追溯链闭合）

> 答案：见要点
> 解析：考的是发版链路的每一跳职责与两个经典堵点（认证 id、缓存时延）。
