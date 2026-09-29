# build.gradle、settings 与 Groovy/Kotlin DSL

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能读懂并写出 Gradle 工程骨架（settings + build），分清配置期/执行期两段模型，说清 Groovy 与 Kotlin DSL 的取舍，理解 Gradle 与 Maven 声明式哲学的根本差异。

## 一、工程骨架：两个文件各管一头

```groovy
// settings.gradle —— 目的：定义"这次构建涉及哪些工程"，最先被评估
rootProject.name = 'shop-parent'
include 'shop-common'
include 'shop-order'
include 'shop-gateway'
// 错误用法：把依赖写进 settings.gradle —— 它只管工程结构与插件仓库（pluginManagement），依赖属于各工程的 build.gradle
```

```groovy
// shop-order/build.gradle —— 目的：定义"这个工程怎么构建"
plugins { id 'java-library'; id 'org.springframework.boot' version '3.2.5' }
group = 'com.shop'; version = '1.0.0'          // 对应 Maven 的 GAV 坐标
repositories { mavenCentral() }                 // 仓库声明在使用方工程（Maven 写在 settings.xml，这是两处差异点之一）
dependencies {
    api project(':shop-common')                 // 工程间依赖用坐标而非 GAV
    implementation 'mysql:mysql-connector-j:8.4.0'
}
```

- 对照 Maven：`settings.gradle`≈聚合+继承的混合体，`build.gradle`≈POM，但 repositories 从全局配置搬进了工程脚本。

## 二、配置期 vs 执行期：Gradle 最重要的心智模型

```text
图目的：一次 gradle build 的两段时序。
配置期（每次必跑，除非配置缓存命中）：评估 settings → 评估每个 include 工程的 build.gradle → 构建任务依赖图；
执行期：按图调度 task，判定 up-to-date/缓存命中 → 跳过或执行动作。
结果：脚本里的 println 出现在"配置期"，哪怕你只执行 gradle tasks——因为它在 build.gradle 顶层，评估即执行。
```

```groovy
println '我会在配置期打印，无论执行什么任务'     // 错误用例预期：新人以为它属于构建输出，实际 gradle help 也会打印
tasks.register('smoke') {
    doLast { println '我只在执行 smoke 任务时打印' } // 正确：任务动作放进 doLast/doFirst 延迟到执行期
}
```

- 典型坑：配置期就调用 `tasks.getByName('x') { ... }` 强改未创建任务会报错；应使用 `register` 惰性创建（配置缓存友好）。

## 三、Groovy DSL vs Kotlin DSL

| 维度 | Groovy（build.gradle） | Kotlin（build.gradle.kts） |
|------|------------------------|------------------------------|
| 语法 | 动态、宽松（引号即字符串） | 静态类型、需显式类型 |
| IDE 补全 | 一般（动态语言限制） | 极强（编译期检查脚本本身） |
| 报错时机 | 运行到才暴露 | 编写期即红线 |
| 生态惯性 | Android 老项目、大量文档示例 | Android 新官方示例、Kotlin 团队首选 |
- 取舍：团队会 Kotlin 就上新项目用 kts（脚本本身可测试、类型安全）；存量 Groovy 脚本没有"为语法而重写"的必要（结果：两种 DSL 构建语义完全一致，只是脚本语言之差）。

## 四、与 Maven 声明式哲学的根本差异

```groovy
// Maven：POM 是纯数据，构建器读数据；Gradle：build.gradle 是程序，构建器执行程序来"长出"数据
configurations.configureEach {
    resolutionStrategy.cacheChangingModulesFor 10, 'minutes'  // 目的：SNAPSHOT 类动态版本 10 分钟内不重复解析
}
// 反例：把 DSL 当配置文件写，在脚本里堆 if/else 读环境变量拼依赖 —— 可维护性崩塌，这正是 Maven 阵营攻击 Gradle 的把柄
```

- 结论：Gradle 的能力与风险同源——可编程。规范团队应约束"脚本只做构建逻辑，不读外部环境"。

## 五、最小可用命令集

```bash
gradle init                        # 脚手架（交互式选 DSL/项目类型）
gradle build -s                    # 全量构建；-s 输出异常栈定位配置期脚本错误
gradle :shop-order:test --tests '*OrderApp*'   # 任务路径 + 过滤，工程级定向执行
gradle dependencies --configuration runtimeClasspath  # 看某 configuration 的解析树（下节主题）
```

## 六、关联技术

- 依赖声明与冲突解决见 s1-2；提速三件套（增量/缓存/Daemon）见 s1-3。
- 与 Maven 的选型对照与迁移路径见 maven 包 s2-3 及本包 s1-4。
