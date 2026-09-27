# 实际面试题 · W-TinyLFU 与失效策略

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。考"Caffeine 为什么快/命中率高、过期淘汰刷新、本地缓存防穿透击穿"。

## 题 1：为什么用 Caffeine 而不是 ConcurrentHashMap 自己加 LRU？

**期望时长**：90 秒

**答题要点**：

- 自研 LRU 要么加粗粒度锁（并发差）、要么淘汰逻辑复杂易错；
- Caffeine：读几乎无锁（借鉴 ConcurrentHashMap 的 ring buffer 异步批量处理读写事件）、淘汰用 **W-TinyLFU** 命中率远高于 LRU；
- 内置过期/刷新/统计/loader，生产级特性齐全。

**追问链**：W-TinyLFU 凭什么命中率高？→ 小窗口准入 + SLRU 分区 + Count-Min Sketch 频率，兼顾"新近性"与"频率"，抗一次性扫描污染（纯 LRU 只看新旧会被扫描冲掉热点）。

## 题 2：expireAfterWrite、expireAfterAccess、refreshAfterWrite 区别？

**答题要点**：

- `expireAfterWrite`：写后固定时长过期，不管读没读——适合"数据本身会变质"（缓存 TTL）；
- `expireAfterAccess`：最后一次访问后过期——适合"冷就淘汰"（会话类）；
- `refreshAfterWrite`：写后到时长**不立即失效**，下次访问返回旧值 + 后台异步刷新，需配 loader。

**追问链**：refresh 和 expire 怎么配？→ `refresh < expire`：正常靠 refresh 异步平滑换值（读不阻塞）；万一 loader 一直失败、超过 expire 才判失效兜底。只配 refresh 不配 expire 则 refresh 失败时旧值永远不过期。

## 题 3：Caffeine 本地缓存怎么做防击穿、防穿透？

**答题要点**：

- 防击穿：`LoadingCache` 对同 key 并发加载**合并**，只一个线程回源、其余等结果；再配 refresh 避免集中过期同步回源。
- 防穿透：loader 对"确实不存在"返回**哨兵值**缓存（不能返 null，null 不缓存等于没防）。
- 防雪崩：过期时间加随机抖动，避免同刻集体失效（redis s2-1 同理）。

**追问链**：本地缓存能替代 Redis 做这些吗？→ 不能。本地缓存**各节点独立**、容量受单 JVM 堆限、无跨节点共享，重启即失——它是"离应用最近的一级"，要与 Redis 二级组合（见 s1-2），穿透/击穿最终也要在能共享的那层兜底。

## 题 4：maximumSize 和 maximumWeight 怎么选？

**答题要点**：

- 元素大小均匀 → `maximumSize`（按条数）；
- 元素大小差异大（缓存图片/大对象/变长文本）→ `maximumWeight` + `weigher`（按内存权重），更真实控制堆占用。

**追问链**：weigher 乱写会怎样？→ 权重不反映真实堆占用 → 要么提前 OOM（低估），要么命中率低（高估浪费）。value 有 `estimatedSize` 更好，否则用 `Runtime` 近似或按已知字段估。

## 题 5：本地缓存的命中率怎么观测、低了怎么排查？

**答题要点**：

- `recordStats()` + `cache.stats()`：hitRate、loadCount、evictionCount、平均加载耗时；接 Micrometer 出图告警。
- 命中率低排查：① key 基数 >> 容量（eviction 高）→ 扩容或收窄缓存集；② TTL 太短/无 refresh 频繁回源；③ 扫描型负载污染（W-TinyLFU 已缓解，极端时加过滤）；④ loader 返 null 不缓存。

**追问链**：evictionCount 很高一定是坏事吗？→ 不一定是故障——有界缓存淘汰是常态；关键是"淘汰的是不是即将被复用的热点"，配合命中率与访问分布判断容量是否配错。
