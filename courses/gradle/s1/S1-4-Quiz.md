# 与 Maven 互操作及选型（关联） · 小测

### 1. Gradle 工程依赖私服上的构件，需要的条件是？（6分）

- A. 私服开启 Gradle 专用协议
- B. 仓库对 Gradle 暴露标准 Maven 布局（GAV+POM+metadata）即可
- C. 构件必须重新用 Gradle 发布
- D. 必须安装 maven-compat 插件

> 答案：B
> 解析：Gradle 的解析器直接说"Maven 仓库方言"，Nexus/Artifactory 的 maven 仓库类型天然互通，无需任何转换。

### 2. Gradle 发布时，implementation 依赖在生成 POM 中记为？（6分）

- A. compile
- B. provided
- C. runtime
- D. system

> 答案：C
> 解析：api→compile、implementation→runtime 是 components.java 的翻译规则（结果：Maven 消费者编译期看不到它，与 Gradle 语义一致）。

### 3. versionMapping 的用途是？（6分）

- A. 映射 JDK 版本
- B. 发布时用实际解析出的确定版本写入 POM，而非声明时的范围/占位
- C. 转换 artifactId 命名
- D. 锁定插件版本

> 答案：B
> 解析：不配则动态版本可能原样泄漏给 Maven 消费者，对方解析结果不可控（异常场景：下游构建随你发布时的解析缓存漂移）。

### 4. libs.versions.toml 定位正确的是？（6分）

- A. 替代 POM 的发布元数据
- B. Gradle 脚本层的集中版本/别名声明，发布时仍翻译进 POM
- C. 只支持 Kotlin DSL
- D. Maven 官方新标准

> 答案：B
> 解析：版本目录是声明体验与治理的改进，不改变发布协议；Groovy/Kotlin DSL 均可用。

### 5. Maven 的 parent POM 统一版本，在 Gradle 中没有直接对应，常见替代是？（6分）

- A. 没有其他办法
- B. 约定插件/buildSrc 注入 platform 约束 + 版本目录
- C. 用 extends 关键字
- D. 复制粘贴每个脚本

> 答案：B
> 解析：Gradle 用"可编程约定"替代 XML 继承：一个 apply 的 convention plugin 给全仓挂 BOM 与规则，效果等价且可测试。

### 6. 想让 Maven 本地 ~/.m2 里刚 install 的 SNAPSHOT 被 Gradle 看到，应？（6分）

- A. repositories 加 mavenLocal() 并注意其放首位的缓存语义争议
- B. 删除 Gradle 全部缓存
- C. 不可能，两工具缓存互斥
- D. 设置 GRADLE_USE_M2=1

> 答案：A
> 解析：mavenLocal() 可联调；但 SNAPSHOT 变化版本仍受 cacheChangingModulesFor 影响，联调期建议设 0（错误预期：加了 mavenLocal 就永远实时）。

### 7. 下列哪项是"该选 Maven"的合理依据？（6分）

- A. Android 大型多模块应用
- B. 需要自定义复杂任务图
- C. 安全审计与治理工具链完全依赖 POM 静态扫描且团队无 Gradle 经验
- D. monorepo 增量构建诉求

> 答案：C
> 解析：A/B/D 都是 Gradle 主场；C 是真实的组织约束——工具链适配与团队成本足以否决"技术上更优"的选项。

### 8. 关于 Gradle→Maven 消费互通，正确的有（多选）（9分）

- A. Gradle 发布的构件 Maven 可直接依赖，无需 Maven 侧任何改动
- B. 生成 POM 的 scope 翻译影响 Maven 消费者的编译类路径
- C. Gradle 工程不能引用中央仓库
- D. 同一 Nexus 仓库可同时承载两工具发布的构件

> 答案：ABD
> 解析：A 是互操作基本盘；B 中 api/implementation 翻译为 compile/runtime 直接决定下游编译可见性；Gradle 原生支持 Maven Central（C 错误）；仓库不感知构建工具（D）。

### 9. 迁移治理清单中容易被遗漏的项有（多选）（9分）

- A. 依赖漏洞扫描工具从 POM 解析改为吃 Gradle 模型（如 report 插件或导出依赖清单）
- B. CI 缓存策略从 ~/.m2 目录缓存升级为构建缓存/依赖缓存双轨
- C. 代码格式化/版本规则的 enforcer 等价物重建
- D. settings.xml 的 mirror 配置直接照搬到 init.gradle 即可全部生效

> 答案：ABC
> 解析：治理与工具链平移是最易缺位的一步；D 表述过头——mirror 语义与 repositories 模型不同，需在 URL 层或 Nexus 代理实现（错误用例）。

### 10. 简答题：公司二方库团队想把对外交付从 Maven 换成 Gradle，消费方全是 Maven 老项目。请给出完整方案与风险点。（40分）

- 要点1：确认零侵入基本盘——交付物仍是 Nexus 上的 GAV+POM，消费方无感知；目的：把"换构建工具"降维成"换生产工具"。
- 要点2：发布配置要点：maven-publish + components.java + versionMapping，保证 POM 里 scope 翻译与版本固化正确（验收：用纯 Maven demo 工程消费新版本，编译/运行/排除行为与旧产物一致）。
- 要点3：元数据对齐：POM 的 name/description/licenses/scm 补齐，否则对方治理平台报表缺列（错误用例：只测可用性不测可审计性，上线后被安全团队打回）。
- 要点4：版本语义保持：release 不可变、SNAPSHOT 时间戳机制两工具一致，deploy 目标库不变（说明：仓库协议与工具解耦在此场景的体现）。
- 要点5：风险一：Gradle 动态版本/占位版本泄漏进 POM 使下游解析漂移——用 versionMapping/锁文件阻断，发布前用 mvn dependency:tree 抽查。
- 要点6：风险二：CI/CD 与制品流水线适配（插件、凭证、缓存）先双轨并行一个迭代，对拍产物 class 清单与依赖树 diff 作为切换验收，保留回退路径。

> 答案：见要点
