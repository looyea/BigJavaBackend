# 虚拟线程与高并发改造

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：说得清虚拟线程解决的到底是什么问题；知道 Boot 3.2+ 一行开关背后改了哪些平台的默认线程模型；能判断你的服务开虚拟线程是收益还是坑（尤其 DB 连接池与 `synchronized`）。

## 一、为什么需要虚拟线程：把"线程不够"变成"线程不值钱"

传统平台线程（platform thread）与 OS 线程 1:1，昂贵、数量有限。高并发 IO 密集服务里，**线程 99% 时间在阻塞等待**（等 DB、等 RPC、等下游），却要占着宝贵的 OS 线程。为突破上限，业界用了异步/响应式（WebFlux）——性能好但代码被"传染性 async"污染，调试难。

虚拟线程（Project Loom，JDK 21 正式）是第三条路：

- 由 JVM 调度的**轻量级用户态线程**，一个承载线程（carrier）可跑成千上万个虚拟线程；阻塞时虚拟线程从 carrier 卸载（unmount），承载线程去跑别的。
- **写法仍是同步阻塞风格**，但吞吐接近异步——"一个请求一个线程"模型重新变得可行且划算。

```flow
请求到达 → 分配虚拟线程处理 → 遇到 IO 阻塞（DB/RPC）
→ 虚拟线程从承载线程 unmount、挂起 → 承载线程转去执行其他就绪虚拟线程
→ IO 就绪 → 虚拟线程重新 mount 到（可能不同的）承载线程继续
```

## 二、Boot 3.2+ 的一行开关到底改了什么

```yaml
# 例子目的：一行开关把 Web/Async/调度等默认执行器切为虚拟线程
spring:
  threads:
    virtual:
      enabled: true     # 每请求一个虚拟线程，server.tomcat.threads.* 基本失去意义
# 正确使用结果：IO 密集服务用同步代码拿到接近异步的吞吐，承载线程数几乎不变
# 错误用法：CPU 密集服务也开→ 无收益甚至因调度开销变慢
```

开启后 Boot 做的**不只是一个线程池**：

1. **Web 容器**：Tomcat/Jetty 的请求处理改用虚拟线程（每请求一个虚拟线程），`server.tomcat.threads.*` 基本失去意义。
2. **`@Async` / TaskExecutor**：默认 `SimpleAsyncTaskExecutor` 语义变为"每次新建虚拟线程"，不再池化平台线程。
3. **调度、消息监听等**框架内执行器也尽可能切到虚拟线程。

> 关键认知：开关是"平台级默认线程模型"的切换，不是给你某个业务方法单独加个池。要不要精细化控制，取决于下面这些边界。

## 三、什么时候是坑：三类必须警惕的场景

| 场景 | 问题 | 应对 |
| --- | --- | --- |
| 数据库/HTTP 连接池 | 虚拟线程可开到几万，但连接池只有几十；瞬时并发把池打满、排队超时 | 限流或用信号量约束并发度，别让无限虚拟线程冲垮有限资源 |
| `synchronized` 钉住（pinning） | 虚拟线程在 `synchronized` 块内阻塞会**钉住承载线程**，退化成占用 OS 线程 | 热点阻塞路径改用 `ReentrantLock`；JDK 24 已大幅改善 pinning |
| ThreadLocal 大量使用 | 虚拟线程海量，`ThreadLocal`（如某些上下文/连接绑定）内存放大 | 慎用、及时清理；优先结构化并发传参 |

**收益判断**：CPU 密集型（计算、序列化为主）开虚拟线程几乎无收益甚至有害；**IO 密集型 + 高并发等待**才是甜点区——典型如网关聚合、大量下游调用的 BFF、电力采集终端上报接入。

## 四、和响应式（WebFlux）怎么选

- 两者都为高并发 IO，但 WebFlux 要求**整条链非阻塞**（含所有依赖客户端），代码范式改造成本高、调试栈不直观。
- 虚拟线程让你**用熟悉的阻塞代码**拿到接近的吞吐，迁移成本极低。
- 经验：存量阻塞服务提并发优先虚拟线程；本就是响应式、或需要精细背压控制的流式场景继续 WebFlux。别混用（响应式链上再开虚拟线程意义不大）。

## 五、例子：pinning 与并发限流（正确用法与错误用法）

```java
// 例子目的：展示虚拟线程下两个高频陷阱的修复——synchronized 钉住、无限并发压垮连接池
import java.util.concurrent.*; import java.util.concurrent.locks.ReentrantLock;
class VirtualThreadDemo {
    static final Semaphore permits = new Semaphore(50);   // 正确用法：用信号量把并发限制在连接池容量内
    static final ReentrantLock lock = new ReentrantLock(); // 正确用法：锁用 ReentrantLock 而非 synchronized

    public static void main(String[] args) throws Exception {
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) { // 每任务一虚拟线程，廉价
            for (int i = 0; i < 10_000; i++) executor.submit(() -> {
                permits.acquire();                        // 先拿许可再访问下游
                try { return callDb(); } finally { permits.release(); }
            });
        } // try-with-resources 自动 close 并等待任务完成
    }
    static Object callDb() { return null; }
}
// 错误用法：不加信号量直接开 1 万虚拟线程冲 DB 连接池（只有十连接）→ 大量排队获取超时/DB 被打挂
// 错误用法：热点阻塞路径用 synchronized 块→ 虚拟线程在块内阻塞会钉住承载线程(pinning)，退化成占 OS 线程（-Djdk.tracePinnedThreads=full 可观测）
```

## 六、动手验证

1. 同一 IO 密集压测（下游 sleep 200ms），分别在 `spring.threads.virtual.enabled=false/true` 下对比 QPS 与 `http.server.requests` P99，观察承载线程数（`jcmd <pid> Thread.print`）几乎不变但并发大增。
2. 故意把 DB 连接池设为 10、并发打到 1000 虚拟线程，复现连接等待超时——体会"无限线程 vs 有限资源"的矛盾，加信号量限流修复。
3. 在阻塞路径写一段 `synchronized` + sleep，开 `-Djdk.tracePinnedThreads=full` 观察 pinning 告警，改 `ReentrantLock` 后消失。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 开虚拟线程后下游 DB 被打挂、连接耗尽 | 并发上限被放开，压垮了固定大小连接池/DB |
| 吞吐没提升 | 服务是 CPU 密集，虚拟线程帮不上 |
| 偶发大规模卡顿、承载线程饿死 | 大量 `synchronized` pinning（低版本 JDK） |
| 内存异常增长 | ThreadLocal 在海量虚拟线程上放大未清理 |

## 八、关联技术栈

- **JVM 层**：Project Loom 虚拟线程、结构化并发（Structured Concurrency）、`Thread.perTaskExecutor`
- **Boot 层**：`spring.threads.virtual.enabled`、`SimpleAsyncTaskExecutor`、内嵌容器线程模型
- **资源层**：HikariCP/连接池、限流与信号量（Resilience4j）
- **对比技术**：Spring WebFlux / Reactor（见 spring-mvc 包 s2-2）
- **可观测层**：`jcmd Thread.print`、pinning 追踪、Micrometer 线程指标
