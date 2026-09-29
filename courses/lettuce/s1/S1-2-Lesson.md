# 连接池、Cluster/Sentinel 与异步/响应式 API

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：给"共享单连接"划出**需要用池/多条连接的边界**（多 EventLoop 分摊、阻塞/事务会话、Spring `POOL` 模式），并会用 commons-pool2 正确配 `GenericObjectPoolConfig`；掌握 **`RedisClusterClient`** 的用法与两大坑（拓扑刷新滞后于 failover、MOVED/ASK 由客户端透明处理）及 **Sentinel 支持**（`RedisURI` 直配 master 名，主从切换自动跟随）；建立 **sync / async(CompletableFuture) / reactive(Reactive Streams)** 三套 API 的心智模型与组合技巧（pipeline 用 async、WebFlux 栈用 reactive）。落点在 Spring Boot 的 `spring.data.redis` 配置项与 Lettuce 参数的对应关系。

## 一、什么时候真的需要"池"（★★★★☆）

共享单连接是默认答案，但四类场景要加连接（或启用池）：

1. **单 EventLoop 成瓶颈**：万级 QPS 时一条连接的读写线程饱和 → 多开几条连接让它们落在不同 EventLoop；
2. **阻塞命令/事务/订阅**：会独占连接时序（s1-1）→ 专用连接或池；
3. **Spring Data Redis 高级 API**：`LettuceConnectionFactory` 默认 MUX，`shareNativeConnection=false` 或 POOL 模式走 commons-pool2；
4. **隔离需求**：核心链路与跑批链路分连接，防互相拖累。

```yaml
# 例子目的：Spring Boot 中 Lettuce 池的标准配置（对应 GenericObjectPoolConfig）
spring:
  data:
    redis:
      lettuce:
        pool:
          max-active: 32      # 池上限（正确：≈峰值并发÷单连接可复用度，别无脑对齐线程数；错误用法：max-wait 不设=-1 → 池满时业务线程无限排队，雪崩无超时兜底）
          max-wait: 200ms     # 借连接最长等待，超时抛异常快速失败（正确：让"池满"变成可见的超时而非无声排队）
          time-between-eviction-runs: 30s   # 空闲检测周期（配合 testWhileIdle 保活）
```

> 判据一句话：**先证明单连接是瓶颈再加池**——池把 Lettuce 的连接经济优势往 Jedis 方向退了回去，每一层复杂度都要有数据支撑。

## 二、Cluster 与 Sentinel：拓扑感知是生命线（★★★★☆）

```java
// 例子目的：RedisClusterClient 连 Cluster 并开启自适应拓扑刷新（failover/扩容后不"瞎"）
RedisClusterClient client = RedisClusterClient.create(resources,
        RedisURI.builder().withClusterAuth("pwd".toCharArray())
                .withSeeds(RedisURI.create("redis://10.0.0.1:7001"), RedisURI.create("redis://10.0.0.2:7002")) // 种子节点只需部分（正确：客户端自动发现全量节点与槽表）
                .withTimeout(Duration.ofMillis(500)).build());
client.setOptions(ClusterClientOptions.builder()
        .validateTopologyOnRedirect(true)      // 收到 MOVED 即校验拓扑（正确：failover 后秒级收敛）
        .adaptiveRefreshConfig(AdaptiveRefreshTrigger.MOVED_OR_ASK_REDIR)  // 按重定向触发后台刷新（正确使用结果：扩缩容/切主无需重启应用）
        .build());
AutoCloseableRedisClusterCommands<String, String> cmd = client.connect().sync();
cmd.get("user:1");                              // 槽位定位、MOVED/ASK 重试全由客户端透明处理（错误用法：手写按节点分发 + 把 Cluster 当单机 JedisCluster 老 API 那样忽略拓扑刷新 → 切主后长期连旧主报错）
```

- **Sentinel**：`RedisURI.builder().withSentinel("host:26379").withSentinelMasterId("mymaster")`——客户端订阅哨兵频道，主从切换**自动跟随新主**，无需池也无需自研监听。
- 大坑清单：拓扑刷新有周期（默认 60s），**failover 敏感期务必开 adaptive refresh**；`Pub/Sub` 与多 key 操作跨槽限制记得回查 redis s1-2。

## 三、三套 API 与 pipeline 的正确姿势（★★★★☆）

| API | 返回 | 适用 |
| --- | --- | --- |
| `sync()` | 直接值（内部等 Future） | 常规业务，代码最简 |
| `async()` | `RedisFuture`(CompletableFuture) | **pipeline/批量**、编排 `allOf` |
| `reactive()` | `Flux`/`Mono` | WebFlux/Reactor 栈全链路非阻塞 |

```java
// 例子目的：async 批量管道——1000 个 GET 一次网络往返
RedisAsyncCommands<String, String> a = conn.async();
a.autoFlushCommands(false);                     // 关自动刷写：命令先攒在出站队列（正确：攒够一批再整体 flush，才有流水线收益）
List<RedisFuture<String>> fs = new ArrayList<>();
for (String key : keys) fs.add(a.get(key));     // 逐条入队不等待（此时未发出，零阻塞）
a.flushCommands();                              // 一次性写出去（正确使用结果：1000 个命令 1 次 RTT + Redis 顺序执行，总耗时≈单次命令+传输）
String v = fs.get(0).get(200, MILLISECONDS);    // 统一收 Future（错误用法：autoFlush 不开关也不批量、循环里逐个 future.get() → 每条都等 RTT，pipeline 形同虚设还多了队列开销）
```

> reactive 版一行流：`reactive.mget(keys).publishOn(Schedulers.boundedElastic())`——回调重活切出 IO 线程的纪律在三套 API 里同构（netty s3-1）。`MGET`/Lua 能解决的批量优先用它们，pipeline 是补齐手段。

## 四、动手题

1. 用 Lettuce 直连 3 主 3 从 Cluster，kill 一个主触发 failover，比较开/关 adaptiveRefresh 时业务报错持续时长。
2. 同一批 1000 个 GET：sync 逐个、async 自动刷、async+autoFlush(false)+手动 flush 三版压测，记录耗时（预期 1000 RTT / 1000 RTT / ~1 RTT）。
3. 配 Sentinel 后 `kill -9` 主库，观察 Lettuce 客户端日志中的 master 切换跟随过程。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| failover 后持续连旧主报错数十秒 | 未开 validateTopologyOnRedirect/adaptive refresh，槽表过期 |
| 开了 pool 后吞吐反而降 | MUX 本就够用，池借还开销+maxTotal 过小排队 |
| 借连接超时 `Timeout waiting for idle object` | max-wait 生效（好事），根因是慢命令占池或 max-active 不足 |
| pipeline 版比逐个 get 还慢 | 忘关 autoFlush 或每命令 get() 等待，白担队列开销 |
| reactive 链路偶发全停 | 回调里跑阻塞代码占死 IO 线程（同 netty 纪律） |

## 六、关联技术栈

- **向前**：共享连接模型与失配场景 ↔ s1-1；Cluster 槽/MOVED/ASK 服务端协议 ↔ redis s1-2
- **向后**：Redisson 直接复用 Lettuce 底层的思路 ↔ s1-3
- **横向**：Reactor/WebFlux ↔ spring-webflux；pipeline vs MGET/Lua ↔ redis s2

## 七、本节小结

池在 Lettuce 里是**例外而非默认**：先证明单连接 EventLoop 饱和或存在阻塞/事务会话，再上 `POOL`/多连接，且 `max-wait` 必须配——把"池满"变成可见超时而不是无声排队。Cluster/Sentinel 的胜负手是**拓扑感知**：种子节点起步、槽表自动发现、`MOVED` 触发 adaptive refresh，failover 收敛从分钟级压到秒级。三套 API 各司其职：sync 写业务、async 做 pipeline（`autoFlush(false)`+攒批+`flushCommands` 三件套才有 RTT 收益）、reactive 进响应式栈；共同的底层纪律仍是**别在 IO 线程干重活**。下一节给 Lettuce 与 Redisson 划清定位边界。
