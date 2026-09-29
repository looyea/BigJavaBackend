# W-TinyLFU 与失效策略

> 本节难度：★★★★☆
> 重要程度：★★★☆☆
> 学习产出：本地缓存的第一性问题不是"怎么存"而是"**在有限内存下保留哪些 key**"——即淘汰算法。理解 Caffeine 选用的 **W-TinyLFU**（Window-TinyLFU：一小段 LRU 准入窗 + 主体 SLRU 保护区 + Count-Min Sketch 频率草图做准入决策），说清它相比纯 LRU 如何同时扛住"**突发扫描污染**"和"**频率型热点**"两类负载；掌握 Caffeine 三大容量/失效控制手段：`maximumSize`/`maximumWeight`、`expireAfterWrite`/`expireAfterAccess`/`refreshAfterWrite`，辨析**过期 ≠ 淘汰 ≠ 刷新**，以及 `CacheLoader`/`LoadingCache` 的加载与回填语义。

## 一、为什么 LRU 不够，W-TinyLFU 补了什么（★★★★★，核心）

LRU 只看"最近"，两类负载要它的命：

- **一次性扫描**（全表遍历、批量导出）：把大量"只用一次"的 key 塞进缓存，挤掉真正的热点 → **缓存污染**；
- **频率型热点**：一个 key 被访问很多次但最近没来，LRU 可能已把它淘汰。

**W-TinyLFU 的三段设计**：

```flow
例子目的：W-TinyLFU 的三段结构与一次 get 的判定路径（准入靠频率而非仅新旧）
新元素进入 --> Window(TinyLFU 准入窗口, ~1% 容量, LRU)
Window --> {满了一个元素要下沉到主区?}
{要下沉到主区?} -- 是 --> Probation(主区试住区, SLRU 一半)
Probation --> {访问频率(CountMinSketch) 高于 Probation 尾部淘汰候选?}
{频率够高吗?} -- 是 --> 晋升进入 Protected(主区保护区, 热点常驻)
{频率够高吗?} -- 否 --> 直接淘汰(挡掉一次性扫描的低频元素)
Protected --> {满了溢出的元素} --> Probation
```

- **Window（1%）+ Probation/Protected（99%，即 Segmented LRU）**：新 key 先进小窗口试住，够热才晋升主区；
- **Count-Min Sketch（CMS）**：用极小内存近似统计每个 key 的访问频率，作为"能不能进/替换谁"的准入依据；
- **对抗扫描**：一次性大批 key 频率都是 1，进不了主区就被 CMS 挡下 → 热点不被冲走；
- 相比 Redis 的近似 LRU（redis s2-3 采样策略），W-TinyLFU 命中率显著更高，代价是实现复杂、CMS 有小概率频率误差。

## 二、容量控制与三种"失效"的辨析（★★★★★）

**过期、淘汰、刷新是三件事，面试与实战都极易混**：

| 机制 | 触发 | 语义 | 典型 API |
| --- | --- | --- | --- |
| 过期 expiration | 到时间 | 条目**逻辑失效**，下次访问判过期并重新加载 | `expireAfterWrite(10,MIN)` / `expireAfterAccess(5,MIN)` |
| 淘汰 eviction | 超容量 | 内存不够时按 W-TinyLFU **踢出**条目腾地方 | `maximumSize(10_000)` / `maximumWeight` |
| 刷新 refresh | 到时间且被访问 | **异步**回源换新值，旧值先继续服务（防击穿/防回源风暴） | `refreshAfterWrite(8,MIN)` + `build(loader)` |

```java
// 例子目的：一个电商商品详情缓存的标准 Caffeine 配置
LoadingCache<Long, Product> cache = Caffeine.newBuilder()
        .maximumSize(50_000)                              // 容量上限（正确：给本地堆设硬顶，配合 W-TinyLFU 淘汰，防 OOM；错误用法：不设上限 → 缓存吃满堆触发 FullGC 甚至 OOM）
        .expireAfterWrite(10, TimeUnit.MINUTES)           // 写后 10 分钟过期（语义：到点条目失效，下次 get 同步回源重建）
        .refreshAfterWrite(6, TimeUnit.MINUTES)           // 写后 6 分钟"可刷新"（正确：第 7 分钟来访问 → 立即返回旧值 + 后台异步加载新值，读不阻塞、避免大量请求同时回源=击穿防护）
        .recordStats()                                    // 开统计（命中率/加载耗时），上线前必开
        .build(key -> db.loadProduct(key));               // loader：缓存未命中或刷新时如何回源（必须幂等、可返回 null 表示无值不缓存）
Product p = cache.get(1001L);                             // 命中直接返回；未命中→同步调 loader 加载并回填（同一 key 并发加载 Caffeine 会合并，只有一个线程回源）
// 辨析：refresh < expire 才有意义——refresh 期内异步换新(旧值仍可用)；超过 expire 还没刷则判失效、同步回源(读线程会等)
```

## 三、LoadingCache 的加载与 null/异常语义（★★★★☆）

- `get(key, k -> ...)`：函数式加载；`LoadingCache`（build 时给 loader）：`get(key)` 自动回填。
- **loader 返回 null** → Caffeine 不缓存该结果（每次都会重试回源，慎用——等于没缓存，配合穿透防护）；要缓存"空"含义应存**哨兵对象**。
- **loader 抛异常** → 不缓存、异常透传给调用方；不要把异常当正常值缓存。
- `build(loader)` 与 `expireAfterWrite` 组合时，**过期后的首次访问是同步阻塞回源**（不像 refresh 有旧值兜底）→ 热点 key 优先用 `refreshAfterWrite` 平滑（呼应 redis s2-1 击穿）。

```java
// 例子目的：防穿透——用哨兵值缓存"确实不存在"
Product v = cache.get(id);                       // loader 里查 DB：
//   DB 有 → 返回对象；DB 无 → 返回 NOT_FOUND 哨兵(而非 null)，让"不存在"也被缓存一段时间，挡住对同一死 key 的反复穿透
// 错误用法：DB 无时 loader 返回 null → 永远不缓存 → 每次穿透请求都打到 DB（穿透没解决）
```

## 四、动手题

1. 构造"90% 频率 1 次的一次性 key + 10% 高频 key"混合负载，对比 `LinkedHashMap`(LRU) 与 Caffeine 的命中率（`recordStats`），验证 W-TinyLFU 抗扫描污染。
2. 只配 `expireAfterWrite` 不配 `refreshAfterWrite`，让热点 key 过期瞬间打 500 并发，观察回源风暴；加上 refresh 后复测。
3. loader 分别"返回 null""返回哨兵""抛异常"三种写法，用 `get` 观察缓存是否存值、是否透传异常。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 堆内存被缓存吃满、FullGC 频繁 | 未设 maximumSize/Weight，无界缓存 |
| 热点 key 过期瞬间 DB 被打爆 | 只配 expire 没配 refresh，过期同步回源无旧值兜底 |
| 缓存命中率极低 | key 基数远超容量 / loader 返回 null 不缓存 / 无界扫描冲刷 |
| 不同节点本地缓存值不一致 | 本地缓存天然各自为政，需靠失效广播/短 TTL（见 s1-2） |
| 内存权重算错提前 OOM | maximumWeight 用了不反映真实堆占用的 weight 函数 |

## 六、关联技术栈

- **向前**：Redis 近似 LRU/LFU 采样 ↔ redis s2-3；缓存击穿/穿透 ↔ redis s2-1
- **向后**：本地+Redis 多级缓存与失效广播 ↔ s1-2
- **横向**：Caffeine 也用于 Spring Cache、DataLoader 场景 ↔ spring 专区

## 七、本节小结

Caffeine 的杀手锏是 **W-TinyLFU**：用 1% 的 LRU 准入窗口 + 99% 的 Segmented-LRU 主区，配合 Count-Min Sketch 的近似频率做准入，既能挡住一次性扫描对热点的污染、又能留住频率型热点，命中率碾压纯 LRU——代价是频率近似有小误差。配置侧务必分清**过期（到点失效）、淘汰（超容量踢出）、刷新（到期异步换值、旧值兜底）**三件事：**给堆设 `maximumSize` 硬顶防 OOM、热点用 `refreshAfterWrite` 防回源风暴、loader 返回 null 不缓存所以要配合哨兵值防穿透、并 `recordStats` 观测命中率**。这些正是把本地缓存接入多级体系前的基本功——下一节讲本地缓存与 Redis 如何组合、以及最难的失效一致性。
