# Java 22-25：Loom/Panama 收口 · 作业

> 不判分，对照参考要点自查。

## 作业 1：FFM 最小调用（必做）

用 JDK 22+ 的 FFM API 写一个 demo：加载 libc，调用 `strlen` 传入一个 Java 字符串并拿到长度，全程用 `Arena.ofConfined()` 分配/释放堆外内存。记录相比 JNI（写 .h、编 .so、`System.loadLibrary`）省了多少样板。

**参考要点**：`Linker.nativeLinker()`、`SymbolLookup`、`FunctionDescriptor.of(JAVA_LONG, ADDRESS)`、`downcallHandle(...).invokeExact(seg)`；`Arena` 出作用域自动 free，无 native 崩溃风险。

## 作业 2：Arena 作用域与泄漏防护（必做）

把作业 1 里的 `Arena.ofConfined()` 换成手动 `Arena.ofGlobal()` 且不 close，反复调用制造堆外内存增长，用 `MemorySegment.allocateGlobalNative` 观察；再改回 confined/try-with-resources 验证内存可控。写一句话说明"为什么优先 Arena 而非 Global"。

**参考要点**：Global/未约束的段不会自动释放 → 堆外泄漏；confined/shared 作用域随关闭释放；生命周期绑定作用域是 FFM 安全性的核心。

## 作业 3：ThreadLocal → ScopedValue 迁移（选做，预览）

在一个（虚拟线程）服务里，用一个请求级只读上下文（如 traceId）：先写 ThreadLocal 版，再用 `ScopedValue.where(TRACE, id).run(...)` 版（需 `--enable-preview`），对比代码与"子任务继承/不可变"语义差异。

**参考要点**：ScopedValue 不可变、绑定作用域、天然适配结构化并发；虚拟线程海量下比 ThreadLocal 更省、更易推理；注意仍是预览 API。

## 作业 4：预览特性风险清单（必做）

列出你计划在项目里可能遇到的 22-25 预览/新特性（结构化并发、Scoped Values、值类、原始类型模式、生成式元编程），对每一项标注"是否转正、是否可进生产、锁版本要求"。产出一页团队升级备忘。

**参考要点**：仅 FFM/虚拟线程(21)/synchronized解钉(24) 等转正项可依赖；预览项加"不进核心链路 + `--enable-preview` + class 绑大版本"三条约束；按 LTS（21→25）而非追非 LTS 版本。

## 作业 5：值类受益评估（选做）

挑一个你系统里高频创建的小对象（如自定义 `Money`/`Coordinate` record），用 JOL 或压测估算其对象头/引用开销，说明"若 Valhalla 值类转正，它可能省下什么、你现在的替代（record/基本类型拆分）能做到什么程度"。

**参考要点**：值类去身份+紧凑布局 → 小对象内存与比较开销下降；当前用 record 已获不可变与语义收益但仍有对象头；理解方向、别为未落地特性过度设计。
