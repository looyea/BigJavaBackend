# 增量构建、构建缓存与 Daemon 提速

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能拆解 Gradle 快的四个来源（Daemon、增量、构建缓存、配置缓存），会写输入输出声明正确的自定义任务，能搭建远程缓存并定位"为什么不 UP-TO-DATE"。

## 一、四个提速机制分层看

```text
图目的：一次构建的时间去哪了，每层机制各治一段。
进程启动/ JVM 预热 ── Daemon 常驻（gradlew 第二次起省 2~5s）
配置期脚本评估     ── 配置缓存（快照复用，大仓省 10s~分钟级）
任务已算过         ── up-to-date 增量（比对输入输出指纹，跳过执行）
别的机器算过       ── 构建缓存（本机历史/远程共享，直接拉产物）
结果：四层是叠加收益；"Gradle 快"本质上=指纹判定 + 产物复用，而不是编译器的功劳。
```

## 二、up-to-date 判定：输入/输出声明是命门

```groovy
tasks.register('genOpenapi', JavaExec) {
    inputs.files(fileTree('src/main/java')) { it.withPropertyName('sourceDirs') } // 目的：显式声明输入
    outputs.dir('build/generated/openapi')                                          // 声明输出目录
    // 错误用法：任务读了一个 System.getProperty('profile') 却没进 inputs →
    //   改 profile 重跑显示 UP-TO-DATE —— 静默使用过期产物，比慢更可怕（异常结果误导全组）
    inputs.property('profile', providers.gradleProperty('profile').orElse('dev'))   // 正确：把隐形输入指纹化
}
```

- `gradle build --info` 看每任务跳过原因；定位疑难杂症用 `-Dorg.gradle.internal.tasks.stats` 或 `--scan`（Build Operations 页直接给出 "Task is not up-to-date because ..."）。

## 三、构建缓存：跨机器搬产物

```properties
# gradle.properties —— 目的：三行开关决定缓存在哪
org.gradle.caching=true
# 远程缓存节点写 build/settings.gradle 的 buildCache 块（http 节点需 allowInsecureProtocol，生产上挂 nginx+TLS+认证）
```

```groovy
// settings.gradle
buildCache {
    local { enabled = true }                     // 本机 ~/.gradle/caches/build-cache-1
    remote(HttpBuildCache) {
        enabled = true; url = 'https://cache.shop.internal/cache/'
        push = System.getenv('CI') != null       // 规范：只有 CI 推产物，本地只拉——防个人机器污染缓存
        // 反例：本地也 push=true 且不同 JDK 混用 → 缓存命中率抖动、拉到不兼容产物
    }
}
```

- 命中优先级：先判 up-to-date（本机输出还在），不在再查缓存拉回（结果："clean 后 30 秒重建"就是缓存的直观效果）。

## 四、配置缓存与 Daemon

```properties
org.gradle.configuration-cache=true   # 目的：快照任务图，二次构建跳过脚本评估
org.gradle.daemon=true                # 默认开：同一 Gradle 版本+JVM 参数复用进程
org.gradle.parallel=true              # 工程级并行，多模块仓立竿见影
org.gradle.jvmargs=-Xmx3g -XX:+UseParallelGC  # 大仓构建 JVM 默认堆常不够，GC 抖动比编译慢更隐蔽
```

- 配置缓存的兼容债：插件/脚本在配置期触碰 Project 对象到执行期（`project` 引用泄漏进任务）会报 "configuration cache problems"——升级 Gradle 的主要工作量在这里（异常处理：按报告逐条修，不能一关了之）。

## 五、自定义任务的缓存友好写法

```kotlin
// 目的：Kotlin DSL 风格的类型化任务（Groovy 侧用 @Input 注解同样成立）
abstract class ShadeTask : DefaultTask() {
    @get:Input abstract val mainClass: Property<String>          // 目的：类型化输入=可序列化，配置缓存兼容
    @get:InputFile abstract val jar: RegularFileProperty
    @get:OutputFile abstract val shaded: RegularFileProperty
    // 错误用法：任务里读 project.name 或 File 字段不做注解 → 指纹缺失或配置缓存报错
}
```

- 用 `@Input/@InputFile/@OutputFile` 契约取代手写 inputs/outputs 的地方越多，增量与缓存命中越可靠（验收标准：touch 无关文件不触发重跑，改输入必重跑）。

## 六、关联技术

- 任务图与两段模型是本节判定机制的地基，见 s1-1；依赖锁文件与缓存的互斥配合见 s1-2。
- CI 上如何编排这些开关（Daemon 在容器里的取舍）见 gitlab-ci/github-actions 包缓存章节；与 Maven 无此机制的对照见 maven s2-3。
