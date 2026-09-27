# 作业题 · 五大类型与底层编码

> 作业不判分，做完对照参考答案自查。需要本地 redis-server 7.x + redis-cli。

## 作业 1：编码升级线全复现（必做）

依次验证并记录 `OBJECT ENCODING` 结果：① `SET k 123` → int；② 44B / 45B 字符串 → embstr / raw；③ Hash 连加 513 个域 → listpack→hashtable；④ Set 连加 17 个整数 → intset 升级。

注释说明：每条升级线的阈值名称，以及"只升不降"在你的结果里如何体现（删到很少后 encoding 变了吗？）。

## 作业 2：Hash 聚合 vs 平铺 String 的内存实测（必做）

```bash
# 例子目的：对比“多域 Hash 聚合”与“每字段一个 String 平铺”的总内存
redis-cli -n 9 EVAL "for i=1,10000 do redis.call('HSET','h:'..i,'f1','v','f2','v','f3','v') end" 0
redis-cli -n 9 EVAL "for i=1,10000 do for j=1,3 do redis.call('SET','s:'..i..':'..j,'v') end end" 0
redis-cli DEBUG SET-ACTIVE-EXPIRE 0   # 冻结惰性/定期清理便于对比（正确：测完记得恢复为 1；错误用法：忘恢复影响后续实验）
redis-cli DBSIZE; redis-cli INFO memory | grep used_memory_human   # 对比两种写入方式的总内存
```

注释贴出两组内存数字与倍数，解释"每 key 固定开销"从哪来。

**参考答案要点**：平铺版每 key 独立 dictEntry+SDS+expire 对象，总内存约为聚合版的 3~5 倍。

## 作业 3：跳表范围查询体验（必做）

造 10 万元素 zset（分数=时间戳），分别计时 `ZSCORE`、`ZRANGE 0 99`、`ZRANGEBYSCORE` 取 1 万条。

注释解释：为什么 ZSCORE 与范围查询都快（双结构）、大结果集为什么慢（网络与单线程序列化）。

## 作业 4：观察渐进式 rehash（选做）

`redis-cli --latency-history` 挂着，同时百万 key 持续写入，观察延迟毛刺与 `INFO` 里是否出现 rehash 相关抖动；用 `DEBUG SLOWLOG`/slowlog get 找最慢命令。

**参考答案要点**：rehash 被切碎后单请求只多"搬一桶"成本；若桶内链很长（哈希冲突）单桶成本上升，表现为零星毛刺而非长停顿——正是渐进式设计要避免的形态。

## 作业 5：类型选型清单（选做）

为下列场景选型并注释理由：① 直播间在线用户去重集合；② 商品详情对象缓存；③ 双十一实时销售额排行；④ 用户未读消息队列；⑤ 接口秒级限流计数。

**参考答案要点**：① Set（SADD 天然去重）；② Hash（字段级更新）；③ Zset（INCRBY+ZREVRANGE）；④ Stream（消费组/ACK；简单场景 List LPUSH/BRPOP）；⑤ String INCR+EXPIRE（int 编码零成本）。
