# 五大类型与底层编码

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：理解 Redis "同一种类型、多种底层编码"的**双层设计**——对外是 String / List / Hash / Set / Zset 五种类型，对内按数据规模在**紧凑编码（ziplist/listpack/intset）与通用编码（hashtable/skiplist/quicklist）**之间自动切换；掌握 **SDS** 相比 C 字符串的 O(1) 长度与预分配、**listpack 消灭连锁更新**、**zset 为什么用跳表**、**dict 双表 + 渐进式 rehash** 如何避免单次大停顿。这是理解后文大 Key（s2-3）、持久化内存尖峰（s1-2）的地基。

## 一、双层设计：类型是门面，编码是引擎（★★★☆☆）

Redis 对每个 key 额外维护"当前编码"，小数据用**内存紧凑的连续布局**（缓存友好、省内存），超过阈值自动升级为大容量编码——且**只升不降**。选型的第一性原理：Redis 单线程，任何 O(n) 重整都要防"大停顿"。

```bash
# 例子目的：用 OBJECT ENCODING / TYPE 看清"同一类型的两种编码"分界线
redis-cli HSET user:1 name "tom" age 20          # 新建小哈希（写入 2 个域，当前用 listpack 紧凑编码）
redis-cli OBJECT ENCODING user:1                 # 返回 listpack（正确：小规模下省内存、遍历连续缓存友好）
redis-cli HSET user:1 $(for i in $(seq 1 600); do echo -n "f$i v$i "; done)
redis-cli OBJECT ENCODING user:1                 # 返回 hashtable（域数越过 hash-max-listpack-entries=512 自动升级）
# 正确使用结果：亲眼看到 listpack→hashtable 单向升级；升回去是不存在的（ziplist 时代曾允许降级，已废除）
# 错误用法：拿 OBJECT ENCODING 当容量规划唯一依据 → 编码相同不代表大小相同，一个大 value 的 listpack 照样是大 Key（要配 MEMORY USAGE）
```

## 二、String 与 SDS：int / embstr / raw（★★★☆☆）

Redis 不直接用 C 字符串，而是自研 **SDS**：头部记录 `len`（O(1) 取长度、二进制安全可存 `\0` 字节流）+ **预分配**（<1MB 翻倍、≥1MB 每次加 1MB，减少追加时的 realloc）。

- **int**：能被long表示的整数直接存整数（计数场景零开销）。
- **embstr**：≤44 字节，SDS+对象一次分配、只读时整块缓存友好。
- **raw**：>44 字节，两次分配；`APPEND` 会先把 embstr 转 raw（**不会转回**）。

```bash
# 例子目的：验证 44 字节分界与 append 引发的编码升级
redis-cli SET k1 hello                              # 数字以外的短字符串
redis-cli OBJECT ENCODING k1                        # embstr（≤44B，一次内存分配）
redis-cli APPEND k1 $(python3 -c "print('x'*40)")   # 追加后总长 45B 越界
redis-cli OBJECT ENCODING k1                        # raw（正确观察：embstr→raw 单向升级）
# 正确使用结果：明白 INCR 计数器始终 int 编码，几乎零内存成本——这是"用 String 做计数/限流"的底层依据
# 错误用法：把大 JSON 塞进单个 String 反复 APPEND → raw 每次扩容 realloc + memmove，且整体成为大 Key（s2-3）
```

## 三、List：quicklist = 双向链表串起 listpack 节点（★★★☆☆）

List 的编码是 **quicklist**：外层双向链表，每个节点内部是一个 **listpack**（7.0 前是 ziplist）。兼得两者优点——两端推拉 O(1)、节点内连续省内存，节点大小由 `list-max-listpack-size`（默认 128 元素）控制。

**listpack 取代 ziplist 的原因**：ziplist 每个条目存"前一条目长度"，前一条目变长会级联触发后续重编码——**连锁更新**最坏 O(n²)；listpack 每项只存**自身长度**（最多 1 字节回存），从根上消灭连锁更新。

## 四、Hash：listpack ↔ hashtable 与 field 命名学问（★★★★☆）

- 域数 ≤ `hash-max-listpack-entries`(512) 且每个值 ≤ `hash-max-listpack-value`(64B) → **listpack**；任一越界 → **hashtable**（真正的 dict，每个 value 独立 SDS）。
- 工程含义：同一类 Hash 若混入一个超大 value，整 key 升级为 hashtable，内存开销陡增。

```bash
# 例子目的：用 Hash 存对象时控制 value 大小，避免无谓的编码升级
redis-cli HSET cfg:app timeout 30 retry 2        # 两个小值，保持 listpack（正确：对象缓存首选 Hash 而非大 JSON String）
redis-cli HSET cfg:app html "<20KB 页面模板>"     # 单值超 64B → 整个 key 升级 hashtable（后果：内存碎片与指针开销上升）
# 正确使用结果：小而多的字段用 Hash 聚在一起（省掉每 key 约 60B 的 dictEntry+SDS 固定开销，官方文档实测省一个数量级）
# 错误用法：把"用户详情大 JSON"塞一个 String 而不拆 Hash → 改一个字段也要读写整个 JSON，还无法字段级过期与并发更新
```

## 五、Set：intset / listpack / hashtable（★★★☆☆）

全整数且 ≤16 个 → **intset**（有序整数数组，二分查找）；否则 listpack → hashtable（7.2 引入 **Fast Set**：全整数时底层仍用 hash-table-of-listpack 省内存）。典型应用：标签、共同好友、抽奖去重；`SINTER/SUNION/SDIFF` 在集合大小时代价线性。

## 六、Zset：listpack + skiplist，为什么是跳表（★★★★☆）

元素少且短用 listpack；否则 **skiplist + dict 双结构**：跳表管按分数范围操作，dict 管 O(1) 按成员查分数——`ZSCORE` 与 `ZRANGEBYSCORE` 都快。

**为什么不用红黑树**：① 范围查询（排行榜取第 10~20 名）在跳表上找到起点后**顺链表走**即可，红黑树要中序遍历；② 实现简单、调试成本低；③ 并发修改（将来多线程场景）链表旋转少；跳表平均 O(log n) 与红黑树同级。

## 七、dict 与渐进式 rehash：单线程的自救（★★★★★，高频考点）

Redis 的 dict 持有**两张哈希表**：ht[0] 存数据，扩容时分配 ht[1]（≥ UsedSize*2 的最小 2^n），**不一次性搬完**——之后每次对 dict 的读写/定时任务都顺手搬 `ht[0]` 的一个桶（`rehashidx` 记录进度），搬完前查询要两张表都看。

```flow
渐进式 rehash（目的：把 O(n) 大搬迁切碎，避免单线程一次卡几百毫秒）
普通请求进来 → ①按 rehashidx 搬 ht[0] 的一个桶到 ht[1] → ②再执行本次请求
      ... 每次请求搬一点，n 个桶约 n 次请求搬完 ...
搬完 → ht[1] 转正为 ht[0]，释放旧表（期间 SET 只写 ht[1]、DICT_REHASH 禁 SAVE 防复制风暴）
```

> 对比 JDK：同为"切碎扩容"，但 **JDK HashMap 一次 resize 单线程搬完**（并发容器 ConcurrentHashMap 才是协助式迁移）；Redis 与 JDK 的 diff 是面试高频题。

## 八、动手题

1. 用 `OBJECT ENCODING` 复现本节四条升级线：embstr→raw、listpack→hashtable、intset 三档扩容（16/512/4096 个整数）。
2. 造一个 100 万元素的 list，`DEBUG SLOWLOG`/`LATENCY` 观察大 key 操作延迟；再拆成 100 个小 key 对比。
3. 读写压测下抓 `INFO` 的 `keyspace_hits/misses`，为 s2-1 缓存命中率分析准备数据。

## 九、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 一个 Hash 内存暴涨 | 单值超 64B 触发 listpack→hashtable 整 key 升级 |
| 偶发几百 ms 卡顿 | 大 dict 渐进 rehash 每请求搬一桶变贵（桶内链长）+ 正在落盘 |
| 排行榜 ZRANGE 变慢 | 不是编码问题，是一次取出的元素太多（LIMIT 0,100000）——范围应分页取 |
| 队列 LPOP 快但 LRANGE 全量慢 | 误把 list 当队列又全量遍历，quicklist 遍历 O(n) |
| 存了 `\0` 的二进制乱码担忧 | 无此问题：SDS 二进制安全，按 len 而非 \0 定界 |

## 十、关联技术栈

- **向后**：编码决定内存形态 ↔ s2-3 大 Key 治理；rehash/大 value 复制 ↔ s1-2 持久化与主从
- **横向**：zset 跳表 ↔ data-algorithms s3 跳表；dict 渐进 rehash ↔ JDK HashMap/CHM 对比（java-basics 集合）
- **应用**：类型选型（对象用 Hash、排行用 Zset、去重用 Set、队列用 Stream/List）贯穿 s2 全部缓存课题

## 十一、本节小结

Redis 五类型是**门面**，底层编码随规模**单向升级**：String 在 int/embstr/raw 间切换（44B 分界、SDS 预分配二进制安全）；List 用 quicklist 串 listpack（listpack 以"只存自身长度"消灭 ziplist 连锁更新）；Hash 在 listpack/hashtable 间切换（512 域、64B 值双阈值）；Set 走 intset→hashtable（7.2 Fast Set）；Zset 用 listpack + **跳表+dict 双结构**（跳表胜在范围查询顺链而走、实现简单）。dict 的**渐进式 rehash** 把 O(n) 搬迁摊进每次请求，是单线程模型防大停顿的自救——与 JDK HashMap 一次性 resize 的差异是必考对比题。懂编码，才谈得上治理大 Key 与内存。
