# 依赖声明与冲突解决 · 面试题

## 题 1：Gradle 和 Maven 冲突调解的根本区别？

- Maven：最短路径优先 + 同深度先声明优先——"离根近者胜"，与版本高低无关（结果：深层的新版本会被浅层旧版本压掉，经典"降级陷阱"）。
- Gradle：最高版本优先——全图同 GAV 取最大，天然防意外降级。
- 追问：Gradle 什么时候也会选到你不想要的版本？答：你要的是降级时（最高优先顶不住传递进来的更新版），需要 force/downgrade 显式表达。

## 题 2：为什么要有 api/implementation 之分？

```groovy
// 目的：把"依赖暴露面"变成库作者显式声明的契约
// implementation 的效果有两层：
// 1 消费者编译类路径不含它 → 版本升级不触发下游重编译（增量构建友好）
// 2 发布元数据里记为 runtime → Maven 用户拿到的 POM 也一致（说明：不是本地私有概念，跨工具可见）
// 反例：全是 api → 下游编译依赖你的全部内库，你升一个小工具库 100 个下游重编译报警
```

## 题 3：dependencyInsight 是干什么的？给个实战用法。

- 回答"这个依赖为什么是这个版本/谁带进来的"：`gradle :app:dependencyInsight --dependency jackson-databind --configuration runtimeClasspath`。
- 输出包含每条引入路径 + 调解过程（`1.x -> 2.y` 及原因：conflict / constraint / forced），比 grep 全树快一个量级。
- 加分：排 NoSuchMethodError 的标准三连——异常栈定位类 → insight 查调解 → dependencies 看全景（示例场景：pay-sdk 与 cloud 依赖引入两个不同版本 commons-codec）。

## 题 4：Gradle 的 BOM 支持和 Maven 有什么不同？

- 能力等价：`platform(...)` 导入 BOM 后可省版本，对应 dependencyManagement/import。
- 差异在默认态度：Maven 项目普遍用父 POM 统一版本；Gradle 更推荐 platform + constraints 组合，且版本可被更细粒度覆盖规则调节。
- 追问：BOM 管得到传递依赖吗？答：管得到"未显式声明版本"的解析；对已在树中显式带版本的传递依赖，仍需 exclude/force 干预（错误预期："import BOM 就全图统一"）。

## 题 5：exclude、constraints、force、lockfile 四者的定位排序？

1. lockfile：固化事实（上次解析结果），管可重现，不管对错。
2. BOM/platform：面状统一（一组关联库的版本基线）。
3. constraints：点状下限 + 无坐标依赖的版本声明。
4. force：一票否决，破坏协商——只用于事故止血，必须带注释与到期跟踪（异常案例：force 存在两年，上游早已需要新版本，线上兼容性问题绕不过去）。
- 答出"优先级从高到低修复应反向选择（先 BOM 后 force）"即是满分信号。
