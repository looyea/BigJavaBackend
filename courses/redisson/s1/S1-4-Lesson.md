# 与 Lettuce 协同及分布式锁落地边界（关联）

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：把 Redisson 放回整条 Redis 技术栈收口——① **协同**：Redisson 与 Lettuce/Spring Data Redis 如何在同一服务共存（各管协调与缓存、统一编解码、连接资源核算），Redisson 自身也构建在 Netty 上、与 Lettuce 同源；② **边界**（本节灵魂）：分布式锁**能解决什么、不能解决什么**——它只在"多实例竞争同一资源"且"临界区可容忍 Redis 语义"时有效，对**跨库/跨系统副作用、长事务、绝对正确性、性能热点**都是错的工具；给出"锁粒度最小化、能不锁就不锁、该用 DB 约束/幂等/无锁结构替代"的决策清单与降级路径。

## 一、Redisson 与 Lettuce 在同一服务里怎么共存（★★★★☆）

- **分工**：缓存读写走 Spring Data Redis（`RedisTemplate`，Lettuce 驱动），协调原语（锁/限流/布隆）走 Redisson——二者都往同一 Redis 写标准结构，功能不打架（呼应 lettuce s1-3）。
- **底层同源**：Redisson 亦基于 Netty 自管连接；与 Lettuce 各持一套连接与线程，需纳入总连接数核算，但都很轻。
- **编解码统一是关键坑**：Redisson 默认 Jackson/Marshalling 二进制编码，Lettuce/RedisTemplate 常配 String/JSON——同一 key 两边读写必须对齐序列化，否则互相看不懂（lettuce s1-3 作业3 复现过）。

```java
// 例子目的：让 Redisson 与 RedisTemplate 读写同一个 String key 互通
org.redisson.config.Config cfg = new org.redisson.config.Config();
cfg.setCodec(new org.redisson.client.codec.StringCodec());  // 关键：Redisson 用 StringCodec（正确：与 RedisTemplate 的 StringRedisSerializer 对齐，字节层面可互读互写）
// 错误用法：Redisson 用默认 Jackson 二进制写 "stock:1"，RedisTemplate 用 StringRedisSerializer 去 GET → 读到带引号/类型头的乱码或 WRONGTYPE
RLock lock = redisson.getLock("job:lock");   // 锁这类"只给 Redisson 自己用"的 key 用什么 codec 无所谓（无跨客户端读）
```

> 判据：**只有会被跨客户端读的 key 才需要统一 codec**（如用 Redisson `RAtomicLong` 计数、又被 RedisTemplate 读来展示）；纯 Redisson 内部结构（锁、闭锁）用默认即可。

## 二、分布式锁的能力边界（★★★★★，本节灵魂）

分布式锁不是"并发焦虑"的万能解。四类"不该用 Redis 分布式锁"的场景：

```flow
例子目的：接到"要不要加分布式锁"时的四问决策，命中任一 → 换更合适的工具
要保护一段并发 --> {只有一个实例会执行吗?}
{只有一个实例会执行吗?} -- 是(如单机/已分片) --> 用 JVM 锁(synchronized/ReentrantLock)即可，别引入 Redis 网络开销与故障面
{只有一个实例会执行吗?} -- 否(多实例争抢) --> {保护的是"互斥"还是"数据正确性"?}
{保护的是互斥还是数据正确性?} -- 数据正确性(钱/库存终值) --> 优先 DB 唯一约束/乐观锁 version/原子 SQL，锁只做前置降压
{保护的是互斥还是数据正确性?} -- 纯互斥(同一时刻只跑一个) --> {临界区时长可接受吗?}
{临界区时长可接受吗?} -- 秒级短 --> Redisson RLock 合适
{临界区时长可接受吗?} -- 分钟级/含外部副作用 --> 拆成 幂等 + 状态机 + 分布式任务调度(job 专区)，别用长持锁
```

**锁解决不了的根本问题**：

1. **绝对正确性**：主从切换丢锁 + 无 fencing（s1-2），Redis 锁给的是"高概率互斥"，钱货两讫要靠 DB 约束/事务；
2. **跨系统副作用**：锁只挡"同样拿锁的人"，挡不住绕过锁直接写 DB 的路径（旁路、脚本、其他服务）；
3. **性能**：锁是**串行化**，热点 key 上加锁 = 把并发打回单线程，越抢越慢（热 key 治理 redis s2-3 的思路是打散而非加锁）；
4. **长事务**：持锁几分钟 = 锁随时可能因 GC/网络/宕机失效，且拖垮吞吐——用幂等 + 状态机替代。

## 三、锁粒度与降级设计（★★★★☆）

- **粒度最小化**：锁 key 要具体到资源——`lock:order:{orderId}` 而非 `lock:order:*`；能锁一行不锁一张表，能锁一次写不锁整个流程。粗粒度锁是吞吐杀手。
- **必须有的三件套**：`tryLock(waitTime, leaseTime)` 或看门狗、`finally unlock`、**拿不到锁的降级路径**（快速失败/排队/走只读兜底），别让锁本身成为单点故障放大源。
- **降级**：Redis 不可用时锁全失效——核心写要能"降级到 DB 乐观锁"或"短暂放行 + 事后对账"，不能因拿不到锁直接全线不可用。

```java
// 例子目的：一个"抢锁失败即降级"的健壮加锁模板
RLock lock = redisson.getLock("stock:lock:" + skuId);        // 锁到具体 sku（正确粒度：不同 sku 并行，只有同 sku 串行；粗到 stock:lock 会让全站库存操作串行化）
boolean got = false;
try {
    got = lock.tryLock(50, 3000, TimeUnit.MILLISECONDS);      // 最多等 50ms、持有时租约 3s（有界等待，防锁堆积）
    if (!got) { return deductWithDbOptimisticLock(skuId, n); } // 拿不到锁 → 降级到 DB 乐观锁，而非直接失败（正确：锁是降压手段不是唯一防线）
    return deductInLock(skuId, n);
} finally {
    if (got && lock.isHeldByCurrentThread()) lock.unlock();   // 只解自己持有的锁（错误用法：未判 isHeldByCurrentThread 就 unlock → 没抢到锁的线程解了别人的锁，抛异常/误放）
}
```

## 四、动手题

1. 给同一 Redis 分别用 Redisson(StringCodec) 与 RedisTemplate 读写同一个计数器 key，验证互读正常；换回默认 codec 复现乱码。
2. 把一个粗粒度 `lock:order` 改成 `lock:order:{id}`，压测不同 id 并发的吞吐提升倍数。
3. 模拟 Redis 宕机（停服），验证拿不到锁时你的降级路径（DB 乐观锁）是否兜住、业务是否仍正确。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| RedisTemplate 读 Redisson 写的 key 乱码 | 两侧 codec 不一致，未对齐 StringCodec/JSON |
| 加锁后接口吞吐不升反降 | 锁粒度过粗（全局/表级），把并发串行化 |
| Redis 抖动→业务全线拿不到锁挂掉 | 锁成单点，无降级路径 |
| 偶发 `unlock` 抛 IllegalMonitorState | 没抢到锁的线程也走了 unlock（未判 isHeldByCurrentThread） |
| 用锁保护"跨服务扣款+发货"仍有重复 | 锁管不到绕过它的旁路/其它服务，应上幂等+ Saga/状态机 |

## 六、关联技术栈

- **向前**：分层共存 ↔ lettuce s1-3；锁原理与红锁边界 ↔ s1-1、s1-2；热 key 打散 ↔ redis s2-3
- **向后**：包内收官，转 caffeine 多级缓存 / 幂等 / job 调度
- **横向**：降级熔断 ↔ 高可用专区；分布式任务 ↔ job-scheduling；对账补偿 ↔ 金融场景

## 七、本节小结

协同层面：Redisson 与 Lettuce/Spring Data 是**同一栈的分工搭档**而非对手，缓存归后者、协调归前者，唯一的硬约束是**跨客户端共读的 key 必须统一 codec**。边界层面——这才是分布式锁最该被记住的一课：**它给的是"高概率互斥"，不是"正确性保证"也不是"性能加速器"**。判断链条是：单实例→用 JVM 锁；要终值正确→用 DB 约束/乐观锁，锁只降压；纯互斥且临界区短→才上 Redisson；长事务/跨系统副作用→拆成幂等 + 状态机 + 调度而非长持锁。工程铁律：锁粒度尽量小、`tryLock` 有界等待、`finally` 判持有者再解、并永远备好"拿不到锁的降级路径"。至此 Redisson 分布式对象框架收官，下一包进入 Caffeine 本地缓存与多级缓存。
