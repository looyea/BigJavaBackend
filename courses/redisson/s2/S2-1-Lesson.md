# 分布式对象与远程服务

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能把 Redisson 从"分布式锁工具"升级为"**分布式数据结构框架**"来使用——用 `RMap`/`RSet`/`RSortedSet`/`RQueue`/`RDeque`/`RBlockingQueue`/`RTopic`（发布订阅）/`RAtomicLong`/`RBitSet` 等把 Redis 能力封装成 Java 集合语义，理解它们**背后的数据结构、网络往返与一致性代价**（多数非原子、跨命令靠 Lua 保证）；用 `RLocalCachedMap` 做"本地 + Redis"两级缓存并处理失效广播；用 `RemoteService`/`RRemoteCallable` 把方法调用/异步任务下发到别的 JVM 执行。核心取舍：分布式对象**便捷但有隐藏成本**——每次操作都可能是一次网络往返、大集合会退化成多次命令、序列化（Codec）开销与兼容性必须评估；不要用 `RMap` 存海量数据当"无限内存哈希"。识破"把 RMap 当本地 HashMap 疯狂 `entrySet()` 全量拉取""RRemoteCallable 传大对象/依赖类不一致""本地缓存不设失效导致脏读"等坑。

## 一、分布式集合：语义像集合，成本像网络

```text
图目的：API 是 Java 集合, 底层是 Redis + 网络往返, 别按本地内存心智用
RMap→hash, RSet→set, RQueue/RDeque→list, RSortedSet→zset, RBlockingQueue→list+pubsub
RTopic→发布订阅(跨 JVM 广播/失效通知), RAtomicLong→INCR, RBitSet→bitmap
关键: 单命令 O(1), 但 size()/entrySet()/遍历可能触发全量拉取或多命令, 慎用于大 key
```

```java
// 目的：用 RMapCache 做带 TTL 与淘汰的共享缓存, 而非把 RMap 当无界哈希
RMapCache<String, Product> map = redisson.getMapCache("product");
map.put("sku:1", p, 30, TimeUnit.MINUTES);            // 说明：条目级过期, 底层惰性 + 定时清理
// 反例：map.entrySet() 全量拉到本地再过滤 ❌ 大 key 下退化成海量网络往返, OOM + 拖慢 Redis
// 反例：把百万级明细塞进一个 RMap ❌ 单 key 巨大, 违反 Redis 大 key 纪律, 迁移/删除都卡
```

## 二、RLocalCachedMap：本地 + Redis 两级

```text
图目的：热点读走本地纳秒级, 写经 Redis 并广播失效, 兼顾速度与一致
Invalidation 策略: 通过 RTopic 通知其它节点清掉本地副本
代价: 短暂不一致窗口(本地已失效他节点未收到); 命中率/失效延迟需权衡
```

- 适合"读多、容忍毫秒级最终一致"的热点（如商品详情、配置）；对"写后立刻全局强一致读"的场景不适用。

## 三、RemoteService：把调用下发到别的 JVM

```java
// 目的：把一次性任务/计算下发到注册了服务的另一进程执行(类分布式执行器)
redisson.getRemoteService().register(EmailApi.class, new EmailApiImpl());   // 提供方注册
EmailApi api = redisson.getRemoteService().get(EmailApi.class, 5, TimeUnit.SECONDS);
api.sendAsync(to, body);                                                    // 结果：调用被序列化经 Redis 投递到提供方执行
// 反例：接口方法参数传不可序列化/两端版本不一致的复杂对象 ❌ Codec 反序列化失败或行为漂移
// 反例：用 RRemoteCallable 跑重任务当线程池 ❌ 无弹性扩缩与失败重试, 该用真正的 MQ/任务调度
```

## 四、坑与底线

- **Codec 是一等地基**：默认 JSON codec 有性能与兼容代价，跨版本改类结构要评估反序列化兼容；热点集合考虑更省的编解码。
- **别把 Redis 当无限内存**：分布式对象的价值在"共享 + 原子小操作"，海量数据仍应落 DB，Redis 只放热数据。

## 五、关联课程

分布式对象与集合的底层类型承自 [五大类型与底层编码](../../redis/s1/S1-1-Lesson.md)；`RTopic`/失效广播与 [缓存穿透/击穿/雪崩](../../redis/s2/S2-1-Lesson.md) 的多级缓存思路一致；`RemoteService` 与同步器家族都构建在连接层之上，连接模型对比见 [与 Lettuce 协同及分布式锁落地边界（关联）](../s1/S1-4-Lesson.md)。
