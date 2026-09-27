# 小测验 · Actuator 与可观测性

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. 生产环境中，下列哪组 Actuator 端点最不该匿名暴露？（20分）

- A. `/health` 与 `/info`
- B. `/env`、`/configprops`、`/heapdump`
- C. `/metrics`
- D. `/beans`

> 答案：B
> 解析：这三者可能泄露密钥/内存快照，生产必须鉴权或关闭。

### 2. 把默认聚合了 DB 依赖的 `/actuator/health` 直接作为 K8s 存活探针（liveness），最可能导致什么？（20分）

- A. Pod 启动更慢
- B. 下游 DB 抖动时 Pod 被反复重启，而重启救不了 DB，引发雪崩
- C. 指标丢失
- D. 没有影响

> 答案：B
> 解析：liveness 只应反映进程是否卡死，依赖外部会导致误杀重启。

### 3. Micrometer 中，用来表示"只增不减"的请求总数/错误数的指标类型是？（20分）

- A. Gauge
- B. Timer
- C. Counter
- D. DistributionSummary

> 答案：C
> 解析：Counter 单调递增，Prometheus 中 rate 后得 QPS/错误率。

### 4.（多选）关于 Web 自动指标 `http.server.requests`，下列说法正确的有？（20分）

- A. 它是一个 Timer，tag 含 uri、method、status、outcome
- B. 路径变量必须归一为模板（如 `/orders/{id}`），否则高基数会打爆时序库
- C. 它是 QPS、P99、错误率的数据来源
- D. 它默认按每个具体 userId 打 tag，便于精细分析

> 答案：ABC
> 解析：D 错，把 userId 当 tag 会造成基数爆炸，是典型反模式。

### 5. 排障时想在运行期把某个包的日志级别临时改成 DEBUG，最合适的做法是？（20分）

- A. 改代码重新发布
- B. 调用 `/actuator/loggers` 端点动态调整，事后调回
- C. 重启 JVM 并加 `-D` 参数
- D. 修改 logback.xml 后热部署

> 答案：B
> 解析：`/loggers` 支持运行期动态改级别，是排障利器，用完须调回防打爆磁盘。
