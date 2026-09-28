# Maven vs Gradle 选型与迁移（关联） · 面试题

## 题 1：面试官问"Gradle 比 Maven 快在哪"，怎么答得不出错？

- 机制层三件事：任务级 up-to-date 检查（输入输出指纹）、构建缓存（本机/远程拉产物）、配置缓存（跳过重复的配置期脚本执行）；Maven 生命周期没有等价物。
- 代价也要说：Gradle 配置期要真的执行 DSL，冷构建+大仓时配置开销可能反超；"快"只在高重复增量场景成立（错误预期："换工具自动快十倍"）。
- 加分：Maven 侧能拿回七成收益的动作——`-T` 并行、CI 缓存 ~/.m2、surefire fork、收敛依赖树。

## 题 2：implementation vs api 对应 Maven 的什么概念？

```groovy
// 目的：Gradle 用配置语义显式表达"传递依赖是否暴露给消费者"
api 'com.shop:common-core:1.0'        // 出现在消费者编译类路径 —— 近似 Maven compile scope
implementation 'com.shop:shop-util:1.0' // 只进运行时，消费者编译不可见 —— Maven 无此编译期隔离
// 结果：Maven compile 是"全传递"默认，Gradle implementation 默认收窄暴露面，编译更快、升级冲击更小
// 反例：库作者全用 api 图省事 → 暴露面等于没隔离，消费者版本冲突照样爆发
```

## 题 3：公司全量从 Maven 迁 Gradle，你支持吗？

评分点不在站队，在看拆题框架：

1. 需求牵引判断：有 Android/复杂代码生成/monorepo 增量诉求吗？没有 → 先做 Maven 侧优化并量化。
2. 团队成本：DSL+构建模型双学习曲线，大型后端团队的教学与 review 成本。
3. 治理平移：enforcer 规则、依赖白名单、jacoco 阈值在 Gradle 侧重建是否完备——迁移事故多发于治理缺位期。
4. 回退路径：渐进四步（影子期→核心链→治理→收尾），每步可停。

## 题 4：Gradle 项目发的构件，Maven 用户能用吗？涉及哪些"翻译"？

- 能。发布走 `maven-publish`，产物仍是 GAV + POM + 校验和，仓库协议（Maven 布局）与构建工具解耦。
- 翻译点：`api`→ POM compile scope、`implementation`→ runtime scope；依赖排除、BOM 导入均可映射（说明：POM 是 Gradle 发布的元数据载体，不是被绕过的对象）。
- 追问：为什么 Gradle 依赖解析用的坐标体系和 Maven 一样？答：中央仓库 metadata（maven-metadata.xml）自 2004 年起就是事实标准。

## 题 5：两种构建"模型"的本质区别一句话说清？

> Maven 声明"**做什么的固定链条**"（生命周期阶段不可变，插件挂接）；Gradle 声明"**任务组成的图**"（节点可增删、边可改、输入输出可判定）。

- 由此推出：Maven 一致性强、工具可静态解析 POM；Gradle 灵活性强、但脚本错误要到执行时才暴露（异常发生在配置期/执行期，而不是解析期——这是排障思路的分水岭）。
