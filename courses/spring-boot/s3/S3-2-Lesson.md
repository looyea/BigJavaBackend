# GraalVM 原生镜像打包（Boot 工程实践视角）

> 本节难度：★★★★★
> 本节重要性：★★★★☆
> 学习产出：能讲清 Spring Boot 打原生镜像的构建流程与 AOT 机制；知道反射/动态代理/资源为什么需要"元数据提示"；能对"这个服务该不该上原生镜像"给出架构级判断。
> 与 graalvm 包的分工：本包聚焦 **Boot 如何把应用打包成原生镜像的工程流程与收益取舍**；closed-world 假设、reachability metadata 的底层原理在「GraalVM 与原生镜像」包深挖。

## 一、原生镜像是什么：AOT 换掉 JIT

普通 JVM 应用：字节码 → 运行期 JIT 边解释边编译，需要预热，启动要加载类、跑满自动配置。原生镜像（Native Image）用 **GraalVM 的 AOT 编译器**在**构建期**把"可达"的代码编译成平台相关的可执行文件：

- **启动**从秒级降到毫秒级（Spring PetClinic 常见从 ~1s 到 ~50ms）。
- **内存驻留**显著下降（无 JIT 代码缓存、堆更小），适合高密度容器/Serverless。
- 代价：**峰值吞吐通常低于预热后的 JIT**（缺运行期自适应优化），构建慢、调试与诊断工具链更受限。

```flow
构建期：应用代码 + 依赖 → Spring AOT 处理（生成代码 + 运行时 hints）
→ GraalVM native-image（closed-world 可达性分析）→ 平台可执行文件
运行期：直接执行，无字节码解释、无 JIT 预热
```

## 二、Spring 的 AOT 引擎：把"运行期动态"搬到"构建期固定"

Spring Framework 6 / Boot 3 引入 AOT 处理，因为 IoC、自动配置、条件注解本质是**运行期动态**，而原生镜像要**构建期确定**：

1. **训练/解析阶段**：在构建时启动一次应用上下文，把 `@Configuration`、自动配置筛选、BeanDefinition 解析结果"固化"成生成的 Java 源码与 `RuntimeHints`（reflection/proxy/resource/serialization hints）。
2. **静态初始化**：把适合常量化的是否计算结果写进 image，运行期直接可用。
3. 生成物在 `target/spring-aot` 下（`META-INF/native-image`、生成的 `*__BeanDefinitions` 等），native-image 据此编译。

## 三、最难啃的骨头：closed-world 与"动态特性丢失"

原生镜像假设"构建期能看见所有会执行的代码"（closed-world）。凡是**运行期才确定**的东西，编译器看不到就会漏掉，运行时表现为"类找不到 / 代理生成失败 / 资源读不到"：

| 动态特性 | 原生镜像下的问题 | 解法 |
| --- | --- | --- |
| 反射 `Class.forName` | 目标类未打入镜像 | `@ImportRuntimeHints` / `RuntimeHintsRegistrar` 注册 reflect-config |
| 动态代理 / CGLIB | 代理类未预生成 | 注册 proxy hints；尽量用接口 |
| 资源文件 `getResource` | 资源未打包 | resource hints（glob pattern） |
| 序列化（Jackson 等） | 字段/类型信息缺失 | `@RegisterReflectionForBinding` 或 hints |
| SPI / 服务加载 | 实现类未可达 | hints 或改用显式注册 |

> Boot 3 起多数官方 starter 已自带 hints；出问题的常是**第三方库或你自己写的反射代码**——这时手写 `RuntimeHintsRegistrar` 是标配技能。

## 四、怎么构建：两条工具链路线

- **Maven/Gradle 插件**：`spring-boot-maven-plugin` 的 `native` goal + `org.graalvm.buildtools:native-maven-plugin`（`./mvnw native-build`）。
- **Buildpacks（推荐起步）**：`./mvnw spring-boot:build-image -Pnative`，用 **tiny/ubi  builder + 可选 GraalVM 构建容器**，无需本机装 GraalVM，还能用 `-Dspring-boot.build-image.nativeImage.buildCache` 加速；若本机无 GraalVM，可用 **`spring-boot:build-image` 的 native builder image** 或 **DelegatingNativeImageBuilder**。

产物是一个免 JVM 的可执行文件或 slim 容器镜像，直接 `docker run`。

## 五、什么时候该上，什么时候别上

**适合**：Serverless/FaaS（冷启动敏感）、CLI 工具、需要极快弹性扩容的短生命周期 Pod、内存受限高密度部署、无状态快速伸缩的网关。

**不适合/谨慎**：长运行、追求峰值吞吐的核心交易服务（JIT 预热后更快）；重度依赖反射/动态字节码/DNS 库的遗留栈（hints 补齐成本高）；本地开发迭代期（构建慢拖节奏）。

**折中**：用 **CRaC**（Coordinated Restore at Checkpoint）或分层 JIT 预热兼顾启动与吞吐——不必非此即彼。这是架构师该提出的选项，而不是"无脑全量上原生"。

## 六、例子：用 RuntimeHints 修复 closed-world 丢反射（正确用法与错误用法）

```java
// 例子目的：为一个运行期才反射加载的类注册 reachability hint，避免原生镜像里 ClassNotFound
import org.springframework.aot.hint.*; import org.springframework.core.type.ClassMetadata;
class OrderHints implements RuntimeHintsRegistrar {   // 正确用法：实现 Registrar 并用 @ImportRuntimeHints(OrderHints.class) 引入
    public void registerHints(RuntimeHints hints, ClassLoader cl) {
        hints.reflection().registerType(
            com.bigjava.OrderRule.class,              // 把只供反射用的类显式登记
            TypeHint.MemberConstructorInvoke, TypeHint.MemberMethodInvoke); // 允许反射调构造/方法
    }
}
// 错误用法：直接 Class.forName("com.bigjava.OrderRule") 又不配 hint → 构建期看不到该类未入镜像→ 运行期抛 ClassNotFoundException
// 错误用法：依赖 Jackson 反序列化某 DTO 却不加 @RegisterReflectionForBinding→ 字段信息缺失，反序列化得到空对象
```

构建（两种工具链任选）：

```bash
# 例子目的：不装本机 GraalVM 也能用 Buildpacks 一次性产出原生镜像
./mvnw spring-boot:build-image -Pnative   # 正确用法：native builder image 在容器内编译，产免 JVM 的可运行镜像
# 错误用法：把 native-build 放在本地迭代每改一行就重跑→ 可达性分析极慢拖垮节奏（应只在 CI/需要时构建）
```

## 七、动手验证

1. 给一个最小 Boot Web 工程配 `native-maven-plugin`，跑 `./mvnw native-build`，测启动时间与 RSS，对比 `java -jar`。
2. 故意写一段 `Class.forName` 反射加载一个仅运行期用到的类，不配 hints → 运行期抛 `ClassNotFoundException`；补 `RuntimeHintsRegistrar` 后修复，体会 closed-world。
3. 打开 `-Dspring.aot.enabled=true` 以普通 JVM 运行 AOT 生成物，验证很多原生镜像问题在 JVM 模式下就能提前暴露。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 镜像里运行期 `ClassNotFoundException`/资源 null | 缺 reflection/resource hints |
| `@Transactional`/AOP 代理失效 | 未注册 proxy hints 或用了 final/无接口类 |
| 构建极慢、CI 超时 | 可达性分析重；用 build cache、分层构建、独立构建机 |
| 峰值吞吐不如旧 jar | AOT 无 JIT 自适应优化，长运行 CPU 密集场景本就如此 |
| 时区/locale 数据缺失 | 未开 `-H:IncludeAllLocalDates`/相关 feature |

## 九、关联技术栈

- **构建层**：GraalVM native-image、`native-maven-plugin`、Buildpacks/`spring-boot:build-image -Pnative`
- **框架层**：Spring AOT、`RuntimeHints`、`@ImportRuntimeHints`
- **原理层**：closed-world、reachability metadata（见 graalvm 包 s1-1）
- **云原生层**：容器瘦身、Serverless 冷启动、HPA 快速扩容
- **折中技术**：CRaC、AppCDS、JIT 预热
