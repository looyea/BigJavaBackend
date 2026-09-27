# 作业题 · 虚拟线程与高并发改造

## 作业 1：开关对比压测（必做）

对一个"聚合调用 3 个下游（各 sleep 200ms）"的 IO 密集接口：

- 分别在 `spring.threads.virtual.enabled=false` 与 `true` 下压测，逐步加压
- 记录 QPS、P99、错误率、承载线程数（`jcmd <pid> Thread.print` 统计 platform 线程数）

**产出**：一张对比表，指出虚拟线程下并发提升而承载线程数几乎不变的现象，并解释 unmount/mount 机制。

## 作业 2：连接池矛盾复现与修复（必做，本节核心）

把 HikariCP `maximum-pool-size` 设为 10，用 1000 并发虚拟线程打一个会查库的接口：

1. 复现连接获取超时（`Connection is not available`）
2. 用 Resilience4j `Bulkhead`（信号量）或显式并发闸门把对该资源的并发限制到合理值，修复
3. 写结论：为什么"线程无限"必须配"资源有限处的并发上限"

**验收标准**：限流后错误率归零、P99 稳定；说明你设的并发数依据（≈连接池大小 × 每连接可复用度）。

## 作业 3：pinning 观测实验（必做）

在某阻塞路径写一段 `synchronized(lock){ Thread.sleep(500); }`，被虚拟线程高频调用：

- 加 `-Djdk.tracePinnedThreads=full` 启动，抓取 pinning 栈
- 改造成 `ReentrantLock` 后重新观测，确认 pinning 消失
- 讨论 JDK 版本对 pinning 的影响（21 vs 24）

## 作业 4：ThreadLocal 审计（选做，架构师向）

审计一个准备上虚拟线程的服务里所有 `ThreadLocal`/`InheritableThreadLocal`/连接-线程绑定点：

1. 列出哪些在"每请求一虚拟线程、数量巨大"下会内存放大或语义错误
2. 给出改造方案（改方法参数传递/结构化并发/ScopedValue）
3. 评估金融交易上下文（如事务 ID、租户 ID）在虚拟线程下的正确传递方式

## 作业 5：灰度上线方案（选做，架构师向）

为一个电商 BFF 设计虚拟线程灰度方案：如何按实例/流量比例灰度、观测哪些指标（承载线程数、pinning 计数、连接池等待、下游错误率）作为回滚触发线、以及"发现是 CPU 密集误判收益"时如何快速回退。
