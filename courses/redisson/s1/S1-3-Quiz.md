# 小测验 · 布隆过滤器、限流器与 RMapCache

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. `RBloomFilter.contains(id)` 返回 false 意味着？（15分）

- A. 元素一定不存在
- B. 元素可能不存在
- C. 元素一定存在
- D. 布隆过滤器已满

> 答案：A
> 解析：布隆"判无一定无、判有可能有（假阳性）"。返回 false 可放心直接返回空、不打 DB——这正是挡穿透的依据。

### 2. 要用 Redisson 限制"整个集群某接口每秒最多 100 次"，应选？（15分）

- A. RSemaphore(100)
- B. RRateLimiter 且 RateType.OVERALL，rate=100/秒
- C. RRateLimiter 且 RateType.PER_CLIENT，rate=100/秒
- D. RLock 串行化

> 答案：B
> 解析：限**速率**用 RRateLimiter，且必须 OVERALL（跨节点合计）；PER_CLIENT 只限单节点，多副本总速率=100×副本数形同没限。RSemaphore 限的是并发数不是速率。

### 3. 【多选】关于 RMapCache 与 RMap，正确的有？（20分）

- A. RMapCache 支持每个条目独立 TTL，RMap 不支持 per-entry 过期
- B. RMapCache 可开启 near-cache 本地缓存加速读
- C. 别的节点绕过 Redisson 直接改 Redis，RMapCache 本地缓存仍能即时感知
- D. 二者在 Cluster 下多 key 操作都受槽约束

> 答案：ABD
> 解析：C 错——RMapCache 本地缓存一致性靠 Redisson 自身的发布订阅失效广播，旁路直写不会触发失效 → 本地读到脏值。ABD 正确。

### 4. 判断：商品下架后可以用 `RBloomFilter.remove(id)` 把它从布隆里删掉。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：标准布隆的位被多元素共享，不支持删除；下架只能靠"DB 查不到→空值短 TTL 缓存"兜底，或用 Counting Bloom/定期重建。

### 5. 填空题：`RRateLimiter` 是 ______ 桶模型，限的是 ______（速率/并发数）；`RSemaphore` 限的是 ______（速率/并发数）。（20分）

> 答案：令牌 / 速率 / 并发数

### 6. 缓存穿透防护里，布隆过滤器已能挡"必不存在"，为什么还要配"空值缓存"？（20分）

> 参考答案：
> - 布隆有假阳性：判"有"的元素里那部分实际不存在的（如 3% 误判）仍会穿透到 DB → 用空值缓存把这批兜住
> - 布隆不能删：已下架/删除的数据位仍在，永远判"有"放行 → 靠空值短 TTL 覆盖
> - 首次冷启动/集合外新 key：布隆未包含但确需放行的边界，也靠空值 + 正常回源流程
> - 收口：布隆挡"量"（大头穿透），空值缓存兜"例外"（假阳性+删除），二者叠加才闭环
