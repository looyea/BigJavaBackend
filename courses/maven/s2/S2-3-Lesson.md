# Maven vs Gradle 选型与迁移（关联）

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：能从构建模型、性能、生态与团队成本四维对比 Maven/Gradle，掌握互操作机制与渐进迁移路线，避免"为快而迁"的反派决策。

## 一、机制差异的根：声明式生命周期 vs 命令式任务图

```text
图目的：同一个"打包"在两模型里的展开方式。
Maven：phase 固定链（compile→test→package），插件绑定 phase —— 你只能"挂上去"，链条不可变；
Gradle：task 有向图，输入/输出/依赖显式声明 —— 可以改边、加节点、跳过任意子图。
结果：Maven 的"约定优于配置"上手快、跨团队一致；Gradle 的"可编程"支撑了 Android/增量构建这类 Maven 长不出来的场景。
```

| 维度 | Maven | Gradle |
|------|-------|--------|
| 配置语言 | XML（声明式，结构固定） | Groovy/Kotlin DSL（可编程） |
| 构建模型 | 生命周期阶段链 | 任务依赖图 + 输入输出指纹 |
| 增量/缓存 | 无原生（靠插件拼） | up-to-date 检查 + build cache |
| 配置期开销 | 低（解析 XML） | 高（执行脚本，靠配置缓存缓解） |
| 生态成熟 | 极高（一切 CI/制品平台第一支持） | 高（Android/JVM 现代项目） |
| 学习曲线 | 平缓 | DSL+模型双曲线 |

## 二、性能差异从哪来（也要说代价）

```groovy
// 目的：Gradle 提速的三件套，Maven 只有并行（-T 1C）能对上第一件
org.gradle.parallel=true          // 模块级并行（Maven -T 可类比）
org.gradle.caching=true           // 构建缓存：未改输入的 task 直接拉产物（Maven 无此机制）
org.gradle.configuration-cache=true # 配置期快照复用，第二次起跳过执行期配置（对插件兼容性有要求）
// 错误预期："换 Gradle 自动快十倍" —— 大仓冷构建+配置期可能反而更慢，收益在高重复增量场景
```

- Maven 的隐性速度优势：POM 是机器可解析的"元数据即数据"，IDE 导入、依赖分析、漏洞扫描都比解析执行脚本便宜（说明：工具链友好度也是性能）。

## 三、互操作：不是非此即彼

```bash
# 目的：两边共存与过渡的标准动作
./gradlew generatePomFileForMavenPublication   # Gradle 生成 POM 发布到 Maven 仓库（私服消费方无感知）
mvn init -archetype-quickstart                 # Maven 侧脚手架（Gradle 对应 gradle init）
# Gradle 依赖声明解析的就是 Maven 仓库 GAV 坐标体系 —— "Maven 格式"才是互通的事实标准
# 错误用法：以为换 Gradle 就要迁仓库 —— 仓库协议（artifact 布局/metadata）与构建工具是两层，从未绑定
```

## 四、迁移路线（Gradle→Maven 罕见，此处按 Maven→Gradle）

```text
图目的：渐进迁移四步，每步可停（迁移是旅行不是开关）。
1 影子期：新模块先用 Gradle，老仓不动（双工具同仓，验证私服/CI 通路）；
2 核心链迁移：构建+测试+打包三件套过 CI 对拍（产物字节码近似性可 diff，验收：同测试集全绿）；
3 治理平移：enforcer/jacoco/依赖白名单等规则在 Gradle 侧重建（最易漏的一步——治理缺位期就是风险期）；
4 收尾：文档/模板/IDE 导入统一，冻结旧构建（结果：半年观察期内保留 Maven 回退路径）。
```

## 五、决策口诀（面试可直接背）

1. **团队>工具**：一半成员不熟悉 Gradle 模型的大型后端团队，迁移教学成本通常大于增量构建收益——存量 Maven 治理（BOM/enforcer/CI 缓存）先做透。
2. **需求牵引**：Android、复杂代码生成、多语言混合构建、超大规模 monorepo 增量 —— Gradle 原生优势场景。
3. **新建小项目**：两者皆可，团队规范统一最重要；Spring Boot 官方文档 Maven/Gradle 双轨示例齐全，无生态偏袒。
4. 反例警示："隔壁组换 Gradle 后构建快了" —— 很可能主要是他们加了远程缓存与并行，Maven -T+CI 缓存也能拿到七成收益，先做便宜的优化。

## 六、关联技术

- 细节机制见 gradle 包 s1-1~s1-3（DSL、依赖、缓存）；本节的 Maven 侧对照可回看 s2-1/s2-2。
- 下一代选项：Maven 4 的构建缓存与模型增强、Bazel/ Pants 等在超大规模场景的介入——选型题要能报出这三个名字。
