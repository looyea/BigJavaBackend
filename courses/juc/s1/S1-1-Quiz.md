# JMM、happens-before 与三大特性 · 小测

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. 线程 A 写了共享标志位，线程 B 在 `while(!flag)` 忙等却可能永不退出，最主要原因是？（15分）

- A. B 线程优先级太低
- B. 缺少可见性保证——A 的写未通过 happens-before 对 B 可见
- C. CPU 主频不够
- D. flag 是 boolean 类型

> 答案：B
> 解析：无 volatile/锁时两线程对 flag 的读写没有 hb 关系（数据竞争），B 可能一直读到缓存的旧值；volatile 建立写→读的 hb，保证可见。

### 2. 双重检查锁定（DCL）单例中 `instance` 必须加 volatile，是为了防止？（15分）

- A. 内存泄漏
- B. `new` 的"分配/初始化/赋引用"被重排序导致读到半成品对象
- C. 序列化失败
- D. 反射攻击

> 答案：B
> 解析：不加 volatile，步骤 2(初始化)与 3(赋引用)可能重排，另一线程判非 null 就直接用未初始化对象；volatile 屏障禁止该重排并保证可见。

### 3. 【多选】下列属于 happens-before 规则的有哪些？（20分）

- A. 同一线程内程序顺序上的先后
- B. 对同一把锁：unlock happens-before 后续 lock
- C. 对同一 volatile 变量：写 happens-before 后续读
- D. 任意两个不同变量、无任何关系的读写也自动 happens-before

> 答案：ABC
> 解析：D 错——无 hb 关系的并发读写正是数据竞争。A/B/C 三项（程序顺序、锁、volatile 规则），加上 start/join 与传递性构成核心 hb 规则。

### 4. 判断：`i++` 在多线程下丢更新，是一个"可见性"问题。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：`i++` = 读-改-写三步，丢更新是**原子性**问题（被线程切换穿插），对策是 synchronized/原子类 CAS，而非单靠 volatile。

### 5. 填空题：JMM 中判断并发正确性的高层判据叫 ______；底层实现可见性/有序性所插入的指令叫内存 ______。（10分）

> 答案：happens-before / 屏障（Barrier/Fence）

### 6. 分别解释原子性、可见性、有序性，各给一个会被破坏的典型场景与对应解决手段。（30分）

> 参考答案：
> - 原子性：复合操作不可分割。场景 `i++` 丢更新；手段 synchronized、Lock、Atomic* CAS
> - 可见性：一改即为他线程所见的延迟。场景 忙等 flag 不退出；手段 volatile、synchronized、并发容器、final 安全发布
> - 有序性：实际/观察顺序符合语义。场景 DCL 半成品对象；手段 volatile/happens-before 屏障、锁禁止相关重排
> - 统一视角：三者都可用"操作间是否构成 happens-before"来判定与治理；无 hb 即数据竞争
> - 落地：先判断 hb 链是否闭合再决定同步范围，避免过度加锁或漏加锁
