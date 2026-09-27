# volatile 与原子类 · 小测

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. 关于 volatile，下列说法正确的是？（15分）

- A. volatile 能保证 `i++` 这样的复合操作原子
- B. volatile 保证可见性与禁止重排序，但不保证复合操作原子性
- C. volatile 等同于一把轻量锁
- D. volatile 会让读写完全串行化

> 答案：B
> 解析：volatile 只保证单次读/写的可见性与有序（hb 写→读），`i++` 读-改-写仍会丢更新，需 CAS 或锁。

### 2. CAS 的"ABA 问题"指的是？（15分）

- A. 线程 A、B 同时 CAS 都成功
- B. 值从 A 改成 B 又改回 A，CAS 误判"没被人动过"而成功
- C. CAS 指令执行太慢
- D. 多个变量名冲突

> 答案：B
> 解析：CAS 只比当前值==期望值，A→B→A 转一圈回来会骗过它；在无锁栈/链表/对象池等场景可能导致逻辑错误。

### 3. 【多选】关于原子类与 LongAdder，正确的有哪些？（20分）

- A. AtomicInteger 高并发下因单点 CAS 反复失败自旋，可能成为瓶颈
- B. LongAdder 用 base + Cell[] 分段，把冲突摊开以提高吞吐
- C. LongAdder.sum() 提供的是瞬时强一致的精确值
- D. 需要"读出旧值判断后再条件更新"（如扣库存）的场景更适合 AtomicLong 而非 LongAdder

> 答案：ABD
> 解析：C 错——LongAdder 的 sum() 是最终一致快照，求和期间值仍可能变。A/B/D 正确。

### 4. 判断：解决 ABA 可用 AtomicStampedReference，把"值 + 版本号"作为二元组一起 CAS。（10分）

- A. 正确
- B. 错误

> 答案：A
> 解析：即使值转回 A，版本号已递增，(值,版本) 对不上则 CAS 失败，从而识别出"中间被改过"。

### 5. 填空题：JDK 9 起原子类底层从 `sun.misc.Unsafe` 逐步迁移到 ______；CAS 对应的 x86 原子指令是带 ______ 前缀的 cmpxchg。（10分）

> 答案：VarHandle / lock

### 6. volatile 和 AtomicInteger 分别解决什么问题？为什么 `volatile int` 上加一仍会错、而 AtomicInteger.incrementAndGet 不会？（30分）

> 参考答案：
> - volatile 解决可见性 + 有序性（禁重排），适合状态标志、安全发布、DCL；不解决复合原子性
> - AtomicInteger 用 CAS 把"读-改-写"做成原子，适合计数、序号、单变量原子更新
> - `volatile n++` 错在它是三步、volatile 只保证每步各自可见，线程切换可穿插导致丢更新
> - incrementAndGet 用"getRaw→计算→compareAndSet 失败重试"循环，保证自增整体原子
> - 选型：只读多写少、写不依赖旧值用 volatile；要基于旧值原子修改用原子类；超高竞争纯计数用 LongAdder
