# Java 22-25：Loom/Panama 收口 · 面试追问

> 面试官问 22-25 通常不是考你背 JEP，而是看你是否**持续跟进 + 有生产判断力**（哪些能用、哪些是预览、别乱上）。答好要突出"FFM 已可用、其余在收敛、Valhalla 看方向"。

## 题 1：FFM API 是什么？为什么要替代 JNI？

**期望时长**：2 分钟

**答题要点**：

- FFM（Project Panama，JDK 22 转正）= Foreign Function & Memory API，一套 API 同时做"调本地函数 + 管堆外内存"。
- 取代 JNI（样板重、易崩 JVM、无沙箱）与 `Unsafe`/DirectByteBuffer（危险、非公开）。
- 核心：`Linker`（绑函数）、`MemorySegment`（内存）、`Arena`（作用域自动释放）。

**追问链**：业务开发要直接写吗？→ 多数不直接写，但 Netty/Lucene/序列化等库在把它作为底层，你间接受益于更稳更快的 native 交互与堆外管理。

## 题 2：虚拟线程发布后，22-25 还在补什么？

**答题要点**：

- `synchronized` 钉住 → JDK 24 大幅修复，日常不必再为它改 ReentrantLock。
- 结构化并发 `StructuredTaskScope` → 多轮预览走向定型（未最终转正）。
- Scoped Values / 约束作用域 → 替代 ThreadLocal 的轻量上下文，适配虚拟线程海量并发。

**追问链**：这些能上生产吗？→ 转正项（虚拟线程/FFM/解钉）可依赖；预览项不进核心链路，锁版本、`--enable-preview` 有 class 绑定风险。

## 题 3：Java 的预览（Preview）机制是干什么的？有什么坑？

**答题要点**：

- 目的：在不破坏长期兼容的前提下先发布、收集反馈、多轮迭代再转正。
- 坑：预览语义可能随版本变；预览 class **绑定其 JDK 大版本**，跨版本运行需同版本 `--enable-preview`，否则被拒。
- 纪律：预览特性别写进核心/长期维护代码。

**追问链**：有没有预览后被撤的？→ 有，String Templates 两度预览被撤回重做——体现 Java"宁缺毋滥、不固化争议 API"。

## 题 4：Project Valhalla 想解决什么？现在到哪了？

**答题要点**：

- 目标：值类/原始类型——无身份、去对象头与引用间接层，让 `int`、`Optional`、`java.time` 这类小对象既有一致语义又有接近基本类型的内存/速度。
- 现状：原始类型模式、生成式元编程、值类均处**预览/铺垫阶段**（JDK 24 首次值类预览），依赖 CCS/紧凑对象头，尚未面向业务。

**追问链**：现在能做啥？→ 用 record 拿不可变与语义收益（仍有对象头）、按 Valhalla 方向设计小而不可变的值对象，转正即平滑受益；但别为未落地特性过度设计。

## 高频速答

- FFM 转正版本？→ JDK 22。
- Arena 三种？→ `ofConfined`（单线程）/`ofShared`/`ofGlobal`，优先 confined。
- synchronized 解钉版本？→ JDK 24。
- 结构化并发转正没？→ 截至编写时仍预览。
- 生成式元编程关键词？→ Code Snippets / `CodeModel`，运行时传代码片段、编译期生成。
