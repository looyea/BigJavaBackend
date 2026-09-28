# 继承、聚合与多模块、BOM · 小测

### 1. 聚合与继承的关系是？（6分）

- A. 同一件事的两种叫法
- B. 聚合是构建清单（modules），继承是配置血缘（parent），正交可独立
- C. 聚合必然继承
- D. 继承必然聚合

> 答案：B
> 解析：可以只聚合不继承；改父 POM 子模块无感，多半是根本没配 parent。

### 2. 多模块根 POM 的 packaging 必须是？（6分）

- A. jar
- B. war
- C. pom
- D. ear

> 答案：C
> 解析：根 POM 只承担聚合与版本管理职责，不该有源码产物。

### 3. -pl shop-order -am 的含义是？（6分）

- A. 只构建 order 模块本身
- B. 构建 order 及其上游依赖模块（如 common）
- C. 跳过测试
- D. 并行构建全部

> 答案：B
> 解析：--also-make 把依赖链上的模块带上，单模块调试提效的关键参数。

### 4. 模块间依赖的版本推荐写法是？（6分）

- A. 写死 1.0.0
- B. ${revision} 或 ${project.version}
- C. LATEST
- D. 不写版本

> 答案：B
> 解析：与全仓统一版本联动能保证 reactor 内解析到本地模块；LATEST 是公认反面教材。

### 5. scope=import 的 BOM 作用是？（6分）

- A. 引入 BOM 里的所有 jar
- B. 导入其 dependencyManagement 版本表
- C. 继承其 parent
- D. 聚合其模块

> 答案：B
> 解析：只导版本不导依赖——"期待自动引包"是高频错误认知。

### 6. Maven 模块循环依赖的后果是？（6分）

- A. 运行更慢但可构建
- B. 反应堆拓扑排序失败，构建报错，必须抽层解环
- C. 自动打断一条边
- D. 无影响

> 答案：B
> 解析：Maven 直接把环当错误抛出——这同时是架构分层被破坏的信号。

### 7. 使用 ${revision} 统一版本时，deploy 前必须做什么？（6分）

- A. 手工全局替换字符串
- B. 配 flatten-maven-plugin 展开占位符
- C. 无需处理
- D. 改用 SNAPSHOT

> 答案：B
> 解析：不 flatten 则仓库 POM 里是字面 ${revision}，下游解析直接失败。

### 8. pluginManagement 的作用包括（多选）？（9分）

- A. 统一插件版本避免各模块漂移
- B. 统一插件配置（如编译级别）
- C. 自动在所有模块执行该插件
- D. 子模块仍需 plugins 声明（或生命周期默认）才会生效

> 答案：A、B、D
> 解析：C 错——pluginManagement 只"管版本配置"，不声明不执行。

### 9. 多 BOM import 并存时版本冲突的裁决，正确的做法包括（多选）？（9分）

- A. 利用"先 import 者优先"，公司 BOM 放最前
- B. 依赖顺序无所谓
- C. 在 dependencyManagement 显式声明覆盖关键组件
- D. 定期比对 BOM 间版本差异并收敛

> 答案：A、C、D
> 解析：B 错，顺序就是裁决规则，放任顺序=放任版本漂移。

### 10. 简答题：为一个 20 微服务单仓（mono-repo）设计 Maven 工程结构与版本策略。（40分）

- 要点1：结构：根 aggregator（pom）+ 分层公共模块（common/domain/infra）+ 各服务模块，服务只依赖允许的下层（结果：分层即架构约束）
- 要点2：版本：单一 ${revision}+flatten，CI 用 `-Drevision=xxx` 注入构建号（说明：pom 文件不再频繁改版本，合并冲突大减）
- 要点3：依赖治理：parent 里 import 公司 BOM + spring-boot-dependencies，服务 pom 全部免 version
- 要点4：插件治理：pluginManagement 统一 compiler/jacoco/enforcer 版本（错误用例：某模块自带旧 compiler → 字节码不一致事故）
- 要点5：构建提效：CI 按变更模块 `-pl 服务列表 -am` 增量构建，合并前主干 -T 1C 全量（输出：流水线时长数据）
- 要点6：发布：release/snapshot 双库分流，服务产物可独立 deploy（版本同仓号），公共库变更走 SNAPSHOT 联调

> 答案：见要点
> 解析：考点是"结构表达架构、版本单源、治理集中、构建增量"四条工程化原则的落地组合。
