# Java 9-11：模块化与 LTS 落地

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：看懂 Java 9 最大的动作 **JPMS 模块系统**（`module-info`、`requires/exports`、强封装）想解决什么、又为什么在企业里"落地难"；记住 9/10/11 真正高频实用的语言与库改进（`List.of` 不可变集合、`var`、新版 HTTP 客户端、String 增强、jshell）；理解**企业为什么长期停在 8 和 11**（授权、生态、迁移成本），并知道 9→16 是"特性流水线"、真正结构升级要等 17（下一节）。

## 一、JPMS：为"平台自身"造的模块化（★★★★☆）

Java 9 的旗舰特性是 **Java Platform Module System（Project Jigsaw）**，目标是解决"巨型 classpath"痼疾：JDK 本身臃肿、依赖关系全靠约定、类可见性只有 public 一档。

```java
// module-info.java —— 声明式地描述"我是谁、我依赖谁、我对外暴露什么"
module com.big.order {
    requires java.sql;              // 编译期+运行期都依赖
    requires transitive spring;     // 我的依赖会传递给引用我的人
    exports com.big.order.api;      // 只有这个包对外可见
    exports com.big.order.spi to com.big.pay;  // 定向导出
    opens com.big.order.model;      // 允许反射深度访问（给 Jackson/JPA）
}
```

- **`exports` vs `opens`**：exports 是编译期可读，opens 专门放行**运行时反射**——Spring/Hibernate/Jackson 靠反射访问私有成员，模块化后若没 `opens` 会 `InaccessibleObjectException`（JDK 16+ 默认强封装后成为大坑，呼应 s3-2 反射）。
- **jlink**：把"应用 + 它真正用到的模块"裁成自定义精简运行时镜像，容器镜像体积骤减。**jdeps** 分析依赖、**jmod** 是模块产物格式。

> **现实**：JPMS 对**平台/类库作者**意义大，但绝大多数**业务应用并未真正模块化**（仍以 classpath / 未写 `module-info` 运行）。因为它带来的迁移摩擦（反射、SPI、动态代理、native）远大于收益，Spring 官方长期建议普通应用"不模块化"。这是本节最重要的工程判断。

## 二、真正天天用得上的库改进（★★★☆☆）

抛开模块系统，9/10/11 沉淀下来的高频实用点：

| 版本 | 特性 | 用途 |
| --- | --- | --- |
| 9 | `List.of/Set.of/Map.of` | 一行造**不可变集合**，替代 `Collections.unmodifiable*`（呼应 s1-2） |
| 9 | `Optional.stream()`、`ifPresentOrElse` | Optional 融入 Stream 流水线 |
| 9 | `takeWhile/dropWhile`、迭代 `iterate` | Stream 增强 |
| 9 | **jshell** REPL | 快速验证 API，写 demo 不再建工程 |
| 9 | G1 成为默认 GC | 大堆运维默认项 |
| 10 | **`var`** 局部变量类型推断 | 右值类型明确时减样板；字段/参数不适用 |
| 10 | `List.copyOf` | 防御性拷贝 |
| 11 | 标准化 **HttpClient** | 替代老迈的 `HttpURLConnection`，支持 HTTP/2、异步 |
| 11 | String 增强 `strip/repeat/lines/isBlank` | `strip` 能正确去全角空白（`trim` 不能） |
| 11 | `var` 用于 lambda 参数、`Predicate.not` | 可读性 |

```java
var list = List.of("a", "b");          // 不可变，add 会抛 UnsupportedOperationException
var http = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_2).connectTimeout(Duration.ofSeconds(3)).build();
// isBlank 比 isEmpty 更能识别 "   " 这类纯空白
```

## 三、企业为什么停在 8 与 11（★★★☆☆）

这是架构选型题的高频真实约束，不是技术问题而是工程/成本问题：

- **授权与成本**：Oracle JDK 8 免费期过后、11 起采用新商业许可（BULK，虽后有 NFTC 调整），企业升级要过采购/合规；大量团队转 **OpenJDK / Temurin / Amazon Corretto / Azul** 等发行版规避。
- **生态兼容**：老项目依赖的框架、中间件、字节码增强库（早期 CGLIB/ASM 版本）未必跟得上新 class 文件格式与大版本。
- **迁移摩擦**：JPMS 强封装、内部 API（`sun.misc.Unsafe`、`--add-opens`）被逐步封锁，改动面大。
- **发布节奏突变**：9 起改**半年一版、仅某些是 LTS**，非 LTS（9/10/12-16）不再长期支持，企业只认 LTS——于是 8 之后普遍先停 **11**，再等成熟的 **17**。

> **落地节奏**：2018 前后主流是 8；11 作为第一个"新节奏 LTS"承接部分迁移；但真正带来语言级现代化红利（record/sealed/模式匹配）的是 17——所以下一节才是"结构性升级"的起点。

## 四、动手题

1. 用 `jshell` 连续敲 `List.of(1,2,3)`、`"  a  ".strip()`、`"a".repeat(3)`、`"   ".isBlank()`，直观感受 9/11 的库改进。
2. 把一个 Maven 项目从 JDK 8 升到 11，编译运行，记录是否需要 `--add-opens java.base/...`（尤其反射/序列化处）。
3. 给一个自有模块写 `module-info.java`，故意不 `opens` 一个被 Jackson 反射的包，复现 `InaccessibleObjectException` 再修复。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 升 11/16+ 后反射私有字段报错 | JPMS 强封装，未 `opens`/`--add-opens` |
| `List.of(...)` 调 `add` 抛异常 | 9 的工厂方法返回**不可变**集合 |
| 升级后 `sun.misc.*`/内部 API 编译不过 | 内部 API 被封装/移除，需找替代 |
| 容器镜像没变小 | 用了模块化却没走 **jlink** 裁剪运行时 |
| 团队对"该升哪个版本"混乱 | 未认准 **LTS** 与发行版授权策略 |

## 六、关联技术栈

- **向前**：`List.of` 不可变 ↔ s1-2 集合；`var`/Optional 流化 ↔ s3-3 设计取向；反射受模块封装限制 ↔ s3-2
- **向后**：真正的语言结构升级（record/sealed/模式匹配）↔ 本节下一节 Java 17；虚拟线程 ↔ s2-1 Java 21
- **运维**：GC 演进（G1 默认→ZGC/Shenandoah）↔ jvm 分区、构建运维分区（jlink 精简镜像）

## 七、本节小结

Java 9-11 记住三条主线：**JPMS 是"给平台自己"的模块化，业务应用大多不落地但要知道 `exports/opens` 与强封装的坑；日常真正吃到的是 `List.of`/`var`/新 HttpClient/String 增强这些库改进；企业停在 8/11 主要是授权+生态+迁移成本，而非语言不够好。**

下一节 Java 17 LTS——record、sealed、instanceof 模式匹配，语言结构真正的现代化。
