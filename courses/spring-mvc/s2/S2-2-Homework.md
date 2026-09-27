# 作业题 · WebFlux 与响应式编程

## 作业 1：惰性与订阅（必做）

写 `Flux<Integer> f = Flux.just(1,2,3).map(i -> i*10).doOnNext(System.out::println);`：

- 只声明不订阅，观察无任何输出
- 分别用 `.subscribe()`、`.blockLast()` 触发，观察执行
- 总结"算子链=描述、订阅=执行"的心智模型

**产出**：三行代码差异说明 + 你对"冷流每次订阅重放"的观察。

## 作业 2：阻塞调用毒化实验（必做，本节核心）

在一个 WebFlux 接口里：

1. 正常用 `WebClient` 非阻塞调下游，测吞吐
2. 偷偷把其中一次调用换成同步阻塞（`Thread.sleep(500)` 或同步 JDBC），对比 event-loop 线程被占死后的吞吐塌陷
3. 引入 `BlockHound.install()`，让它直接抛出"在 non-blocking 线程上阻塞"的定位栈
4. 改回 `Schedulers.boundedElastic()` 包裹阻塞调用，验证恢复

**验收标准**：给出改造前后 QPS/P99 对比，解释为什么一处阻塞毁掉整条非阻塞链。

## 作业 3：背压观测（必做）

构造一个快速 `Flux.range(1, 1_000_000)` 接一个慢消费者：

- 不用背压控制时观察内存/消费情况
- 加 `limitRate(100)` 或用 `onBackpressureBuffer/Drop` 策略，观察上游按 `request(n)` 分批下发
- 说明无界 `collectList()` 在有界数据流上的 OOM 风险

## 作业 4：flatMap 聚合下游（选做，架构师向）

用 `WebClient` + `flatMap` 并发聚合 3 个下游（订单/库存/风控）结果成一个响应：

- 用 `flatMap` 并发发起、`zip`/`merge` 组合
- 给每个下游设 `timeout` + `onErrorResume` 降级
- 讨论 `flatMap(concurrency)` 参数对下游并发的限制意义

## 作业 5：响应式 vs 虚拟线程选型报告（选做，架构师向）

为一个"新建电力实时告警网关（超高并发 IO、流式）"和一个"存量电商订单中台（阻塞 JDBC/MyBatis 生态）"分别给出模型选型：哪个上 WebFlux、哪个上虚拟线程，列出依据（生态阻塞传染性、团队能力、背压需求、迁移成本），并说明为什么不应盲目把存量中台改造成响应式。
