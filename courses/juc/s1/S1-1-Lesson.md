# JMM、happens-before 与三大特性

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：建立并发正确性的**根模型**——Java 内存模型（JMM）为什么存在，它如何用"工作内存/主内存 + happens-before"定义"一个线程的写何时对另一个线程可见、有序"；彻底分清**可见性 / 原子性 / 有序性**三大特性各自的破坏者对策；理解**指令重排**的三个层次（编译器/CPU/JMM）与内存屏障的大致作用。后续 volatile、synchronized、AQS 全是这套模型的具体兑现。

## 一、为什么需要 JMM：并发 bug 的根源不在"代码顺序"（★★★★★）

单线程里，你写的代码顺序≈执行顺序。但多线程 + 现代硬件（多级缓存、写缓冲、乱序执行、编译器优化）让"**程序源代码顺序**"和"**实际发生顺序**"以及"**别的线程观察到的顺序**"三者可能都不一致。

```flow
Thread-A                         主内存(共享变量)                Thread-B
int a=1; int r;                  (各CPU有缓存/写缓冲)          int b=2; int r2
```

经典问题：**双重检查锁定（DCL）单例**若 `instance` 不加 volatile，可能读到"引用非 null 但对象构造未完成"的半成品——因为 `new` 分三步（分配内存→初始化→把引用赋给变量），**步骤 2、3 可能被重排**。JMM 就是规定"哪些重排合法、要靠什么手段禁止"的契约。

## 二、三大特性与各自的"敌人"（★★★★★）

| 特性 | 含义 | 被什么破坏 | 主要对策 |
| --- | --- | --- | --- |
| **原子性** | 一组操作要么全成要么全不成，中间不被打断 | 复合操作（`i++`=读+改+写）被线程切换穿插 | `synchronized`、Lock、原子类 CAS |
| **可见性** | 一个线程改了共享变量，别的线程能立刻看到 | CPU 缓存/写缓冲让改动滞留在本核 | `volatile`、`synchronized`、final、并发容器 |
| **有序性** | 发生顺序符合代码语义 | 编译器/CPU 重排序 | `volatile`/happens-before 屏障、锁 |

`i++` 丢更新是**原子性**问题；改了 flag 别的线程进不去 `while(!flag)` 是**可见性**问题；DCL 半成品是**有序性**问题。三者要分别对症，别指望一个手段全包。

## 三、happens-before：并发正确性的"因果律"（★★★★★）

直接背"禁止某重排"太碎。JMM 给出高层判据 **happens-before**：若操作 A happens-before B，则 A 的结果**对 B 可见**，且 A 排在 B 前。它是"可见性 + 有序性"的统一表述。核心规则：

- **程序顺序规则**：同一线程内，前面的操作 hb 后面的。
- **监视器锁规则**：一次 `unlock` hb 随后对同一把锁的 `lock`（锁的释放对后获得者可观察）。
- **volatile 规则**：对某 volatile 变量的写 hb 随后的读。
- **线程启动/终止**：`Thread.start()` hb 该线程所有动作；线程所有动作 hb 别的线程从它的 `join()` 返回（或 `isAlive()` 返回 false）。
- **传递性**：A hb B、B hb C ⇒ A hb C。

> **怎么用**：判断"要不要同步"=看两个操作之间有没有 happens-before 关系。**没有 hb 关系的并发读写，就是数据竞争（data race），行为未定义**。这把"到处加锁 or 到处不加锁"的纠结，变成"确认 hb 链是否闭合"的工程问题。

## 四、内存屏障：happens-before 的实现手段（★★★☆☆）

happens-before 是语义承诺，底层靠**内存屏障（Memory Barrier/Fence）**落地——它是告诉 CPU/编译器"在此处停下，之前的写必须刷出、之后的读不得提前"的指令。`volatile` 写前后、锁的获取/释放处会插入对应屏障（StoreStore/StoreLoad/LoadLoad/LoadStore 组合）。**业务开发不需要手写屏障**，理解"volatile/锁的可见性与有序性保证，物理上就是靠这些屏障 + 缓存一致性协议（MESI）"即可——屏障/缓存行细节在 s3-2 与 jvm 分区展开。

## 五、例子：三大特性被破坏的可运行演示（正确用法与错误用法）

```java
// 例子目的：一个可运行程序同时暴露"可见性缺失"与"原子性缺失"两大并发 bug，并给出修复
import java.util.concurrent.atomic.AtomicInteger;
class JmmDemo {
    static boolean ready = false;        // 错误用法：不加 volatile
    static volatile boolean readyOk = false; // 正确用法：volatile 保证可见
    static int hit = 0;                   // 普通计数：会被丢更新
    static final AtomicInteger hitOk = new AtomicInteger(); // 原子计数

    public static void main(String[] args) throws Exception {
        // 【可见性】主线程置标志，工作线程忙等退出
        Thread t = new Thread(() -> { while (!ready) { /* 空转 */ } }); // 错误用法：无 volatile → 可能永远读不到 ready=true，死循环（无 hb）
        t.start();
        Thread.sleep(100);
        ready = true;                      // 不保证对 t 可见（本例仅演示风险；实际多会被 JIT 提升为 while(true)）
        // 正确用法：把上行改为 readyOk=true、循环判 while(!readyOk)，主线程的写一定对 t 可见，t 正常退出

        // 【原子性】20 线程各自自增 1 万次
        Thread[] workers = new Thread[20];
        for (int i = 0; i < 20; i++) {
            workers[i] = new Thread(() -> {
                for (int j = 0; j < 10000; j++) { hit++; hitOk.incrementAndGet(); } // hit++ 非原子；CAS 原子
            });
            workers[i].start();
        }
        for (Thread w : workers) w.join();  // join 保证前面的写对本线程可见
        System.out.println("hit=" + hit + " hitOk=" + hitOk); // 正确使用结果：hitOk 恒为 200000；hit 几乎总是 < 200000（丢更新）
    }
}
// 错误用法总结：hit 偏小=原子性被破坏；忙等不退出=可见性被破坏；两者都源于"无 happens-before 关系的数据竞争"
// 正确对策：单变量计数用 AtomicInteger/LongAdder，标志位用 volatile，复合动作用 synchronized/Lock
```

## 六、动手题

1. 写一个不加 volatile 的"线程 A 置 `ready=true`、线程 B `while(!ready)` 忙等"程序，观察 B 可能永远出不来（可见性），加上 volatile 修复。
2. 复现 `i++` 丢更新：20 线程各自增 1 万，结果 < 20 万；分别用 `synchronized`、`AtomicInteger` 修复并对比。
3. 用 DCL 单例（instance 不加 volatile）+ 反编译或压力测试讨论"半成品对象"风险，再加 volatile 说明其禁止了哪一步的重排。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 忙等标志位线程永不退出 | 无 volatile → 可见性缺失（无 hb） |
| 计数器/库存数值偏小 | `i++` 非原子，丢更新 |
| DCL 单例偶发拿到未初始化对象 | new 的步骤被重排，缺 volatile 屏障 |
| `final` 字段被别的线程读到默认值 | 构造未安全发布（this 逃逸），破坏 final 语义 hb |
| 加了一堆锁仍偶发错乱 | 复合动作跨多把锁不原子，或漏了某处同步（hb 未闭合） |

## 八、关联技术栈

- **向后（本包兑现）**：volatile 指令级保证 ↔ 下一节 s1-2；synchronized/monitor ↔ s1-3；AQS 如何用 state+屏障实现 hb ↔ s2-1；伪共享/缓存行(MESI) ↔ s3-2
- **横向**：安全发布（this 逃逸、final 语义）↔ java-basics s1-1 构造器/不可变
- **底层**：JIT 重排、内存屏障与 CPU 缓存一致性 ↔ jvm 分区；并发正确性形式化视角 ↔ 其他补充

## 九、本节小结

并发一切问题的根，都在"**代码顺序 ≠ 实际顺序 ≠ 他线程观察顺序**"。JMM 用 **三大特性（原子/可见/有序）+ happens-before 因果律**给了统一答案：**判断两个操作有无 hb 关系，就是判断要不要同步；volatile/锁/并发容器是兑现 hb 的具体手段。** 记住这句，后面每个同步原语都是它的注脚。

下一节 volatile 与原子类——最小、最高频的可见性/原子性工具。
