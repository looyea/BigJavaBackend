# 限流器 / 排行榜 / 附近的人 · 作业题

> 本节作业 3 题：手写一个令牌桶、用 ZSet 做一个带同分排序的排行榜、用 Redis GEO 解决边界问题。

## 作业 1：手写惰性令牌桶（动手）

不用 Guava，用 Java 实现一个进程内令牌桶：

```java
// 例子目的：令牌桶骨架 —— 要求无定时器、请求驱动、惰性计算
class TokenBucket {
    final double rate; final long capacity;
    double tokens; long lastTs;    // 初始 tokens=capacity(允许首波突发)
    synchronized boolean tryAcquire() {
        long now = System.nanoTime();
        double elapsed = (now - lastTs) / 1e9;       // 距上次过了多少秒
        tokens = Math.min(capacity, tokens + elapsed * rate);  // 惰性补算; 结果: 没请求就不补(省 CPU)
        lastTs = now;
        if (tokens >= 1) { tokens--; return true; }   // 输出: true=放行, false=429
        return false;
    }
}
// 反例: 如果起 1ms 定时器往 Redis INCR 令牌 → 定时器漂移 + Redis 写压力 = 双重故障源
```

要求：① 用 100 线程打 rate=10/s、capacity=50 的桶 2 秒，统计放行数 ≤ 50+10×2=70（桶初始满+新增）；② 去掉 synchronized 看会不会超放（思考为什么）；③ 加一个"Redis + Lua 分布式版本"的伪代码方案。

**验收标准**：放行计数日志 + 去掉锁后结果差异说明 + Lua 分布式版伪代码。

## 作业 2：用 ZSet 做排行榜并解决同分坑（动手）

用 Redis 模拟 5 人积分变化，演示同分排序：

1. 用 `ZADD rank 100 playerA` 和 `ZADD rank 100 playerB` 写入同分，观察 `ZREVRANGE` 默认按 member 字典序排——B 在 A 前面（不满足"先到先排"）；
2. 改用编码方案 `score = 分值 * 1e10 + (1e10 - 到达时间戳ms后几位)`，先到者编码分更大；验证同分 100 时先到的 A 排前；
3. 增加日榜拆分：`rank:daily:20260927` 设 TTL 2 天；演示跨日自动新 key、旧 key 过期清理；
4. 加分：用 `ZREVRANK` + `ZREVRANGE` 实现"显示我前后 5 名"（大排名局部分页），贴命令序列。

**交付物**：两次排序对比（默认 vs 编码后）+ 日拆 key/TTL 命令 + "前后 5 名"查询命令序列。

**提示**：考点不是"会 ZADD"，而是同分排序的编码方案——能现场讲清为什么要把时间编进 score、为什么不能另开一个字段。

## 作业 3：Redis GEO 九宫格解决边界问题（动手+设计）

用 Redis GEOADD 往 3 个 GeoHash 相邻桶各插一个点，验证 GEORADIUS 能否查到跨桶点：

1. 在一个点（如经度 116.40, 纬度 39.90）用 GEOADD 存 3 人：一人正下方（同桶）、一人偏东 0.08°（可能跨桶）、一人偏东 0.5°（确定在相邻桶）；
2. 以"正下方那人"为圆心 GEORADIUS 查 5km → 验证三个都能查到（Redis 封装了九宫格）；
3. **不用 GEORADIUS**，改用手工分桶：计算中心点 GeoHash 前缀 → 算相邻 8 格前缀 → 分别用前缀匹配取候选 → 精算 Haversine 过滤 → 验证不漏；
4. 思考：为什么 Redis 用 ZSet 的 score 做 GeoHash 编码而不是存字符串 key？（提示：score 是 double，GeoHash 截断到 52 bit 精度够 + 天然支持范围查询）

**交付物**：三次 GEO 命令序列 + 手工九宫格伪代码 + 一句"为什么用 ZSet 不用 KV"的回答。

**提示**：这题考点是"理解边界问题为什么存在"——不是背"Redis GEORADIUS 能查"，而是知道底层做了什么、自己实现时怎么不退步。
