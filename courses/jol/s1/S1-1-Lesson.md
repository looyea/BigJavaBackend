# 对象头、对齐与伪共享

> 本节难度：★★★★☆
> 本节重要性：★★★☆☆
> 学习产出：能用 JOL 读出对象真实内存布局（对象头/字段重排/填充/总字节），算清压缩指针开关对全堆水位的影响；理解伪共享的缓存行机理，能用 @Contended 给热点字段隔离并量化收益、说清它不该用的场合。

## 一、对象到底占多少字节：JOL 一锤定音

64 位 HotSpot 的普通堆对象 = **Mark Word（8B）+  Klass 指针（压缩 oops 开启 4B，否则 8B）**+ 字段 + 对齐填充（8 字节对齐）。"new 一个对象几个字节"靠猜必翻车，用 JOL（`org.openjdk.jol:jol-core`）直接读：

```java
// 目的：拿到真实布局——头/字段顺序/填充/总大小，终结"我以为一个 long 引用 8 字节所以对象 32"
static class OrderLine {                    // 示例：两个 long + 一个引用 + 一个 boolean 的常见小对象
    long orderId; long skuId;               // 结果：HotSpot 默认按宽度降序重排，boolean 塞进引用后的空穴，共 40B
    Sku sku; boolean gifted;                // 反例：按"声明顺序"估容量设堆——JVM 会重排，只有 JOL 输出作准
}
System.out.println(ClassLayout.parseClass(OrderLine.class).toDetailString());
// 输出：# MARK | 8 bytes；Klass Pointer = 4 bytes（压缩 oops）；instance size = 40 bytes
// 说明：堆 >32G 压缩指针自动关闭，头 12→16B——同一段代码换机器整体内存可能多吃的正是这些边角
```

数组另加 4B 长度字段；`Integer` 缓存池、字符串 `byte[] coder`（紧凑字符串）都影响真实占用——海量小对象服务的堆预算应该从 JOL 抽样开始，而不是从"字段数×类型大小"心算开始。

## 二、缓存行与伪共享：没有竞争的竞争

CPU 以 **64B 缓存行**为最小搬运与一致性单位。两个线程写**同一对象的不同字段**，若字段落在同一行，MESI 协议会让两核不断互相无效化对方的行副本——吞吐腰斩却查不出锁竞争，这就是伪共享。

```text
图目的：伪共享与 @Contended 填充前后的缓存行归属
填充前：[ writes | reads ] ← 同一 64B 行被核0与核1轮流写 → 每次写都无效化对方副本
填充后：[ writes | pad… ] [ pad… | reads ] ← 两行各自独立，一致性流量归零
❌ 误读："没加锁就没竞争"——竞争从代码层挪到了缓存协议层，profiler 里只表现为"莫名的高 CPU"
```

```java
// 目的：@Contended 让热点字段独占缓存行，JOL 里可见字段前后出现 $contended 填充
class ShardedCounter {
    @Contended("ops") volatile long writes;  // 结果：写密集的核0不再打脸读密集的核1，吞吐恢复到线性
    volatile long reads;                     // 反例：逢字段就打 @Contended——每个都 padding 后内存翻倍，
                                            // 缓存利用率崩坏，冷字段白白挤占行容量；只给实测热点用
}
// 说明：JDK8 需 -XX:-RestrictContended 才对应用类生效；JDK9+ 标注即生效
```

LongAdder 的 Cell 数组、Disruptor 的 RingBuffer 序列号都是教科书级应用——JDK 自己在用（`Base.java` 里 Cell 的 HPIH 手工填充）。

## 三、什么时候值得动对象布局

收益侧：亿级小对象的缓存/堆压力（字段重排省的空穴 × 数量）、多核热点计数器（伪共享吞吐差可达数倍）；成本侧：@Contended 是空间换一致性流量，padding 一个字段至少搭 56B。工程顺序应是：**先用 alloc 火焰图/GC 曲线确认对象尺寸或热点字段是真凶，再动布局**——为不存在的瓶颈省 8 字节是负收益。验证手段闭环：JOL 看布局 → 微基准（JMH）测吞吐 → async-profiler 看缓存一致性与停顿侧证据。

## 四、关联课程

LongAdder 分段思想与 volatile 语义在 [volatile 与原子类](../../juc/s1/S1-2-Lesson.md)；Mark Word 在锁升级中的角色见 [synchronized 锁升级](../../juc/s1/S1-3-Lesson.md)；"该不该省这些字节"由分配证据说话，方法在 [火焰图怎么看与常见瓶颈](../../async-profiler/s1/S1-1-Lesson.md)；堆与压缩指针的整机视角在 [运行时数据区与方法区演进](../../jvm/s1/S1-1-Lesson.md)。
