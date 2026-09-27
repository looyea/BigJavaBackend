# 作业题 · Lettuce 架构与 Jedis 的本质差异

> 作业不判分，做完对照参考答案自查。需要本地 Redis + Maven 工程（同时引入 jedis、lettuce-core 依赖）。

## 作业 1：连接数对比实测（必做）

```java
// 例子目的：200 线程各做 1 万次 GET，分别用 JedisPool 与 Lettuce 共享连接，观察 TCP 连接数
// Jedis 侧：new JedisPool(config, host, 6379, 2000) 默认 maxTotal=8 → 先原样跑（错误用法预期：borrow 排队、P99 飙升甚至超时）
//          把 maxTotal 调到 200 再跑（正确：连接数≈线程数，ss -tnp 数一下）
// Lettuce 侧：client.connect() 一条连接全局共用，200 线程直接 conn.sync().get("k")
//            观察结果：ss -tnp 里应用进程到 6379 只有 1 条 ESTABLISHED（正确使用结果：吞吐不降、连接数 1）
```

注释贴出两种配置的 **P99、总耗时、ESTABLISHED 连接数** 三元组。

**参考答案要点**：Jedis 用连接换并发（资源 O(线程)）；Lettuce 用协议层复用换并发（O(1)），前提是命令都短小不阻塞。

## 作业 2：阻塞命令连坐实验（必做）

在 Lettuce 共享连接上开一个线程执行 `blpop("q", 10)`（10 秒超时），其余 50 线程同时 GET。记录 GET 的延迟分布；再为 blpop 拆一条专用连接复测。

注释说明：为什么 50 个 GET 会被一个 blpop 卡住（同连接响应序被占），以及这如何印证"失配场景要拆连接"。

## 作业 3：回调线程纪律（必做）

用 async API：`conn.async().get("k").thenApply(v -> heavy(v))`，heavy 睡 50ms。对比 heavy 跑在默认（IO）线程与 `eventExecutorGroup` 上的**同连接其它请求**的 P99。

**参考答案要点**：IO 线程被 heavy 占住时，该 EventLoop 上**所有连接**的读写都排队（netty s3-1 教训的 Lettuce 版）；切线程池后互不影响。

## 作业 4：Jedis 资源泄漏复现（选做）

写一段不用 try-with-resources 的 Jedis 代码（getResource 后异常路径不 close），压 5 分钟直到池耗尽，读报错原文。

**参考答案要点**：`JedisExhaustedPoolException`/`Could not get a resource`；`Jedis` 的 close 是"归还"不是"关闭"，漏还=池慢性泄漏——Lettuce 共享连接模型从根上消灭这类事故。

## 作业 5：选型评审文档（选做）

给自己的服务写半页客户端选型结论：并发形态（短命令/管道/事务/阻塞）、Spring 栈、是否响应式 → 选 Lettuce 还是 Jedis，列出两条"选它的代价"。

**参考答案要点**：没有全赢方案——Jedis 胜在直观、老项目迁移成本低；Lettuce 胜在连接经济与现代 API，代价是线程纪律与阻塞场景拆连接的复杂度。
