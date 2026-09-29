# 与 Maven 互操作及选型（关联）

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：讲清 Gradle 与 Maven 仓库体系的双向互操作（发布/消费/POM 翻译），掌握版本目录（libs.versions.toml）等现代实践，能给出公司级选型论证。

## 一、互通的地基：Maven 仓库格式是"通用语"

```groovy
// 目的：Gradle 消费侧完全兼容 Maven 仓库协议——GAV 坐标、POM 元数据、maven-metadata.xml、校验和
repositories {
    mavenLocal()                      // 本机 ~/.m2/repository（联调老 Maven 模块的应急通道）
    maven { url = uri('https://nexus.shop.internal/repository/maven-public/')
            credentials { username = providers.gradleProperty('nexusUser').orNull } } // 私服认证，凭据走属性不写死
}
// 错误用法：以为 Gradle 需要"转换"私有仓库 —— 只要 Nexus 的 maven-public 组能代理，Gradle/Maven 消费者完全同构
```

- 反向兼容：Gradle 工程发的构件带生成 POM，Maven 用户照常依赖——构建工具二选一，仓库永远只有一个。

## 二、发布互操作：POM 是被"翻译"出来的

```groovy
plugins { id 'maven-publish' }
publishing {
    publications {
        mavenJava(MavenPublication) {
            from components.java      // 目的：把 Gradle 模型翻译成 POM——api→compile、implementation→runtime
            versionMapping {
                usage('java-api') { fromResolutionOf('runtimeClasspath') } // 发布时固化解析版本而非范围
            }
            pom { name = 'shop-common'; licenses { license { name = 'Apache-2.0' } } } // Maven 生态惯例元数据
        }
    }
    repositories { maven { name = 'nexus'; url = uri('https://nexus.shop.internal/repository/maven-releases/') } }
}
// 反例：不配 versionMapping 直接发布 → POM 里版本取自声明原文，动态版本/占位版本泄漏给 Maven 消费者 → 对方解析结果不可控
```

## 三、版本目录：Gradle 侧的"BOM 平替"补议

```toml
# gradle/libs.versions.toml —— 目的：集中声明版本与别名，类型安全访问，IDE 补全
[versions]
springboot = "3.2.5"
[libraries]
springboot-bom = { module = "org.springframework.boot:spring-boot-dependencies", version.ref = "springboot" }
hikari = { module = "com.zaxxer:HikariCP" }   # BOM 管版本，此处只给别名
```

```groovy
dependencies { implementation(platform(libs.springboot.bom)); implementation(libs.hikari) }
// 错误预期：版本目录会生成/替代 POM —— 它只是脚本内的集中声明，发布时仍翻译进 POM
```

## 四、消费侧迁移对照速查

| Maven 概念 | Gradle 对应 | 注意点 |
|-----------|-------------|--------|
| dependencyManagement/import BOM | platform(...) / libs.versions.toml | 管版本不管已显式声明的传递版本 |
| <exclusions> | exclude group/module | 语义一致 |
| parent POM 统一版本 | 约定插件 / buildSrc 平台约束 | Gradle 无 parent 概念 |
| mvn versions:display-dependency-updates | dependencyUpdates 插件 / --refresh-dependencies | 升级巡检要重建工具链 |
| settings.xml mirror | repositories + init.gradle | 镜像需在仓库 URL 层做或 Nexus 代理 |

## 五、公司级选型论证（承 maven s2-3，站 Gradle 视角）

1. 选 Gradle 的硬理由：Android、多语言（proto/js/native 混编）、超大仓增量诉求、需要自定义任务流水线（代码生成→编译→契约测试的强顺序图）。
2. 不选的硬理由：团队纯 Java 后端 + 强治理文化（POM 静态可扫、安全审计工具默认吃 POM）、CI 平台对新工具的适配成本。
3. 折中现状是被低估的正解：**库用 Gradle 写、发布仍是 Maven 格式、消费方无感**——选型问题被互操作层消化掉大半（说明：mavenLocal 联调是应急不是架构）。

## 六、关联技术

- 概念反差（配置期/执行期、DSL）见 s1-1；依赖语义映射细节见 s1-2。
- Maven 侧视角与迁移四步见 maven 包 s2-3；私服共用见 maven s2-2。
