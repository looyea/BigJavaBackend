# 实际面试题 · Lettuce 与 Redisson 的定位与选型（关联）

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。考"Redis 客户端怎么选型、分布式锁自己写还是用框架"。

## 题 1：你们 Redis 客户端用 Jedis、Lettuce 还是 Redisson？怎么定的？

**期望时长**：90 秒

**答题要点**：

- 先分清两层：命令级客户端（Jedis/Lettuce）vs 分布式对象框架（Redisson）——不是同一层竞品；
- 命令层选 Lettuce（Netty 异步、共享连接、Spring Boot 默认），除非老项目绑定 Jedis；
- 需要分布式锁/限流/布隆/跨节点数据结构等**协调语义**时，叠加 Redisson，与 Lettuce 共存共享同一 Redis。

**追问链**：为什么不干脆全用 Redisson？→ Redisson 也提供命令级能力但抽象更重，纯缓存读写用 Spring Data(RedisTemplate/Lettuce) 更轻更通用；各司其职、避免把重框架当万能。

## 题 2：用 Lettuce 自己写分布式锁要注意什么？写完发现还缺啥？

**答题要点**：

- 三件套：`SET key uniqueToken NX PX ttl`（原子占锁+超时）、释放用 **Lua 按值比对删**（防误删他人锁）、业务超时需**续期**。
- 写着写着要补：可重入（持有计数+哈希结构）、看门狗自动续期、锁失效后的双读一致、异常路径必释放——复杂度陡增。
- 结论：这正是该用 Redisson `RLock` 的地方，别手搓。

**追问链**：手搓锁最典型的线上事故？→ ① 用 `DEL` 直接释放删掉了别人刚抢的锁（没按令牌）；② 锁到期业务没跑完导致两线程同时持锁（没看门狗）；③ 不可重入自我死锁。

## 题 3：Redisson 和 Lettuce 都基于 Netty，会不会资源打架？

**答题要点**：

- 各持独立 Netty EventLoopGroup 与连接，互不共享底层 ClientResources；
- 影响是连接数/线程数各自一份，量不大但要纳入总量核算；生产一般可接受。
- 二者读写的是同一份 Redis 标准结构，功能层不打架——但**序列化编码要统一**才能互读。

**追问链**：同一个 key 一边 RMap 一边裸 HGET 为什么读不出？→ Redisson 默认自定义 codec 编码 field/value，与 Lettuce 裸字符串字节不兼容；要互通得给 Redisson 配 `StringCodec` 或统一序列化方案。

## 题 4：秒杀防超卖，命令级和框架级分别怎么做？

**答题要点**：

- 命令级（Lettuce）：一段 Lua 把"判断库存 + DECRBY"合成原子操作，或 `DECR` 后判负回滚；
- 框架级（Redisson）：`RSemaphore`（库存=许可数，`tryAcquire`）或 `RAtomicLong` 原子扣减；
- 两者都要求**原子**，绝不能"GET 判断 + 独立 DECR"两条命令——并发必超卖。

**追问链**：Redis 扣减成功后 DB 怎么保证最终一致？→ 扣减只是"占坑"，落库走异步下单/消息（rocketmq），或用 Redisson 事务/幂等 + 对账补偿；别让 Redis 与 DB 强一致同步（呼应 redis s2-2、幂等专区）。

## 题 5：给一个从零的新服务，画一版 Redis 接入技术选型。

**答题要点**：

- 缓存读写：Spring Data Redis + Lettuce（RedisTemplate，统一 JSON 序列化）；
- 分布式协调：Redisson（锁 RLock、限流 RRateLimiter、布隆 RBloomFilter）；
- 部署：Redis Cluster 或 主从+Sentinel，Lettuce 开 adaptive 拓扑刷新、命令级 timeout；
- 治理：连接数核算、大 key/热 key 规范、穿透/击穿/雪崩三防（redis s2）落进封装层。

**追问链**：只允许选一个框架呢？→ 纯缓存场景 Lettuce 足够；若核心诉求是分布式锁/协调，优先 Redisson（它也能做命令操作），按主要矛盾取舍——但一般没必要逼自己二选一。
