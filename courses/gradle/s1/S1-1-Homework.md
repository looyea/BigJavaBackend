# build.gradle、settings 与 Groovy/Kotlin DSL · 作业

## 作业 1：亲手验证两段模型

**目标**：用输出证据复述"配置期/执行期"。

1. 建两模块工程，在根 build.gradle 顶层加 `println 'CONFIG'`，在注册任务的 doLast 里加 `println 'EXEC'`。
2. 依次执行 `gradle help`、`gradle :app:tasks`、`gradle :app:run`，记录每条命令的输出矩阵（输出：help 只有 CONFIG 没有 EXEC 即为验收通过）。
3. 加 `-Dorg.gradle.configuration-cache=true` 重跑两次，观察第二次 CONFIG 消失（结果：快照复用跳过脚本评估）。

## 作业 2：双 DSL 平移

**目标**：把作业 1 工程整体翻译成 Kotlin DSL。

1. 重命名为 build.gradle.kts，处理 Groovy→Kotlin 的语法差异（字符串、委托、类型）；记录卡住的报错原文与修法（错误用例体验：至少撞一次 `tasks.register` 的 Kotlin 类型推断问题）。
2. 根工程用 kts、子工程保留 groovy，验证混合工程可正常构建（说明：DSL 是工程级选择，不是全局约束）。

## 作业 3：坏味道改造

**目标**：治理一段"命令式滥用"脚本。

1. 给定（自编亦可）一段反例脚本：顶层读 System.getenv 拼依赖列表、用 create 急切注册三个任务、settings.gradle 里写 repositories 之外的依赖。
2. 按规范改造：依赖回位、-P 属性注入、register 惰性化（验收：改造前后 `gradle build` 产物 jar 内容一致，且配置缓存开启无报错）。
3. 写 5 行 review checklist，供组内 MR 检查 Gradle 脚本使用。
