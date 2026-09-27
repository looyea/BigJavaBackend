# 作业题 · W-TinyLFU 与失效策略

> 作业不判分，做完对照参考答案自查。需要引入 `com.github.ben-manes.caffeine:caffeine` 依赖的 Java 工程。

## 作业 1：命中率碾压 LRU 实测（必做）

```java
// 例子目的：Zipfian 热点 + 一次性扫描混合负载，对比命中率
Cache<Integer, byte[]> lru = ...        // 用 LinkedHashMap(accessOrder=true) + removeEldestEntry 手写 LRU 容量 1000
LoadingCache<Integer, byte[]> caf = Caffeine.newBuilder().maximumSize(1000).recordStats()
        .build(k -> new byte[64]);       // 同容量 Caffeine
// 回放：先灌 100 个热 key 各访问数百次，再混入 5000 个只访问 1 次的扫描 key
// 正确使用结果：caf.stats().hitRate() 明显高于 LRU（扫描 key 被 W-TinyLFU 频率准入挡在主区外，热点不被冲走）
```

注释贴两者 hitRate，一句话解释差在哪。

## 作业 2：refresh 防回源风暴（必做）

`refreshAfterWrite(2s)` + loader 里 `sleep(1s)` 模拟慢回源。第 3s 起打 500 并发 `get` 同一 key，统计 DB（loader）实际被调用次数与线程等待时间。

**参考答案要点**：只有 1 个线程触发异步刷新、其余直接拿旧值不阻塞（loader 调用≈1，几乎零等待）；对照只配 `expireAfterWrite` 版：500 线程挤在同步回源上（Caffeine 合并为 1 次加载但其余等待该次完成）。

## 作业 3：loader 三语义观测（必做）

分别写 loader：① 查不到返回 null；② 返回 `NOT_FOUND` 哨兵；③ 抛 `RuntimeException`。对不存在的 key 连续 `get` 5 次，记录每次是否回源、是否抛异常。

**参考答案要点**：null → 5 次全回源（不缓存=没防住穿透）；哨兵 → 首次回源后命中缓存 4 次（防住穿透）；抛异常 → 不缓存且异常透传（不能把异常当值缓存）。

## 作业 4：maximumWeight 精确控内存（选做）

用 `maximumWeight(64*1024*1024)` + `weigher((k,v)->v.length)` 缓存变长 value，塞入超量数据，观测堆占用稳定在 64MB 附近、条目数随 value 大小自适应变化。

**参考答案要点**：按"内存权重"而非"条数"限容更真实——大 value 少存、小 value 多存；weigher 必须反映真实堆占用，否则要么浪费要么仍 OOM。

## 作业 5：配置评审（选做）

检查你司 Caffeine 用法：有没有无界缓存、热点是否配了 refresh、loader 返回 null 是否造成穿透、`recordStats` 是否开启、命中率是否有监控告警。产出整改清单。

**参考答案要点**：核心是"有界 + 会刷新 + 防穿透 + 可观测"四件套落地，无界与无刷新是最常见的两类线上雷。
