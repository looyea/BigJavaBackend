# synchronized 锁升级 · 面试追问

> "说说 synchronized 锁升级"是并发面试必考八股，但**高分与低分的分水岭在于：能否按 JDK 版本准确表述偏向锁、能否讲清 Mark Word/monitor、能否对比 ReentrantLock**。

## 题 1：synchronized 的锁升级过程？

**期望时长**：3 分钟

**答题要点**：

- 锁数据在对象头 Mark Word，每对象关联一个 monitor（owner/EntryList/WaitSet）。
- 无锁 →（偏向锁）→ 轻量级锁（CAS + 栈上 Lock Record，自旋不阻塞）→ 重量级锁（竞争激烈膨胀，指向 monitor，未获锁线程阻塞，靠 OS mutex）。
- 一般只升不降。

**追问链**：偏向锁现在还在吗？→ **JDK 15 起默认关闭并废弃（JEP 374）、后续移除**——因线程池复用使收益低、safepoint 撤销贵；答题要按版本说，别背旧八股。

## 题 2：轻量级锁和重量级锁的本质区别？

**答题要点**：

- 轻量级：CAS 竞争 + 自适应自旋，线程**不让出 CPU**（忙等），适合短暂交错竞争。
- 重量级：依赖 OS mutex，抢不到锁的线程**挂起阻塞**，唤醒涉及用户态/内核态切换，开销大但吞吐竞争不划算时更省 CPU 空转。

**追问链**：什么时候从轻量升到重量？→ CAS 自旋多次仍失败、竞争加剧，膨胀为重量级。

## 题 3：synchronized 和 ReentrantLock 怎么选？

**答题要点**：

- 相同：都可重入、都保证互斥。
- synchronized：内置、自动释放、异常安全、语法兜底，无/轻竞争已被优化得很快。
- ReentrantLock：显式，提供 **tryLock 超时、lockInterruptibly 可中断、公平锁、多个 Condition**，灵活性换"必须 finally unlock"。
- 选：简单互斥优先 synchronized；需超时/中断/公平/多条件才上 ReentrantLock。

**追问链**：虚拟线程下 synchronized 有问题吗？→ 曾在 synchronized 内阻塞会钉住载体线程，**JDK 24 已基本解决**，不必一律改写。

## 题 4：什么是死锁？synchronized 会不会更容易？

**答题要点**：四个必要条件（互斥、持有并等待、不可剥夺、循环等待）。synchronized 因**不可中断、无超时**，一旦死锁线程只能永久等待；ReentrantLock 可用 `tryLock(超时)`/`lockInterruptibly` 打破"不可剥夺/循环等待"来预防。

**追问链**：怎么排查？→ `jstack`/jcmd 线程转储会直接打印 "Found one Java-level deadlock"；预防靠固定加锁顺序、超时、缩小锁范围。

## 题 5：monitorenter/monitorexit 在字节码层面怎么工作？

**答题要点**：同步块编译成 `monitorenter` + `monitorexit`（正常 + 异常两条），引用 monitor；可重入靠 monitor 的计数器（同一线程进入 ++、退出 --，归零才释放）。方法级 `synchronized` 用 `ACC_SYNCHRONIZED` 标志由 JVM 隐式处理。

**追问链**：为什么不会忘记释放？→ 异常表保证 monitorexit 在异常路径也执行（对比手动 lock 忘 unlock）。

## 高频速答

- 锁记在哪？→ 对象头 Mark Word + monitor。
- 升级方向？→ 无锁→(偏向)→轻量→重量，只升不轻易降。
- 偏向锁现状？→ JDK 15 默认废弃/移除。
- 三优化？→ 自适应自旋、锁消除（逃逸分析）、锁粗化。
- 何时必须 ReentrantLock？→ 需要超时/可中断/公平/多条件。
