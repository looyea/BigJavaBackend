# Actuator 与可观测性

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：说得清 Actuator 在生产环境里承担什么、哪些端点绝不能裸奔；能用 Micrometer 建立"指标三件套"的思维；能设计健康检查分组以适配 K8s 就绪/存活探针。

## 一、Actuator 是什么：把运行时暴露成端点

Actuator 不是监控平台，而是**把应用内部状态以 HTTP/JMX 端点暴露出来**的机制，真正的观测靠把这些端点接给 Prometheus、日志平台、告警。Boot 引入 `spring-boot-starter-actuator` 后即得一批 `@Endpoint` Bean。

- 默认只开放 `/actuator/health`（Web 下），其余需 `management.endpoints.web.exposure.include` 显式放开。
- **安全红线**：`/env`、`/configprops`、`/heapdump`、`/threaddump`、`/loggers`、`/shutdown` 可能泄露密钥或造成 DoS，生产环境绝不能匿名暴露，必须走独立管理端口 + 鉴权。

| 端点 | 作用 | 生产暴露建议 |
| --- | --- | --- |
| `/health` | 健康聚合 | 暴露，但 details 按需 |
| `/info` | 应用元信息 | 可暴露 |
| `/metrics`、`/prometheus` | 指标 | 内网暴露给采集 |
| `/env`、`/configprops` | 配置 | 严格鉴权或关闭 |
| `/loggers` | 动态改日志级别 | 受控使用（排障利器） |
| `/heapdump` | 堆转储 | 生产禁用或强鉴权 |
| `/shutdown` | 优雅关闭 | 默认关闭 |

## 二、健康检查与 K8s 探针：一个常见设计误区

`/actuator/health` 默认把所有 `HealthIndicator`（DB、Redis、磁盘……）聚合成 UP/DOWN。若直接把它当 K8s **存活探针（liveness）**，一旦下游 DB 抖动，Pod 会被判失败并**重启**——而重启根本救不了 DB，反而雪崩。

正确分组：

- **liveness（存活）**：只反映"进程是否卡死"，不应依赖外部。配 `management.endpoint.health.group.liveness.include=livenessState`。
- **readiness（就绪）**：反映"能否接流量"，可含 DB/MQ 依赖。配 `readiness` 组 + 关键依赖 indicator。

```yaml
# 例子目的：把存活/就绪探针拆开，避免下游 DB 抖动时 Pod 被误杀重启
management:
  endpoint:
    health:
      probes:
        enabled: true          # 开启 /actuator/health/liveness 与 /readiness 子端点
      group:
        readiness:
          include: readinessState,db,redis   # 就绪含外部依赖：DB 挂→readiness DOWN→摘流量但不重启
        liveness:
          include: livenessState             # 存活只看进程状态，不依赖外部
  health:
    livenessstate:
      enabled: true            # 暴露应用自身 LivenessState（仅进程卡死才 DOWN）
    readinessstate:
      enabled: true            # 暴露 ReadinessState
# 正确使用结果：DB 不可用时 /health/readiness=DOWN、/health/liveness=UP → K8s 摘流量而不重启
# 错误用法：把含 db 的 /health 直接当 liveness → 下游抖一下就被判失败反复重启，雪崩
```

## 三、Micrometer：指标的门面层

Actuator 的 `/metrics` 背后是 **Micrometer**——"指标门面"，屏蔽 Prometheus/Datadog/CloudWatch 的差异。理解三种核心类型即可撑起大部分场景：

- **Counter**：只增，如请求总数、错误数（Prometheus 里 rate 后得 QPS/错误率）。
- **Gauge**：瞬时值，如线程池活跃数、连接池占用、JVM 堆用量。
- **Timer / DistributionSummary**：带分布的耗时/大小，自动产出 count、total、max 及（开启时）百分位直方图。

**Web 指标开箱即用**：引入后自动埋 `http.server.requests` Timer，tag 含 `uri`、`method`、`status`、`outcome`——这就是你 QPS、P99、错误率的数据源。注意 `uri` tag 要对路径变量做模板归一（`/orders/{id}` 而非 `/orders/123`），否则高基数把时序库打爆。

## 四、可观测性三支柱在本节的位置

- **Metrics（指标）**：Actuator + Micrometer，本节重点——低成本、可聚合、适合告警趋势。
- **Tracing（链路）**：Micrometer Tracing（Boot 3 取代 Spring Cloud Sleuth）产出 traceId/spanId，串联跨服务调用；与日志通过 MDC 关联。
- **Logging（日志）**：`/loggers` 端点可运行期动态调级别，排障时把某包临时开 DEBUG，事后务必调回。

结构化日志 + traceId 落地：`logging.pattern` 里带上 `${spring.application.name}`、traceId，让 ELK/Loki 能按 traceId 拉全链路。

## 五、例子：Micrometer 自定义指标（正确用法与错误用法）

```java
// 例子目的：用 Counter/Gauge/Timer 埋业务指标，并暴露高基数陷阱
import io.micrometer.core.instrument.*;
@Service
class OrderMetrics {
    private final Counter created;          // 只增：下单总数
    private final Timer latency;            // 带分布：下单耗时（自动出 count/total/max）
    OrderMetrics(MeterRegistry reg) {
        created = Counter.builder("order.created").tag("channel", "app").register(reg); // 低基数固定 tag
        latency = Timer.builder("order.latency").publishPercentileHistogram().register(reg); // 开直方图才能出 P99
        Gauge.builder("order.pool.active", this, s -> activeCount()).register(reg); // Gauge 传"取值函数"，非快照
    }
    public long place() { return latency.record(() -> { created.increment(); return doPlace(); }).longValue(); }
    int activeCount() { return 0; }
    long doPlace() { return 1L; }
}
// 正确使用结果：/actuator/metrics/order.latency 可读到 P99；order.created 单调递增可 rate() 出 QPS
// 错误用法：给 Counter 打 userId 这类高基数 tag→ 每个用户一条时间序列→ Prometheus 内存打爆（tag 必须低基数）
// 错误用法：Gauge 传入一个"当前值快照"数字而非取值函数→ 指标永远不动（Gauge 要持强引用回调）
// 错误用法：不开 publishPercentileHistogram→ /health 里拿不到 P99，只能拿到 mean
```

## 六、动手验证

1. 只引入 actuator，访问 `/actuator` 看默认暴露了哪些端点；再配置 `exposure.include=*`（本地）看全量。
2. 用 `/actuator/metrics/http.server.requests` + tag 过滤，验证 QPS/P99 数据来源；打一轮压测后 `rate` 出错误率。
3. 制造 DB 不可用，分别访问 `/health`、`/health/liveness`、`/health/readiness`，验证"DB 挂只影响 readiness 不影响 liveness"，从而不被误杀重启。
4. 通过 `/actuator/loggers/com.bigjava` POST 把级别从 INFO 改 DEBUG，观察日志变化，再改回。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| Pod 频繁重启 | 把 `/health`（含 DB）当 liveness，下游抖动即被杀 |
| Prometheus 时序暴涨/内存打满 | `uri`/`tag` 高基数（未归一路径变量、把 userId 当 tag） |
| `/metrics` 拿不到某业务指标 | Timer 未开 `publishPercentileHistogram`，或 MeterRegistry 未正确绑定 |
| 管理端点被扫描泄露 env | 未隔离管理端口、未鉴权 |
| 动态改日志后忘调回 | 缺自动化，DEBUG 打爆磁盘 |

## 八、关联技术栈

- **Boot 层**：`spring-boot-starter-actuator`、`management.*` 配置
- **指标层**：Micrometer、Prometheus、Grafana
- **链路层**：Micrometer Tracing、OpenTelemetry、Zipkin/SkyWalking
- **日志层**：Logback 结构化输出、ELK/Loki
- **云原生层**：K8s liveness/readiness/startup 探针、独立 `management.server.port`
