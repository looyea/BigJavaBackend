# 大 Key、热 Key 与内存治理

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：大 Key 与热 Key 是两码事——**大 Key**（单 key 体积/元素数超限）伤害的是"一次操作的耗时"（单线程 O(n) 命令卡住所有人 + 网络传输 + fork/COW 放大），**热 Key**（单 key QPS 超限）伤害的是"一个分片的容量"（Cluster 下打到单节点）。掌握两类的**发现**（`--bigkeys`/`MEMORY USAGE`/`--hotkeys`(LFU)/客户端与代理统计）与**治理**（拆分、UNLINK 异步删、多副本打散、本地缓存）；内存侧建立 **maxmemory + 8 种淘汰策略**（近似 LRU 采样与 LFU 衰减）、**mem_fragmentation_ratio 与 active defrag**、**KEYS 禁用 SCAN 替**的完整纪律。

## 一、大 Key：单线程的"一将无能累死三军"（★★★★★）

判定线经验值：String >10KB、集合类元素 >5000 或整体 >10MB 就该警惕。危害链条：`GET` 一个 10MB value、`HGETALL` 一个 100 万域 Hash——**单线程执行期间全库排队**（s1-1 编码升级也常由大 value 触发）。

```bash
# 例子目的：不阻塞地发现和度量大 Key
redis-cli --bigkeys                                   # 正确：内部用 SCAN 游标分批扫，报告各类型"最大元素数"（注意它按元素数而非字节数）
redis-cli MEMORY USAGE prod:detail:1001               # 对候选 key 精确量字节（正确：发现与度量分两步；错误用法：对百万 key 逐个 MEMORY USAGE 不加 SAMPLES 限深——本身变成慢命令）
redis-cli --memkeys --count 10000                     # 抽样统计 value 字节分布（滚动巡检用）
redis-cli SLOWLOG GET 10                              # 反向线索：谁是最近最慢命令（一次 HGETALL 120ms 就是典型大 Hash）
# 正确使用结果：产出"TOP 大 Key 清单+大小"，进入治理队列
# 错误用法：KEYS "*prod*" 一把梭找 key → 单线程全库遍历直接卡秒级，线上事故本身（永远用 SCAN/--scan）
```

**治理三板斧**：

- **拆**：大 Hash 按 field 哈希分桶 `user:{id}:shard:{crc(field)%32}`；大 List 切成多段+索引；"全量缓存"改分页（列表只缓存前 N 页）。
- **删**：`UNLINK key` 异步回收（**DEL 大 key 也是 O(n) 同步阻塞**——这是最高频的"清理动作引发事故"）。
- **防**：写入端校验 value 大小（Lettuce/Jedis 拦截器 >10KB 报警）、对象用 Hash 但大字段单拆 key（s1-1 编码升级教训）。

## 二、热 Key：一个 key 打爆一个分片（★★★★★）

秒杀爆款、明星八卦——单 key 数十万 QPS，Cluster 分片也救不了（同 key 同槽）。

```bash
# 例子目的：发现热 Key 与临时止血
redis-cli INFO commandstats | sort -t: -k3 -rn | head   # 按调用次数排命令 TOP（近似热度信号）
redis-cli --hotkeys                                      # 前提 maxmemory-policy=*-lfu：基于 LFU 计数对象返回热 key TOP N（正确：先切 lfu 策略再测）
redis-cli OBJECT FREQ prod:seckill:8888                 # 单 key 访问频率（10 分钟衰减的计数器，正确读数姿势：看相对量级）
# 正确使用结果：定位到 QPS 集中度，触发下面的治理预案
# 错误用法：等监控报警才找热 key —— 大促前就该按榜单/流量预估预热名单（s2-1 checklist）
```

**治理三板斧**：

- **本地缓存**：热点在应用内存里消化（Caffeine 百毫秒级短 TTL + Pub/Sub 失效广播）——终极解。
- **多副本打散**：`key#1..key#N` 写 N 份，读随机选副本（牺牲一致性换 QPS/N，适合可容忍旧的数据）。
- **读写分离/代理缓存**：从库分担读；云 Redis 的 proxy 层热 key 缓存开关。
- 边界提醒：**热 Key 与击穿是孪生问题**（s2-1）——热 key + 过期=击穿风暴，热点数据要么永不过期+后台刷，要么 TTL 加大抖动+互斥重建。

## 三、内存治理：maxmemory、淘汰策略与碎片（★★★★★）

```bash
redis-cli CONFIG SET maxmemory 6gb                      # 上限=物理内存留足余量（错误用法：不配 maxmemory 的纯缓存实例 → 涨到 OOM 被系统 kill，s1-2）
redis-cli CONFIG SET maxmemory-policy allkeys-lru       # 纯缓存选 allkeys-lru；混放锁/计数器的库用 volatile-ttl 或干脆 noeviction+分区隔离
# 八种策略记法：noeviction（默认，写报错）+ allkeys-{lru/lfu/random} + volatile-{lru/lfu/random/ttl}（volatile 多一档 ttl；ttl=优先淘汰剩余 TTL 最短的）
redis-cli CONFIG SET maxmemory-policy noeviction        # 错误用法：缓存库配 noeviction → 满了之后 SET 全部 (error) OOM command not allowed，业务全线写失败
```

- **近似 LRU**：Redis 不维护全量 LRU 链（太贵），随机采样 `maxmemory-samples`(默认5) 个 key 淘汰其中最久未访问者——samples 越大越接近真 LRU 越耗 CPU。
- **LFU 更抗"一次刷屏"**：`OBJECT FREQ` 计数器带 10 分钟衰减，冷启动保护优于 LRU；大版本趋势是缓存场景推荐 lfu。
- **碎片**：`mem_fragmentation_ratio` = 操作系统视角 RSS / 数据视角，**>1.5 警惕**（jemalloc 碎片或换页），**<1 危险**（可能在 swap，延迟会爆炸）。治理：`activedefrag yes`（在线整理，耗一点 CPU）；极端情况重启加载 RDB 自然压实。
- 容量规划：`used_memory` 曲线 × 增长 + fork COW 余量（s1-2）+ 缓冲（replication/output buffer）——留出 30% 水位。

## 四、动手题

1. 造一个 100 万域 Hash，分别 `DEL` 与 `UNLINK`，用 `--latency` 观察主线程卡顿差异。
2. 配 `maxmemory 200mb + allkeys-lru` 灌数到触发淘汰，验证被淘汰的是采样近似 LRU 而非严格 LRU（构造对比样本）。
3. 用 `--hotkeys`（先切 LFU）从 10 万 key 混合流量里揪出你的热点，再用"本地缓存 100ms"压测对比 Redis QPS 压力。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 偶发全实例卡顿数百 ms | 大 Key 的同步 DEL/HGETALL，或 KEYS 巡检 |
| Cluster 某节点带宽/负载独高 | 热 Key 或大 Key 恰好同槽（hash tag 滥用，s1-2） |
| 缓存满后业务写全部报错 | maxmemory-policy=noeviction 配在了缓存库 |
| 内存监控 RSS 远大于 used_memory | 碎片率高，开 activedefrag / 计划内重启压实 |
| 延迟毛刺且 swap 严重 | fragment_ratio<1 在换页——内存超物理上限，扩容或缩容数据 |

## 六、关联技术栈

- **向前**：编码升级阈值决定"什么叫大" ↔ s1-1；fork/COW 与大 key 复制 ↔ s1-2
- **横向**：热 key 的击穿联动 ↔ s2-1；本地缓存失效广播 ↔ s2-2 binlog/事件思路
- **工具**：云厂商离线分析 RDB（rdb --bigkeys 全量精确）、`LATENCY DOCTOR`、Proxy 层统计 ↔ 运维体系

## 七、本节小结

**大 Key 治"宽度"**：发现用 `--bigkeys`/`MEMORY USAGE`/SLOWLOG 反查（禁 KEYS），治理靠**拆桶分页、UNLINK 异步删、写入侧尺寸门禁**——一切 O(n) 同步操作都是单线程之敌。**热 Key 治"集中度"**：LFU `--hotkeys`/代理统计提前圈定，**本地缓存**消化、多副本打散扛量，并与防击穿策略（永不过期+后台刷）成对出现。**内存治理立纪律**：maxmemory 必配且留水位，纯缓存 `allkeys-lru`（或更稳的 lfu）、混放数据分区隔离防 noeviction 误伤，盯 `mem_fragmentation_ratio`（>1.5 上 activedefrag，<1 查 swap）。三类问题的共同底色：**Redis 是单线程共享资源——任何"大"和"集中"都会伤及无辜**，治理靠日常巡检而非事故考古。
