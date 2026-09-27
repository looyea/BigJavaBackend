# volatile 与原子类 · 作业

> 不判分，对照参考要点自查。

## 作业 1：volatile 边界实验（必做）

分别用 `volatile int n` 和 `AtomicInteger` 做 20 线程各 +1 万，记录结果。volatile 版丢更新、原子类版正确。写结论说明"volatile 不保证复合原子"。

**参考要点**：volatile 只让单步可见/有序；`n++` 三步仍穿插；AtomicInteger 用 CAS 循环保原子。

## 作业 2：安全发布（必做）

写"线程1 `data=compute(); ready=true;`（ready 为 volatile），线程2 `if(ready) use(data)`"。用 happens-before 解释为什么 data 一定完整可见；若把 ready 的 volatile 去掉会怎样。

**参考要点**：volatile 写前的普通写不能重排到其后，形成 hb；去 volatile 则可能读到 ready=true 但 data 未可见（重排/不可见）。

## 作业 3：ABA 复现与修复（必做）

用 `AtomicReference<String>` 模拟无锁栈 pop 或余额：线程 A 读到 head=X、线程 B pop 后又 push 回同样的 X 对象，A 的 CAS 会误成功。改用 `AtomicStampedReference`（带 stamp）修复并解释。

**参考要点**：CAS 只比引用/值，转回即被骗；StampedReference 比较 (值,版本)，版本递增使旧期望失效。

## 作业 4：LongAdder vs AtomicLong（必做）

高并发（64 线程各累加 100 万）分别用 `AtomicLong` 与 `LongAdder` 计时，对比耗时/正确性；再说明 LongAdder 的 `sum()` 为什么不能保证瞬时精确、什么业务必须回退 AtomicLong。

**参考要点**：LongAdder 分段(base+Cell[])减少 CAS 冲突更快；sum 是尽力快照；需"读旧值判断再条件更新"（扣减）用 AtomicLong。

## 作业 5：Atomic* 家族选型（选做）

给以下场景各选一个最合适工具并说明理由：① 全局唯一 ID 递增；② QPS 统计计数；③ 原子替换一个配置对象引用；④ 对某对象里的 `int` 字段做原子更新（字段在 final/无法改类）。（提示：AtomicLong / LongAdder / AtomicReference / AtomicIntegerFieldUpdater）

**参考要点**：①AtomicLong（需精确单调/条件更新）；②LongAdder（高竞争纯计数）；③AtomicReference（整体换引用）；④AtomicIntegerFieldUpdater（不侵入类、对已有 int 字段做 CAS）。
