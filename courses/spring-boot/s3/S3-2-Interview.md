# 实际面试题 · GraalVM 原生镜像打包（Boot 工程实践视角）

## 题 1：Spring Boot 打原生镜像的原理是什么？和平时 `java -jar` 有何本质不同？

**考察层次**：初级只知"更快更小"；中级能讲 AOT + hints；高级能讲收益边界与技术选型。

**参考答法**：

1. `java -jar` 走 JVM：加载类、跑自动配置、JIT 运行期编译预热。
2. 原生镜像用 GraalVM AOT 在**构建期**做 closed-world 可达性分析，把可达代码编成平台可执行文件；Spring 的 AOT 引擎先把运行期动态的 IoC/条件装配固化成生成代码 + `RuntimeHints`。
3. 结果：启动毫秒级、内存低，但缺 JIT 自适应，峰值吞吐常不如预热后的 JVM，构建慢、动态特性需登记。

**追问**：为什么需要 Spring 专门做 AOT 而不是直接 native-image？→ 因为 Spring 大量运行期反射/代理/条件装配，closed-world 下编译器看不到，需框架提前"演算"并产出元数据。

## 题 2：原生镜像跑起来报 ClassNotFoundException / 资源读不到，怎么排查？

**结构化回答**：

1. 定性：几乎都是 closed-world 下"运行期才确定的东西"没被登记——反射类、动态代理、资源、序列化类型、SPI。
2. 定位：看栈里被反射的目标；用 `-Dspring.aot.enabled=true` 在普通 JVM 上提前复现。
3. 修复：写 `RuntimeHintsRegistrar`（reflection/resource 提示）或 `@RegisterReflectionForBinding`；优先升级到已自带 hints 的依赖版本。
4. 预防：面向接口、少用 final、少用运行期字符串拼类名；把 hints 纳入组件交付物。

## 题 3：公司核心交易系统要不要全量迁移到原生镜像？

**答题要点（考的是判断力而非技术点）**：

- 核心交易通常长运行、重峰值吞吐、依赖复杂（连接池、RPC、大量反射框架）——原生镜像的吞吐回退与 hints 补齐成本可能盖过收益。
- 更适合的是：Serverless/边缘/CLI/短生命周期高弹性 Pod/内存受限高密度场景。
- 结论：不必非此即彼；可对"冷启动敏感的网关/边缘组件"局部上原生，核心长运行服务评估 CRaC / 分层预热折中。给出度量与灰度方案比给"上/不上"更重要。

## 题 4：原生镜像构建很慢，CI 里怎么治理？

**答题要点**：可达性分析 + 编译本就重（数分钟到十几分钟）。治理：用 native build cache、`spring-boot:build-image` 复用 builder 层、独立高配构建节点、把原生构建与常规测试并行分阶段、只对需要交付原生产物的分支触发、用 `-Ob`（快速构建模式，牺牲部分优化）用于开发验证。

## 高频追问速答

1. 原生镜像就没有 JIT 了吗？→ 没有运行期方法级 JIT 预热，是 AOT 产物；这也是吞吐特征差异的根源。
2. `RuntimeHints` 和老的手写 `reflect-config.json` 什么关系？→ 前者是 Spring 提供的编程式统一入口，最终产出 native-image 认识的 reachability metadata（含 json 等）。
3. 原生镜像能调试吗？→ 可以，但符号/工具链不如 JVM 丰富；通常先在 JVM(AOT enabled) 模式定位逻辑问题。
4. 内存一定更省吗？→ 常驻通常更低，但堆策略不同，极端对象分配场景需实测，不能想当然。
5. 和 Spring 官方"Native 支持成熟度"有关吗？→ 有，官方 starter 基本开箱可用，第三方库支持度决定迁移成本，选型前查支持矩阵。
