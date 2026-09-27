# 作业题 · 原生镜像原理与限制

## 作业 1：亲手踩封闭世界（必做，本节核心）

写一个最小 Java 程序，通过 `Class.forName(args[0])` 反射加载类并调用其方法：

1. `java` 直接运行正常，`native-image` 编译后运行抛 `ClassNotFoundException`
2. 补一份 `reflect-config.json` 登记目标类，重新编译验证修复
3. 把这条"报错→定位缺失 hint→补 metadata→通过"的过程写成排查笔记
- **产出**：demo + metadata 文件 + 笔记，说明为何 JVM 模式没问题

## 作业 2：启动与内存收益量化（必做）

选一个 Spring Boot 小应用（或自建）：

1. 记录 `java -jar` 的冷启动时间、稳态 RSS
2. 用 native profile 构建原生镜像，记录同样两项
3. 算**启动加速比**与**内存下降倍数**，并结合"该应用是长驻还是短生命周期"判断值不值
- **验收标准**：一张 JVM vs Native 的启动/RSS/构建耗时对照表 + 结论

## 作业 3：诊断一个缺失的 RuntimeHint（必做）

引入一个含反射/资源加载的第三方库（如某序列化/规则引擎库），在原生镜像下复现它运行期报错（找不到资源/类）：

1. 用 `-H:+PrintAnalysisCallTree` 或报错栈定位是反射还是资源
2. 写一个 `RuntimeHintsRegistrar` 补上对应 hint（`ReflectionHints`/`ResourceHints`）
3. 说明它最终会转成哪种 `*-config.json`
- **产出**：Registrar 代码 + 对应生成的 metadata 片段

## 作业 4：AOT vs JIT vs 虚拟线程 路线选择（选做，架构师向）

同为"提升性能"，原生镜像（启动/内存）、虚拟线程（并发吞吐）、传统 JIT（峰值）方向不同。给出一个电商网关 / 一个电力实时采集 / 一个批处理任务的组合建议：哪些上原生、哪些保留 JIT + 虚拟线程，写一页决策依据。

## 作业 5：构建与升级治理（选做）

针对"原生镜像构建慢、和 GraalVM 版本强绑定"的痛点，设计 CI 策略：分层缓存依赖与对象文件、构建资源与 `NativeImageHeapSize` 调优、每次升级 GraalVM/Spring 时的回归清单（反射点、GC 行为、吞吐基准、镜像体积），产出一份可执行的 checklist。
