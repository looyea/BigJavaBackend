# 依赖声明与冲突解决 · 小测

### 1. Gradle 默认的版本冲突解决策略是？（6分）

- A. 最短路径优先
- B. 先声明优先
- C. 最高版本优先
- D. 最近使用优先

> 答案：C
> 解析：Gradle 冲突调解取最高版本；Maven 才是最短路径优先，这是两者"同一个包版本不同"结论不同的根源。

### 2. 二方库中某依赖只在方法体内部使用，应声明为？（6分）

- A. api
- B. implementation
- C. compileOnly 永久
- D. export

> 答案：B
> 解析：不进 public 签名就用 implementation，收窄消费者编译暴露面；api 留给类型外泄的依赖。

### 3. `runtimeOnly` 的效果是？（6分）

- A. 编译和运行都可见
- B. 只进运行时类路径，编译期不可见
- C. 只进测试编译
- D. 只下载不加载

> 答案：B
> 解析：典型如 logback——代码只面向 slf4j API 编程，实现只需运行时在位（结果：换实现不动编译）。

### 4. Lombok 在 Gradle 中应声明为？（6分）

- A. implementation
- B. api
- C. annotationProcessor（配合 compileOnly）
- D. runtimeOnly

> 答案：C
> 解析：Lombok 是编译期注解处理器，产物不需要它；标准写法 compileOnly + annotationProcessor 成对出现。

### 5. `implementation platform("spring-boot-dependencies:x")` 中 platform 的作用是？（6分）

- A. 指定运行平台架构
- B. 导入 BOM，后续依赖可省版本号
- C. 锁定 JDK 版本
- D. 排除全部传递依赖

> 答案：B
> 解析：platform 等价于 Maven 的 scope=import BOM；HikariCP 不写版本即从 BOM 解析。

### 6. 想让"版本冲突直接构建失败"，应配置？（6分）

- A. failOnVersionConflict()
- B. cacheDynamicVersionsFor 0
- C. transitive = false
- D. --refresh-dependencies

> 答案：A
> 解析：resolutionStrategy.failOnVersionConflict 把隐式调解变成显式报错并列出来源路径；B 管动态版本缓存时长，C 切传递，D 强制刷新。

### 7. 与 Maven `<exclusions>` 等价的 Gradle 写法是？（6分）

- A. configurations.all { exclude ... } 不生效
- B. 依赖声明块内 exclude group: 'xxx'
- C. transitive = true
- D. resolutionStrategy.force

> 答案：B
> 解析：依赖坐标后花括号块里 exclude group/module 精确剪枝；force 是锁版本不是排除，语义不同。

### 8. 关于 api 与 implementation，说法正确的有（多选）（9分）

- A. implementation 依赖不会出现在下游工程的编译类路径
- B. api 依赖会随 POM/元数据传递给消费者
- C. java-library 插件才有 api，纯 java 插件没有
- D. 全部改用 api 可以提升编译速度

> 答案：ABC
> 解析：A/B 是两者核心语义差；api 由 java-library 引入（C）；全 api 扩大暴露面导致下游重编译更多，只会变慢（D 错误）。

### 9. 下列哪些手段可以影响 Gradle 的依赖解析结果？（多选）（9分）

- A. constraints 块
- B. resolutionStrategy.force / eachDependency
- C. 依赖块内 exclude
- D. --write-locks 生成的锁文件

> 答案：ABCD
> 解析：四种都参与最终版本/集合决定：A 设下限、B 强制、C 剪枝、D 固化历史解析结果（重新解析范围受锁约束）。

### 10. 简答题：线上 NoSuchMethodError，怀疑依赖版本被传递覆盖，请给出完整排查与修复流程。（40分）

- 要点1：先复现定位——从异常栈确定缺失方法的类与所属 GAV，目的：把"玄学"收敛到单一坐标。
- 要点2：`gradle :app:dependencies --configuration runtimeClasspath` 查解析树，冲突节点会显示 `x.y -> a.b` 箭头（输出：谁引入低版本、谁引入高版本两条路径）。
- 要点3：也可用 `gradle :app:dependencyInsight --dependency <artifact> --configuration runtimeClasspath` 直接问"为什么是这个版本"，结果比全树更快。
- 要点4：修复优先级：BOM/platform 统一 → constraints 设下限 → 精确 exclude 问题引入方；反例做法是见冲突就 force，把治理债推给运行时。
- 要点5：若确需强制降级：resolutionStrategy.force 并写明原因注释与到期条件（异常场景：force 掩盖了上游真正的版本要求，需跟踪上游升级后移除）。
- 要点6：防复发：开 failOnVersionConflict 于 CI、--write-locks 固化解析、依赖升级走独立 MR；验收标准是同坐标全图唯一版本且测试全绿。

> 答案：见要点
