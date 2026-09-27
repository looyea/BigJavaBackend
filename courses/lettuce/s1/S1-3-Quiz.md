# 小测验 · Lettuce 与 Redisson 的定位与选型（关联）

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. Lettuce 与 Redisson 最本质的定位差异是？（15分）

- A. Lettuce 快、Redisson 慢
- B. Lettuce 是命令级客户端（映射 Redis 命令），Redisson 是面向对象的分布式框架（封装锁/集合/限流等原语）
- C. 二者互斥，只能选一个
- D. Redisson 不支持 Cluster

> 答案：B
> 解析：一个停在命令层逼你拼语义，一个升到对象/协调层给现成原语；且 Redisson 底层同样构建于 Netty、可与 Lettuce 分层共存，非竞品。

### 2. 用 Redis 实现"可重入、自动续期的分布式锁"，工程上更应选？（15分）

- A. Lettuce `SET NX PX` 手写即可，够用
- B. Redisson `RLock`（自带可重入 + 看门狗续期 + 按令牌安全释放）
- C. 数据库行锁
- D. Java `synchronized`

> 答案：B
> 解析：`SET NX PX` 只是不可重入的一次性锁，续期/重入/误删防护全要自己填坑且极易错；这类"协调语义"正是 Redisson 的主场。D 只在单 JVM 有效。

### 3. 【多选】关于 Lettuce 与 Redisson 共存，正确的有？（20分）

- A. 同一 Spring Boot 工程可同时引 data-redis(Lettuce) 与 redisson starter，共享一套 Redis
- B. 二者各持独立 Netty 连接资源，需纳入总连接数核算
- C. 混用读写同一 key 时若编码不一致（如 RMap 序列化 vs 裸 HGET）会类型错乱
- D. 用了 Redisson 就必须卸载 Lettuce

> 答案：ABC
> 解析：共存是常态——缓存读写走 Spring Data/Lettuce，协调走 Redisson，互不排斥；但要注意连接资源与序列化编码统一。D 错。

### 4. 判断："库存扣减防超卖"用 Lettuce 必须先 `GET` 判断再 `DECR` 两条命令。 （10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：两条独立命令在并发下会超卖，必须原子化——Lettuce 用一段 Lua（判断+DECRBY 合并）或直接 `DECRBY` 后判负回滚，或干脆用 Redisson `RAtomicLong`/`RSemaphore`。

### 5. 填空题：需要"跨节点阻塞队列""令牌桶限流""布隆过滤器"时，Redisson 分别对应 ______、______、______ 现成原语，而无需用 Lettuce 手搓。（20分）

> 答案：RBlockingQueue（RBlockingDeque） / RRateLimiter / RBloomFilter

### 6. 用一句话给出选型口诀，并各举一个 Lettuce 与 Redisson 的"主场任务"。（20分）

> 参考答案：
> - 口诀：命令级找 Lettuce，协调语义先翻 Redisson 有没有现成的，别拿 Lettuce 手搓分布式锁
> - Lettuce 主场：普通缓存读写、pipeline 批量、eval 原子块（Spring Data Redis 建在其上）
> - Redisson 主场：分布式可重入锁（看门狗）、RRateLimiter 限流、RBloomFilter 防穿透、RMap 等分布式数据结构
