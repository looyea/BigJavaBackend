# 小测验 · W-TinyLFU 与失效策略

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. W-TinyLFU 相比纯 LRU 最大的改进是？（15分）

- A. 访问更快
- B. 用频率信息（Count-Min Sketch）做准入，能抗一次性扫描对热点的污染
- C. 不需要设容量
- D. 支持持久化

> 答案：B
> 解析：纯 LRU 会被大批"只用一次"的 key 冲掉热点；W-TinyLFU 靠近似频率判断新元素能否进主区，低频扫描被挡在门外，命中率更高。

### 2. `refreshAfterWrite` 与 `expireAfterWrite` 的关键差别是？（15分）

- A. 没差别，只是时间不同
- B. refresh 到期后首次访问返回旧值并后台异步刷新；expire 到期后条目失效需同步回源等待
- C. refresh 会删数据，expire 不会
- D. expire 用于写、refresh 用于读

> 答案：B
> 解析：refresh 有旧值兜底、读不阻塞、天然防回源风暴；expire 到期即失效，下次 get 同步加载会阻塞当前线程。热点宜 refresh<expire 组合。

### 3. 【多选】关于 Caffeine 配置与 loader 语义，正确的有？（20分）

- A. 不设 maximumSize/maximumWeight 的无界缓存可能吃满堆引发 FullGC/OOM
- B. loader 返回 null 时该结果不被缓存，下次仍回源
- C. 要缓存"确实不存在"应存哨兵对象而非 null，才能防穿透
- D. 同一 key 并发 miss 时，每个线程都会各自回源一次

> 答案：ABC
> 解析：D 错——Caffeine 对同 key 的并发加载会合并，只有一个线程回源、其余等待其结果（这本身就是一种防击穿）。ABC 均正确。

### 4. 判断：过期（expiration）和淘汰（eviction）是同一回事。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：过期是"到时间逻辑失效"，淘汰是"超容量按 W-TinyLFU 踢出腾内存"，触发条件与目的都不同，是三条独立机制（还有刷新）之二。

### 5. 填空题：W-TinyLFU 由约 1% 容量的 ______ 窗口 + 99% 的 Segmented-LRU 主区（分 Probation 与 ______）组成，并用 ______ 近似统计频率做准入。（20分）

> 答案：Window（TinyLFU 准入窗） / Protected（保护区） / Count-Min Sketch（CMS）

### 6. 一个热点商品缓存"过期瞬间 DB 被打爆"，用本课哪些手段组合解决？（20分）

> 参考答案：
> - 配 `refreshAfterWrite` < `expireAfterWrite`：到期访问先返回旧值 + 后台异步刷新，避免大批线程同时同步回源（防击穿/回源风暴）
> - Caffeine 对同 key 并发加载合并，只一个线程回源
> - 容量设 `maximumSize` 上限避免淘汰抖动，`recordStats` 观测命中率与加载耗时
> - 若要防穿透（查不存在），loader 用哨兵缓存空值；根本再叠加 Redis 二级 + 互斥重建（redis s2-1）
