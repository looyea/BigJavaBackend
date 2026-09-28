# 与 Maven 互操作及选型（关联） · 面试题

## 题 1：Gradle 工程怎么被 Maven 项目使用？中间发生了什么？

- 发布走 maven-publish：产物 jar + 自动生成的 POM 上传 Maven 布局仓库；Maven 消费者只见 GAV/POM，不知道也不需要知道生产端工具（结果：互通零改造）。
- 关键翻译表：api→compile、implementation/runtimeOnly→runtime、testImplementation→不出现在 POM；exclude/constraints 也有对应写法。
- 加分：versionMapping 让 POM 固化解析后的确定版本，防止动态声明泄漏（错误用例：Maven 下游拿到 "latest.release" 字面量，构建随机失败）。

## 题 2：Maven 的 dependencyManagement 换到 Gradle 怎么写？

```groovy
// 目的：三选一按场景
dependencies {
    implementation platform('org.springframework.boot:spring-boot-dependencies:3.2.5') // 1 BOM 导入（最常用）
    constraints { implementation('com.google.guava:guava:33.2.1-jre') }                // 2 单点下限
}
// 3 约定插件/buildSrc 统一 apply——对应 Maven parent POM 的组织级统一（反例：每个模块手抄版本号）
```

## 题 3：mirror 概念在 Gradle 里存在吗？公司内网怎么加速？

- 没有 settings.xml 的 mirrorOf 全局拦截；等价手段：init.gradle 统一注入 Nexus 仓库 URL、或每个工程 repositories 指 maven-public 组仓库。
- 结论口径：Maven 用"镜像改写"，Gradle 用"仓库声明"——内网都收敛到 Nexus 代理层最稳（说明：换工具时网络治理动作要重做一遍，不是配置翻译）。

## 题 4：混合仓库（部分模块 Gradle 部分 Maven）长期共存可行吗？

- 可行且常见：依赖经私服 GAV 互通，构建互不感知；不可行的是"源码级联调"——Maven reactor 与 Gradle composite 不能互相 include。
- 治理要点：版本基线统一由 BOM（Gradle 可 import 同一 BOM）；CI 模板双轨；文档标注模块归属工具。
- 风险：同一逻辑库两工具各发一份坐标不同版本 → 消费者选错（异常案例：shop-util-mvn 与 shop-util 双版本漂移半年无人发现）。

## 题 5：选型终极问题："新项目 Java 后端，你定 Maven 还是 Gradle？"

- 满分结构：先问约束再给答案——团队技能栈（会 Kotlin？有 Android？）、仓库与 CI 现状、治理工具吃不吃 POM、是否有增量/多语言硬需求。
- 纯 Spring Boot 微服务团队：Maven 是完全正确默认（一致性、审计友好、新人即插）；Gradle 收益要等到规模与复杂度出现才兑现。
- 错误答法：站队工具宗教；或引用"业界都迁 Gradle"却没有机制与数据支撑（追问一句"快多少、怎么测的"就露馅）。

## 题 6：Maven Wrapper 和 Gradle Wrapper 的作用一样吗？

- 同核心：锁构建器版本进仓库（mvnw / gradlew + wrapper 配置），全员与 CI 同版本，避免"本机能构建"。
- 差细节：Gradle Wrapper 版本升级走 `gradlew wrapper --gradle-version`，且 wrapper 决定 Daemon 复用边界（版本不同新起进程）；Maven Wrapper 3.x 支持 distributionOnly 模式复用已装 mvn（说明：升级 wrapper 本身也要走 MR 回归）。
