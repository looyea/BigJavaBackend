# Java 9-11：模块化与 LTS 落地 · 面试追问

> 这块面试常以"你们线上跑哪个 JDK、为什么"切入，考的是工程判断而非背特性。答好要兼顾：JPMS 的初衷与局限、9-11 的实用改进、版本选择背后的授权/生态成本。

## 题 1：Java 9 的模块系统解决了什么问题？你们项目真用了吗？

**期望时长**：2 分钟

**答题要点**：

- 解决：巨型 classpath、依赖不可声明、可见性只有 public、JDK 臃肿；`module-info` 声明 requires/exports/opens，jlink 裁剪运行时。
- 现实回答：多数**业务应用没真正模块化**，仍以 classpath 运行——收益归类库/平台，迁移摩擦（反射/SPI/native/`--add-opens`）大。

**追问链**：既然没用为何还要了解？→ 因为强封装会"反噬"：JDK 16+ 默认封锁内部 API 与反射，升级排障必须懂 exports/opens 与 `--add-opens`。

## 题 2：`exports` 和 `opens` 有什么区别？`InaccessibleObjectException` 怎么来的？

**答题要点**：exports 让包编译期可读；opens 额外允许运行时**反射深度访问**私有成员。Jackson/JPA/Spring 靠反射，目标包未 opens（且 JDK 强封装生效）就抛此异常。

**追问链**：不改 module-info 怎么临时解决？→ 启动参数 `--add-opens java.base/java.lang=ALL-UNNAMED`（unnamed module 即传统 classpath）。

## 题 3：`var` 是动态类型吗？能用在哪、不能用在哪？

**答题要点**：不是，仍是编译期确定的静态类型（局部变量类型推断）。可用于有初值的局部变量、传统 for、try-with-resources、lambda 参数（11）；**不能**用于字段、方法参数、返回类型、无初值声明、`var x = null`。

**追问链**：最佳实践？→ 右值类型显而易见时用（工厂、new、强转），否则写出显式类型保可读；别为省字牺牲信息量。

## 题 4：为什么很多大企业 Java 版本长期停在 8？后来为何又往 11/17 走？

**答题要点**：

- 停 8：稳定够用、生态/字节码库兼容、8 免费期长、迁移成本与风险高。
- 走 11/17：8 公共更新收紧 + 授权变化，新 LTS 带来性能（G1/ZGC）、语言红利与长期支持；发行版（Temurin/Corretto）提供开箱免费 OpenJDK。

**追问链**：为什么很多人跳过 11 直奔 17？→ 9-16 语言改进有限、17 才集齐 record/sealed/模式匹配等结构性特性，一步到位吃到现代化收益。

## 高频速答

- 9 的默认 GC？→ G1。
- `List.of` 可变吗？→ 不可变，`add` 抛 UnsupportedOperationException。
- `strip` vs `trim`？→ strip 按 Unicode 去全角空白，trim 只去 ASCII。
- jshell 是什么版本？→ 9。
- 模块化产物/分析工具？→ jmod / jlink（裁剪）/ jdeps（依赖分析）。
- 哪个是第一个"新节奏 LTS"？→ Java 11。
