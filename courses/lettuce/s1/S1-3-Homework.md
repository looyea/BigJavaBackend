# 作业题 · Lettuce 与 Redisson 的定位与选型（关联）

> 作业不判分，做完对照参考答案自查。需要一个 Maven 工程同时引入 `spring-boot-starter-data-redis`（Lettuce）与 `redisson-spring-boot-starter`，连同一台 Redis。

## 作业 1：防超卖三写法对比（必做）

```java
// 例子目的：库存 stock=100，200 并发各抢 1，用三种写法实现，看谁超卖
// 写法A（错误基线）：Lettuce 裸命令 先 GET 判断>0 再 DECR            // 预期超卖：两命令间被并发插入，最终库存可能为负
// 写法B：Lettuce 一段 Lua（GET 判断 + DECRBY 合并原子执行）          // 正确：无超卖，返回 -1 计数=失败请求数
// 写法C：Redisson RSemaphore(100).tryAcquire()                       // 正确：许可模型天然防超卖，代码最短
```

注释贴三者**最终库存值 + 成功请求数**，验证 A 超卖、B/C=100。

## 作业 2：手写锁 vs Redisson RLock（必做）

用 Lettuce 手写 `SET key uuid NX PX 3000` 加锁 + Lua 按值释放，实现"重入"和"业务超时后锁自动续期"两个需求，记录你为补齐这俩特性写的代码量；再换 Redisson `RLock.lock()` 对比。

**参考答案要点**：手搓重入要自己维护计数器+哈希结构、续期要自己起线程看门狗——这就是 Redisson 存在的理由；理解成本从"框架黑盒"变成"我知道它内部干了这些"。

## 作业 3：混用编码陷阱复现（选做）

用 Redisson `RMap<String,Integer>` 写入 key `m`，再用 Lettuce `hget("m", ...)` 裸读，观察乱码/类型错误；再把 Redisson 编码器换成 `StringCodec` 复测互通。

**参考答案要点**：Redisson 默认用自定义二进制/Jackson 编码，Lettuce 侧是裸字符串——跨客户端共享 key 必须统一编解码，否则互相读不懂（呼应课文第五节）。

## 作业 4：RBloomFilter 落地防穿透（必做）

给商品 ID 全集（1000 万）构建 Redisson `RBloomFilter`（误判率 1%），压测：查不存在的 ID 时，加布隆前后打到 DB 的请求数对比。

**参考答案要点**：布隆把"必不存在的穿透查询"在 Redis 层挡掉，DB 命中数从≈穿透量降到≈假阳性漏过量（1%）；记得讲"判有不可全信、判无一定无"（redis s2-1）。

## 作业 5：技术选型备忘（选做）

给你负责的服务写一页"Redis 客户端分工说明"：哪些场景走 Spring Data/Lettuce、哪些必须走 Redisson、连接资源如何核算、编码如何统一。交组长评审。

**参考答案要点**：体现"分层共存"认知，避免团队出现"要么全 Lettuce 手搓、要么全 Redisson"的两个极端。
