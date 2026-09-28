# build.gradle、settings 与 Groovy/Kotlin DSL · 面试题

## 题 1：说说 Gradle 的配置期和执行期，为什么面试必问？

- 配置期：评估 settings → 评估每个工程脚本 → 产出任务依赖图；执行期：按图跑 task，先判 up-to-date/缓存。
- 为什么重要：90% 的"玄学问题"归因在这两层——println 不该出现却出现（配置期副作用）、任务没跑脚本却报错（配置期就炸）、构建慢在配置大仓。
- 加分：配置缓存把配置期变成"一次评估、多次复用"的快照，脚本里读环境变量/系统时间会让它失效（异常表现：CI 上报 configuration cache problems）。

## 题 2：settings.gradle 和 build.gradle 各管什么？repositories 写哪？

```groovy
// settings.gradle：rootProject.name + include 工程集合 + pluginManagement/dependencyResolutionManagement
dependencyResolutionManagement {
    repositories { mavenCentral() }   // 目的：新工程实践——仓库集中声明，子工程脚本不各自写
    // 反例：模式默认 PREFER_PROJECT 时子工程仍可覆盖；配 FAIL_ON_PROJECT_REPOS 后子工程再写 repositories 直接报错
}
// build.gradle：该工程的插件、坐标、依赖、任务定制
```

- 追问：依赖能不能写 settings.gradle？答：不能，依赖属于工程模型；写错位置评估期就失败或静默无效。

## 题 3：Groovy DSL 和 Kotlin DSL 怎么选？

- 语义完全一致，只是脚本语言：kts 类型检查前置、IDE 补全强、可单测；groovy 存量示例多、写法宽松。
- 团队决策：Kotlin 技术栈/新项目 → kts；Android 老仓大量 groovy 约定插件 → 继续 groovy，重写无收益。
- 错误答法："Kotlin DSL 构建更快"——构建性能由任务图与缓存决定，与 DSL 无关。

## 题 4：create 和 register 的区别？

```groovy
tasks.create('legacy') { doLast { ... } }   // 急切：配置期实例化，大仓拖慢配置期，配置缓存不友好
tasks.register('modern') { doLast { ... } } // 惰性：被请求/执行时才实例化 —— 官方默认姿势
// 结果：新版 Gradle 中 create 已废弃移除，迁移老脚本时先改这一处（示例：task 数>500 的工程配置期可差数秒）
```

## 题 5：buildSrc 是什么？和 Maven 的什么机制对应？

- buildSrc/src/main/groovy 下的代码在配置期前自动编译并上脚本类路径，用于自定义任务/约定插件，把"脚本编程"收进可测试单元。
- 代价：改动会使全仓配置失效重编译，大仓慎用重型 buildSrc，可换独立插件工程 + includeBuild（composite build）。
- Maven 对照：无直接等价物，最接近的是自建 Maven 插件——但写插件远比写 buildSrc 类重。

## 题 6：一道实操题：CI 上 `gradle build` 在"Configuring project :shop-order"卡 3 分钟，排查思路？

1. 定位在配置期 → 与依赖下载无关，查该工程脚本：循环遍历文件？网络调用？被别的工程配置期 get 触发？
2. `--profile` 输出各阶段耗时报告；开启配置缓存看"配置期是否本来就重复付费"。
3. 常见根因：顶层 `fileTree(...).files` 急切求值、for 大目录拼任务、依赖 settings 里 include 了不需要构建的百个模块（可拆构建）。
4. 说明：这类问题 Maven 几乎不会出现——POM 解析是纯数据操作；"命令式的代价在配置期"是两工具最本质的运维差异。
