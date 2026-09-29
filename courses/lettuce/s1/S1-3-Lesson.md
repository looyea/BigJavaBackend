# Lettuce 与 Redisson 的定位与选型（关联）

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：把"Redis Java 客户端"这张地图收口——**Lettuce 是命令级客户端**（把 Redis 的每条命令映射成 API，你负责拼语义），**Redisson 是面向对象的分布式框架**（在 Redis 之上实现 Lock/Map/Set/BloomFilter/RRateLimiter 等**数据结构与分布式原语**，它把语义封装好给你）。关键认知：**Redisson 底层默认就构建在 Netty 上、可复用 Lettuce/Netty 连接资源**，二者不是竞品而是**分层协作**——命令操作用 Lettuce（或 Spring Data Redis），分布式协调原语用 Redisson。给出"什么活派给谁"的清晰边界与选型决策表。

## 一、抽象层次不同：命令 vs 对象（★★★★★，核心）

| 维度 | Lettuce | Redisson |
| --- | --- | --- |
| 定位 | **命令级客户端**（RESP over Netty） | **分布式对象/框架**（数据结构的 Redis 实现） |
| API 风格 | `cmd.get/set/zadd/eval` 一一对应 Redis 命令 | `RLock`/`RMap`/`RBloomFilter`/`RRateLimiter` 像 JDK 集合/并发工具 |
| 你要做的 | 自己用 Lua/命令拼出原子逻辑（如手写分布式锁） | 直接用封装好的原语（`lock.lock()` 自带看门狗续期） |
| 典型产物 | `RedisTemplate`（Spring Data 建在其上） | 可重入锁、读写锁、限流器、分布式 Map |
| 依赖关系 | 独立、更底层 | **底层可跑在 Netty 上，与 Lettuce 同源**（非二选一） |

```java
// 例子目的：同一个"库存扣减+防超卖"需求，两种客户端写出来的代码量级差异
// —— Lettuce：你得自己写 Lua 保证原子（命令级，语义自己拼）
String lua = "local s=tonumber(redis.call('GET',KEYS[1]) or '0') " +
             "if s>=tonumber(ARGV[1]) then return redis.call('DECRBY',KEYS[1],ARGV[1]) else return -1 end";
Long r = conn.sync().eval(lua, ScriptOutputType.INTEGER, new String[]{"stock:1"}, "1"); // 正确使用结果：原子扣减，返回 -1 表示库存不足（错误用法：先 GET 判断再 DECR 两条命令 → 并发下超卖，得自己想到用 Lua）
// —— Redisson：直接要一个原子计数器对象，语义内置
RAtomicLong stock = redisson.getAtomicLong("stock:1");
if (stock.decrementAndGet() < 0) { stock.incrementAndGet(); /* 回滚，库存不足 */ } // 框架已保证原子，你只管业务；甚至可用 RSemaphore 直接建模"库存=许可数"
```

## 二、什么时候必须上 Redisson（★★★★☆）

Lettuce 给你的是"积木块"，遇到需要**协调语义**的场景，自建成本高且易错——这正是 Redisson 的地盘：

- **分布式锁**：可重入、看门狗自动续期、公平锁、RedMultiLock（redisson s1-1/s1-2）——用 Lettuce 手写 `SET NX PX` 只是不可重入的一次性锁，续期/重入/安全释放全得自己填坑；
- **分布式数据结构**：`RMap`/`RSet`/`RDeque`/`RBlockingQueue`（跨节点阻塞队列）/`RScoredSortedSet`；
- **高级原语**：`RBloomFilter`（s2-1 穿透方案现成实现）、`RRateLimiter`（令牌限流）、`RLock` 读写锁、`CountDownLatch`/`Semaphore` 的分布式版。

> 判据：**当"用 Redis 实现的不是一个命令、而是一个并发/协调语义"时，先看 Redisson 有没有现成原语**，别用 Lettuce 手搓——手搓分布式锁是经典的"看着会、上线炸"。

## 三、选型决策与协作姿势（★★★★☆）

```flow
例子目的：一个新需求接 Redis 时，Lettuce / Redisson / Spring Data 各派什么活
需求进入 --> {只是读写缓存/命令级操作?}
{只是读写缓存/命令级操作?} -- 是 --> 用 Spring Data Redis(RedisTemplate) 或直接 Lettuce
{只是读写缓存/命令级操作?} -- 否 --> {需要分布式锁/限流/布隆/跨节点数据结构?}
{需要分布式锁/限流/布隆/跨节点数据结构?} -- 是 --> 用 Redisson 现成原语(勿手搓)
{需要分布式锁/限流/布隆/跨节点数据结构?} -- 否 --> 回到命令级 + 自己写 Lua 原子块
```

- **多数业务系统两者共存**：Spring Boot 里 `spring-boot-starter-data-redis`（Lettuce 驱动）做缓存读写，另引 `redisson-spring-boot-starter` 做锁与协调——**共享同一 Redis，不冲突**；
- 连接资源层面：Redisson 自带 Netty 连接管理，与 Lettuce 各持各的连接，注意总连接数与 `ClientResources` 别翻倍浪费（生产可接受，二者本就轻）。

## 四、动手题

1. 分别用 Lettuce（手写 Lua）与 Redisson（`RLock`/`RAtomicLong`）实现同一秒杀扣减，压测对比超卖是否发生、代码行数。
2. 用 Redisson `RBloomFilter` 给 s2-1 的缓存穿透方案落地，对比 Lettuce 里自己位图+多哈希实现的工作量。
3. 在同一个 Spring Boot 工程同时引入两种 starter，验证二者对同一 key 读写互通（本质都是往 Redis 写标准结构）。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 用 Lettuce 手写锁偶发误删他人锁/锁不释放 | 没做"值=唯一令牌+Lua 按值释放+看门狗续期"——该用 Redisson |
| Redisson 锁迟迟不释放占着 | 持有线程崩且未配 leaseTime、看门狗也没续上（进程被 kill 未触发 unlock） |
| 两者混用读写同一 key 出现类型不符 | 一边 `RMap`（Redisson 自定义编码）一边 `HGET`（Lettuce 裸值）序列化不一致——编码要统一 |
| 连接数比预期多一倍 | Lettuce 与 Redisson 各建 Netty 资源，正常但需纳入总量核算 |
| Redisson 对象在 Cluster 跨槽报 CROSSSLOT | `RMap`/多 key 原语受 Cluster 槽约束，需 hash tag 或单机 |

## 六、关联技术栈

- **向前**：连接模型/pipeline/Cluster ↔ s1-1、s1-2；手写锁与原子块 ↔ redis s2
- **向后**：Redisson 锁与看门狗细节、原语清单 ↔ redisson s1-1~s1-4
- **横向**：RedisTemplate ↔ spring-data-redis；限流落地 ↔ 高可用专区

## 七、本节小结

Lettuce 与 Redisson 不是"二选一"，而是**抽象层次分工**：Lettuce 停在命令层，把 Redis 每条命令如实映射、逼你亲手拼语义（缓存读写、eval 原子块是它的主场）；Redisson 升到对象/协调层，把分布式锁、限流器、布隆过滤器、跨节点数据结构这些"用 Redis 重造 JDK 并发工具"的活儿封装成开箱原语。落地常态是**同栈共存**：Spring Data Redis（Lettuce 驱动）管缓存，Redisson 管协调。选型口诀——**命令级找 Lettuce，协调语义先翻 Redisson 有没有现成的，别拿 Lettuce 手搓分布式锁**。下一包进入 Redisson，把这里点到的锁与原语逐个讲透。
