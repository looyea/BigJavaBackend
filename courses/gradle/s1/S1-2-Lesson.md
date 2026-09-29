# 依赖声明与冲突解决

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：掌握 configuration 体系与 api/implementation 语义、传递依赖控制手段、dependency constraints 与 BOM 导入、冲突解决策略，能读懂 Gradle 依赖树并定位版本异常。

## 一、configuration：Gradle 依赖的挂载点

```groovy
configurations {
    // 目的：configuration 是"带用途的依赖集合"，插件预置了常用几个，手写新集合用于工具类依赖（如代码生成器）
    codegen.extendsFrom(configurations.implementation)
}
dependencies {
    implementation 'com.mysql:mysql-connector-j:8.4.0'   // 编译+运行时可见，不传递暴露
    runtimeOnly  'ch.qos.logback:logback-classic:1.5.6'  // 只进运行时类路径
    testImplementation 'org.junit.jupiter:junit-jupiter:5.10.2'
    annotationProcessor 'org.projectlombok:lombok:1.18.34' // 编译期处理器，不上运行类路径
    // 错误用法：compile —— Gradle 7 起已移除，迁移旧脚本先全局替换为 implementation/api
}
```

- 对照 Maven scope：`implementation≈compile(但收窄暴露)`、`runtimeOnly≈runtime`、`testImplementation≈test`、`annotationProcessor≈无直接对应（Maven 用 provided+插件配置）`。

## 二、api vs implementation：暴露面即契约

```groovy
// shop-common 是二方库，它的依赖选择直接决定 100 个下游的编译类路径
api 'com.fasterxml.jackson.core:jackson-databind:2.17.1'          // 下游 import JsonMapper 编译可过
implementation 'org.apache.commons:commons-lang3:3.14.0'          // 下游直接 import StringUtils → 编译失败
// 结果：api 进消费者编译类路径，implementation 只进消费者运行时
// 反例：库全部用 api "保险起见" → 暴露面失控，升级 commons-lang3 时下游全炸，等于回到 Maven 的全传递默认
```

- 判断法：类型出现在库的 public 签名/父类 → api；只在方法体内部用 → implementation。

## 三、冲突解决：默认最高版本 + 显式约束

```bash
gradle dependencies --configuration runtimeClasspath | grep mysql-connector  # 看解析树：冲突点会标注 -> 最终版本
```

```groovy
// 默认策略：同一 GAV 出现 8.0.33 与 8.4.0 → 直接选 8.4.0（最高版本优先，与 Maven"最短路径优先"根本不同）
dependencies {
    constraints {
        implementation('com.mysql:mysql-connector-j:8.4.0')   // 目的：不直接依赖它，只给传递路径设版本下限（参与冲突调解，仍最高者优先）
    }
    // 错误预期：以为 constraints 能强制降级 —— 它与 8.0.33 传递冲突时仍选 8.4.0；强制锁定要用 resolutionStrategy.force 或 downgrade 规则
    implementation platform('org.springframework.boot:spring-boot-dependencies:3.2.5') // BOM 导入，写法同 Maven
    implementation 'com.zaxxer:HikariCP'                       // 无版本：从 BOM 取 5.1.0 —— 与 Maven dependencyManagement 等价能力
}
configurations.configureEach { resolutionStrategy { failOnVersionConflict() } } // 治理开关：有冲突直接构建失败，逼显式决策
```

- failOnVersionConflict 输出会列出每个冲突的两条来源路径（示例：`8.0.33 -> 8.4.0` 及谁引入），是排"玄学 NoSuchMethodError"的第一杠杆。

## 四、传递依赖的裁剪手段

```groovy
implementation('shop:shop-pay-sdk:2.0') {
    exclude group: 'commons-logging'            // 全局去重老日志桥，对应 Maven <exclusions>
    transitive = false                          // 只要这个 jar 本体，切断全部传递（危险：运行时缺类异常后知后觉）
}
// 错误预期：transitive=false 后本地跑得通、上线 ClassNotFound —— 本地路径恰好被别的依赖补齐了类
```

- 首选 exclude 精确打击 + constraints 锁版本；transitive=false 只在工具型依赖上用。

## 五、锁定与可重现构建

```bash
gradle build --write-locks           # 把全解析结果写进 gradle/verification-metadata + lockfile
gradle build --offline               # 锁+缓存齐全时可断网构建（验收：CI 与本地解析结果逐字节一致）
# 依赖升级不再随机：加了新依赖才会触发相关配置的重新解析（结果：版本漂移类事故归零）
```

## 六、关联技术

- 配置期/执行期模型见 s1-1；锁文件与缓存在提速中的作用见 s1-3。
- Maven 侧对照（调解规则、dependencyManagement）见 maven 包 s1-1/s1-2；两边互通与发布见 s1-4。
