# Java 22-25：Loom/Panama 收口 · 小测

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. 关于 FFM API（Foreign Function & Memory API），正确的是？（15分）

- A. 它是 JNI 的另一个名字，功能相同
- B. 它在 Java 22 转正，统一取代 JNI 与 Unsafe/DirectByteBuffer，安全地调本地函数并管堆外内存
- C. 它只能调用 C 函数，不能管理内存
- D. 它是虚拟线程的一部分

> 答案：B
> 解析：FFM（Project Panama）JDK 22 转正，用 `Linker/MemorySegment/Arena` 同时解决"外部函数调用 + 堆外内存管理"，比 JNI/Unsafe 更安全受控。

### 2. 直到教材编写时，下列哪一项仍**处于预览/未最终转正**、不建议写进核心生产链路？（15分）

- A. FFM API
- B. 虚拟线程（Virtual Threads）
- C. 结构化并发 StructuredTaskScope
- D. record

> 答案：C
> 解析：虚拟线程(21)、FFM(22)、record(16) 均已转正；结构化并发经多轮预览仍在收敛，语义可能变，别锁进核心链路。

### 3. 【多选】关于 22-25 演进与 Java 预览机制，说法正确的有哪些？（20分）

- A. `synchronized` 内阻塞钉住载体线程的问题在 JDK 24 得到大幅修复
- B. Scoped Values 旨在为虚拟线程场景提供更轻量的上下文传递，替代易膨胀的 ThreadLocal
- C. String Templates 因设计争议在两度预览后被官方撤回重做，体现"宁缺毋滥"
- D. 开启 `--enable-preview` 编译的 class 可被任意更高版本 JVM 无条件运行

> 答案：ABC
> 解析：D 错——预览 class 文件绑定其 JDK 大版本，更高版本 JVM 默认拒绝运行同版本预览字节码，需对应 `--enable-preview`。A/B/C 正确。

### 4. 判断：Project Valhalla 的"值类/值对象"追求无身份（identity-free）、去掉对象头与引用间接层，让 `Optional`/`java.time` 等小对象更省内存更快。（10分）

- A. 正确
- B. 错误

> 答案：A
> 解析：这正是 Valhalla 的目标（JDK 24 首次预览值类），但仍是预览、依赖 CCS/紧凑对象头协同，尚未面向生产。

### 5. 填空题：FFM API 中用于**约束堆外内存生命周期、出了作用域自动释放**的抽象叫 ______；Project Loom 对应本节标题里"改写并发成本"的主角特性是 ______。（10分）

> 答案：Arena（作用域） / 虚拟线程（Virtual Threads）

### 6. 概括 Java 22-25 这条"收口"主线上三大 Project（Loom/Panama/Valhalla）各自的落地状态，并给出你对"是否在生产使用预览特性"的建议。（30分）

> 参考答案：
> - Panama：FFM API 已在 22 转正，是本轮唯一该立刻关注的生产力（多经 Netty/Lucene 等库间接受益）
> - Loom：虚拟线程 21 已转正；结构化并发、Scoped Values 多轮预览走向定型；synchronized 钉住 24 大幅修复
> - Valhalla：原始类型模式、生成式元编程、值类均处预览，看懂方向即可，未面向生产
> - 预览建议：预览特性不进核心链路（语义随版本变、class 绑大版本）；按 LTS 节奏（21→25）规划升级，别为非 LTS 单版本特性打乱长期支持
> - 取向呼应：String Templates 被撤回体现 Java 克制、宁缺毋滥，不固化争议 API
