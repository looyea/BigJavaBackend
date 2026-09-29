# 原生镜像原理与限制

> 本节难度：★★★★☆
> 重要程度：★★★☆☆
> 学习产出：从底层讲清 GraalVM 原生镜像（Native Image）到底把 Java 编译成了什么、AOT 与 JIT 的本质差别；吃透**封闭世界假设（closed-world）**与**可达性元数据（reachability metadata）**这对因果——为什么反射/动态代理/资源加载在原生镜像里会失灵、如何补救；量化启动/内存收益与构建/吞吐代价，形成"什么服务该上、什么别上"的判断力。

> **分工说明**：Spring Boot 侧如何用 `native-maven-plugin`、`process-aot`、`RuntimeHints` 把应用**打包成**原生镜像，属实践流程，见 spring-boot s3-2；本节专讲**底层原理与限制**——那些配置之所以存在的根因。

## 一、GraalVM 是什么，原生镜像又是什么

GraalVM 不只是"另一个 JDK"，它包含三层：

1. **一个高性能 JDK 发行版**（可直接当普通 JVM 用，跑字节码 + JIT）。
2. **Graal 编译器**（用 Java 写的、可插拔的优化编译器）+ **Truffle** 框架（在其上实现 JS/Python/Ruby/R 等**多语言**运行时，互相零拷贝互操作）。
3. **Native Image 工具（`native-image`）**：把 Java 程序**提前编译（AOT）**成一个平台相关的**本机可执行文件**，运行时是精简的 **SubstrateVM（SVM）**——自带 GC、线程调度等最小运行时，**不再需要完整 JVM**。

```flow
              ┌── 传统 JVM：字节码 → 解释执行 → 热点探测 → JIT(C1/C2) 运行期编译+去优化
一个 Java 程序 ┤
              └── 原生镜像：源码/字节码 → 构建期可达性分析 → AOT 编译 → 本机 exe（含 SVM）
```

## 二、AOT vs JIT：一条时间线的转移

| 维度 | JIT（传统 JVM） | AOT（原生镜像） |
| --- | --- | --- |
| 编译时机 | **运行期**，边跑边编译热点 | **构建期**，一次性编译成机器码 |
| 预热 | 需要（刚启动走解释，性能爬升） | 不需要，上来就是机器码 |
| 优化依据 | 运行期**真实 profile**，可动态去优化 | 构建期**静态分析**，看不到未来负载 |
| 峰值吞吐 | 高（JIT 深度优化热点） | 常**略低**（缺运行期 profile，且封闭世界限制内联） |
| 启动/内存 | 慢/高（JVM+SVM 无关，有解释器/编译器/元空间） | 快/低 |

一句话：**原生镜像把"编译"从运行期搬到了构建期**，用启动与内存换走了 JIT 的运行期自适应峰值。

## 三、封闭世界假设：一切限制的总根源

AOT 要在**构建期**就把所有可能执行的代码编译进去，因此 `native-image` 做一次 **可达性分析（points-to / static analysis）**：从一组 **root**（入口 `main`、被标注保留的类、JNI 入口等）出发，沿着"谁能调用谁、谁能引用谁"**静态地**推导出所有可达的类/方法/字段/资源，**可达的留下、不可达的直接丢弃（死代码消除）**——这正是镜像小、启动快的原因。

代价就是**封闭世界假设（closed-world assumption）**：**运行时不能出现构建期分析看不见的"新目标"**。而 Java 最擅长打破这个假设：

| 动态特性 | 为什么破坏封闭世界 | 后果 |
| --- | --- | --- |
| **反射** `Class.forName("X")` / `getDeclaredMethod` | 字符串/运行期才知道目标，静态分析看不到 | `ClassNotFoundException` / `NoSuchMethodException` |
| **动态代理**（JDK Proxy） | 代理类运行期才生成 | 缺 proxy 配置则生成失败 |
| **资源加载** `getResourceAsStream` | 资源默认不进镜像 | 读到 null |
| **序列化 / 注解处理 / 动态类加载** | 目标类未被保留 | 反序列化/扫描失败 |
| **JNI / 本地库** | 需显式登记 | 链接错误 |

## 四、可达性元数据：给分析器"补作业"

打破封闭世界的东西，得**在构建期用配置告诉分析器"这些必须保留/可达"**，这就是 **reachability metadata**（原生镜像的核心补救机制）：

| 配置文件 | 登记内容 |
| --- | --- |
| `reflect-config.json` | 反射要用的类/方法/字段/构造器 |
| `proxy-config.json` | 需要生成的动态代理接口 |
| `resource-config.json` | 要打进镜像的类路径资源（pattern） |
| `serialization-config.json` | 可序列化的类 |
| `native-image.properties` | 编译参数、依赖的上述配置聚合 |
| `jni-config.json` | JNI 访问的类/方法 |

手写易漏且难维护。**Spring 的解法**是在构建期跑 **Spring AOT 引擎**，扫描容器已知 Bean、`@Configuration`、序列化/反射用法，**自动生成**这些 metadata；开发者也可实现 **`RuntimeHints`**（`RuntimeHintsRegistrar`）手动补充第三方反射点。这正是 spring-boot s3-2 里 `process-aot`/`RuntimeHints` 存在的**根因**——不是 Boot 的语法糖，而是在给封闭世界"补可达性"。

```flow
动态用法(反射/代理/资源) ──破坏──▶ 封闭世界
        │
   补 reachability metadata（手写 或 Spring AOT 自动生成 或 RuntimeHints）
        ▼
构建期可达性分析据此"保留" → 运行期不再 ClassNotFound
```

## 五、收益与代价：一张决策表

- **收益**：冷启动从"秒级"降到"**毫秒级**"（典型几十~上百倍），常驻**内存显著下降**（常 3~10×），产物是**小镜像/单文件**、无 JIT 预热抖动、攻击面更小。
- **代价**：**构建慢**（分钟级、吃内存，Windows 需 VS Build Tools；CI 时长上升）、**峰值吞吐略低**、GC 与可观测工具（JFR/部分 profiler）受限、动态特性需持续维护 metadata、**与特定 GraalVM/JDK 版本强绑定**（升级要重验）。

| 场景 | 该上原生镜像？ |
| --- | --- |
| Serverless / 函数计算 / CLI / 需秒级弹性扩容 | ✅ 冷启动与内存是核心 KPI |
| 短生命周期、按量计费、密度敏感的容器 | ✅ 省内存省成本 |
| 长驻、高吞吐、JIT 预热后跑很久的核心服务 | ⚠️ 慎——可能丢峰值性能，收益不明显 |
| 重度反射/动态代理/字节码增强且无原生支持 | ❌ 维护成本高于收益 |

## 六、例子：封闭世界如何打断反射与如何用 metadata 修复（正确用法与错误用法）

```java
// 例子目的：演示字符串反射在原生镜像里因封闭世界假设而失灵，以及为何必须补可达性元数据
public class PluginLoader {
    public static void main(String[] args) throws Exception {
        // 错误用法（在原生镜像里）：目标类名来自字符串/配置，静态分析看不到 → 构建期被当不可达丢弃
        Class<?> c = Class.forName("com.acme.FastJsonParser"); // JVM 下正常；native-image 运行抛 ClassNotFoundException
        Object p = c.getDeclaredConstructor().newInstance();     // 未登记构造器 → 抛 NoSuchMethodException
        // 正确用法：若目标在编译期就确定（直接 new PluginLoader.class）→ 静态可达，无需任何配置
    }
}
```

```json
// 上面反射失灵，靠下面这份 reflect-config.json 给分析器"补作业"才能修复（手写 或 Spring AOT 自动生成）
// 例子目的：显式登记反射目标，让构建期可达性分析保留这些类/构造器/方法
[
  {
    "name": "com.acme.FastJsonParser",          // 与 Class.forName 的字符串一致（错误用法：name 写错包名 → 依旧 ClassNotFound）
    "methods": [
      { "name": "<init>", "parameterTypes": [] } // 保留无参构造器，newInstance 才拿得到
    ]
    // 正确使用结果：登记后 native-image 保留该类→运行期反射成功，不再报错
  }
]
```

> 同理：动态代理需 `proxy-config.json`、类路径资源需 `resource-config.json`；手写易漏，Spring 靠 `process-aot` 自动扫 Bean/`@Configuration` 生成这些元数据，第三方反射点再用 `RuntimeHintsRegistrar` 手动补（见 spring-boot s3-2）。

## 七、动手验证

1. 用 `native-image` 编译一个含 `Class.forName` 动态加载的 hello 程序，复现运行时 `ClassNotFoundException`；再加 `reflect-config.json` 修复——亲手体验封闭世界与 metadata。
2. 同一 Spring Boot 应用分别以 `java -jar` 与原生镜像启动，记录冷启动时间与 RSS，算加速比。
3. 触发一次 `process-aot`，在 `target/spring-aot` 下找到自动生成的 `reflect-config.json`，对上它解决了哪个反射点。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 本地 JVM 跑正常，原生镜像启动即 `ClassNotFoundException` | 反射/动态类加载目标未登记进 metadata |
| `@ConfigurationProperties`/JSON 序列化字段读不到 | 缺反射 hint，字段/构造器被当作不可达丢弃 |
| 某第三方库在镜像里 NPE / 找不到资源 | 该库无原生支持，需手写 `RuntimeHints` 补资源+反射 |
| 构建偶发 OOM / 极慢 | 可达性分析+AOT 编译吃内存 CPU，未调 `NativeImageHeapSize`/CI 资源 |
| 压测吞吐不如 JVM | AOT 缺运行期 profile 与 JIT 去优化，长驻高负载反不占优 |

## 九、关联技术栈

- **打包实践**：spring-boot s3-2（`native-maven-plugin`、`process-aot`、`RuntimeHints`、AOT 优化）
- **对照收益方向**：虚拟线程（spring-boot s3-1）优化并发吞吐，原生镜像优化启动/内存，是两条不同路线
- **底层**：Graal 编译器、Truffle 多语言、SubstrateVM、G1/Serial GC
- **生态**：Quarkus/Micronaut（把 AOT 做到框架内核，先天适配原生镜像）
