# JMM、happens-before 与三大特性 · 作业

> 不判分，对照参考要点自查。

## 作业 1：可见性复现与修复（必做）

写一个 `volatile boolean stop` 开关：主线程循环，工作线程 `while(!stop)`。先不加 volatile，观察（部分平台/JIT 下）工作线程可能不退出；加 volatile 修复。用 happens-before 解释差异。

**参考要点**：无 volatile → 读写无 hb（数据竞争），读可能用寄存器/缓存旧值；volatile 建立"写 hb 后续读"，强制可见与禁重排。

## 作业 2：原子性三连修（必做）

20 线程各对同一 `int` 自增 1 万次，先裸 `i++`（结果 <20 万），再分别用 ① `synchronized` 方法、② `AtomicInteger.incrementAndGet`、③ `LongAdder` 修复，记录三者正确性与耗时差异。

**参考要点**：`i++` 非原子丢更新；三种都能保证原子；LongAdder 高竞争下用分段（base+Cell[]）减少 CAS 失败，吞吐更高（见 s1-2）。

## 作业 3：DCL 单例（必做）

写出正确（instance 加 volatile）与错误（不加）的 DCL 单例。用文字说明：为什么"第一次判 null 在锁外、第二次判 null 在锁内"两者都需要？volatile 具体禁止了 `new` 的哪一步重排？

**参考要点**：锁外判避免每次进锁（性能）、锁内判保证只创建一次（并发正确性）；volatile 禁"初始化"与"赋引用"重排，保证别的线程看到非 null 时对象已构造完成。

## 作业 4：hb 链判断练习（必做）

给定若干"两线程对共享变量的操作序列"，逐一判断是否存在 happens-before 关系、是否构成数据竞争（如：A 写普通 x、B 读普通 x；A 写 volatile x、B 读 volatile x；A 释放锁、B 获取同一锁后读）。写出结论与依据的规则名。

**参考要点**：普通变量无 hb=数据竞争；volatile 写→读、unlock→lock 建立 hb；再叠加传递性判断复合场景。

## 作业 5：安全发布专题（选做）

构造一个"未安全发布"的对象（构造函数里把 `this` 存入静态集合），说明 `final` 字段可见性保证为何失效，并给出正确做法（构造完成后再发布引用）。

**参考要点**：this 逃逸使对象在他线程可见时构造未完成，破坏 final/不可变的安全发布 hb；应先构造完整、再通过 volatile/锁/并发容器安全发布。
