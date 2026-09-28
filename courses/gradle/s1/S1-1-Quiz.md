# build.gradle、settings 与 Groovy/Kotlin DSL · 小测

### 1. Gradle 中定义"本次构建包含哪些子工程"的文件是？（6分）

- A. build.gradle
- B. settings.gradle
- C. pom.xml
- D. gradle.properties

> 答案：B
> 解析：settings.gradle 最先被评估，include 决定工程集合；build.gradle 定义单个工程如何构建。

### 2. 顶层脚本里的 `println 'x'` 何时输出？（6分）

- A. 仅在 build 执行期
- B. 仅在 test 任务时
- C. 任何 Gradle 命令的配置期都会输出
- D. 只有 --info 级别才输出

> 答案：C
> 解析：顶层语句属于配置期脚本体，评估 build.gradle 即执行，哪怕运行 gradle help。

### 3. 关于 repositories 声明位置，正确的说法是？（6分）

- A. 只能写在全局 init 脚本
- B. 写在各工程的 build.gradle（或集中约定），与 Maven 的 settings.xml 不同
- C. 必须写在 settings.gradle
- D. Gradle 不需要声明仓库，自动扫私服

> 答案：B
> 解析：Gradle 把仓库作为工程模型的一部分声明在脚本里；settings.gradle 中只有 pluginManagement 管插件仓库。

### 4. Kotlin DSL 脚本的文件名是？（6分）

- A. build.gradle.kt
- B. kotlin.gradle
- C. build.gradle.kts
- D. settings.kts 是唯一形式

> 答案：C
> 解析：.kts 为 Kotlin Script；settings 侧对应 settings.gradle.kts，两种 DSL 构建语义一致。

### 5. 任务动作延迟到执行期运行的正确写法是？（6分）

- A. tasks.create('x') { println 1 } 且不加 any 块
- B. tasks.register('x') { doLast { ... } }
- C. 在 buildscript 块内直接写语句
- D. apply from 引入的脚本里写顶层语句

> 答案：B
> 解析：register 惰性创建 + doLast/doFirst 才是执行期动作；A 的 create 是急切实例化且顶层语句仍属配置期。

### 6. 与 Maven 相比，Gradle "命令式构建"的含义是？（6分）

- A. 只能用命令行触发构建
- B. 构建脚本本身是程序，执行它来生成任务图
- C. Maven 不能用脚本扩展
- D. Gradle 没有声明式写法

> 答案：B
> 解析：POM 是纯数据由构建器解读；build.gradle 是程序，构建器评估脚本来"长出一等公民的任务图"。

### 7. `gradle :shop-order:test --tests '*OrderApp*'` 的作用是？（6分）

- A. 全工程跑所有测试
- B. 只对 shop-order 工程执行 test 任务并按模式过滤测试类
- C. 重新生成测试报告目录
- D. 编译 shop-order 但不运行

> 答案：B
> 解析：任务路径 + --tests 过滤是 Gradle 定向执行的日常姿势，等价于 Maven 的 -pl + -Dtest。

### 8. 关于配置缓存（configuration cache），说法正确的有（多选）（9分）

- A. 命中后跳过配置期脚本评估，直接复用任务图快照
- B. 开启后 println 调试信息会消失属正常现象
- C. 脚本在配置期读取环境变量等外部状态会阻碍缓存复用
- D. 任何插件都无需升级即可兼容配置缓存

> 答案：ABC
> 解析：配置缓存快照复用后脚本不再执行（A/B 成立）；读取环境使结果不可复现，官方建议改用属性/系统参数（C）；旧插件不兼容会明确报错，需升级（D 错误）。

### 9. Groovy DSL 与 Kotlin DSL 对比，正确的有（多选）（9分）

- A. Kotlin DSL 类型检查更强，脚本错误编写期即暴露
- B. 两者构建语义完全一致，可混用（根与子工程各选一种也能工作）
- C. Kotlin DSL 性能显著优于 Groovy DSL 一个数量级
- D. 存量 Groovy 工程必须重写才能使用 Gradle 新版本

> 答案：AB
> 解析：kts 的优势在 IDE 与类型安全（A）；语义一致且工程级混用可行（B）；性能差异可忽略（C 错误）；Groovy DSL 长期被官方支持（D 错误）。

### 10. 简答题：同事把依赖声明写进了 settings.gradle，并在 build.gradle 顶层加了大量 if(env) 逻辑。请指出问题并给出改造方向。（40分）

- 要点1：settings.gradle 的职责边界——工程集合、根工程名、pluginManagement 仓库；依赖属于各工程 build.gradle，写错位置导致语义混乱且不会被解析进编译类路径，结果是构建失败或依赖失踪的异常。
- 要点2：顶层 if(env) 在配置期执行——每个 Gradle 命令（包括 gradle help）都会评估，输出与示例中 println 一样污染配置期；说明：这使行为依赖外部环境，CI 与本地结果不一致。
- 要点3：读环境变量破坏配置缓存复用——外部状态变化无法被指纹感知，缓存可能带着过期决策跑，属于反例写法。
- 要点4：改造方向一：依赖块搬回 build.gradle 的 dependencies 配置，用 api/implementation 区分暴露面。
- 要点5：改造方向二：环境差异改用 gradle.properties/-P 参数或 JVM 属性注入，构建脚本只读 Gradle 模型内属性，验收标准是同一命令任意环境输出一致的任务图。
- 要点6：改造方向三：确需按条件装配时，把逻辑收进约定插件（buildSrc 或独立 plugin 工程）并加单元测试，禁止散落在各模块脚本——目的：可编程能力集中治理。

> 答案：见要点
