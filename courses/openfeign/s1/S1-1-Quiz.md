# Feign 调用链与超时重试陷阱 · 小测

### 1. Feign 默认使用的 HTTP 客户端是？（6分）

- A. OkHttp
- B. Apache HttpClient
- C. java.net.HttpURLConnection
- D. Netty

> 答案：C
> 解析：默认无连接池；需显式引入 httpclient/okhttp 依赖并开启。

### 2. readTimeout 指什么？（6分）

- A. 建立 TCP 连接的超时
- B. 等待服务端返回数据的最大时间
- C. 整个请求含重试的总时间
- D. DNS 解析超时

> 答案：B
> 解析：connect=建连，read=等首字节/响应体。

### 3. Feign Retryer.Default(100,500,3) 的含义是？（6分）

- A. 重试间隔 100-500ms，最多 3 次
- B. 超时 100ms，重试 500 次
- C. 3 秒后重试
- D. 最大线程 3

> 答案：A
> 解析：period=初始间隔，maxPeriod=最大退避间隔，maxAttempts=总尝试次数。

### 4. Feign(3次)× LB(3次) 的重试叠加最坏导致？（6分）

- A. 响应变慢但不影响正确性
- B. 非幂等接口重复执行（如多次扣款）
- C. 连接池泄漏
- D. 正常行为

> 答案：B
> 解析：重试对调用方透明，但对被调方是真实重复请求。

### 5. RequestInterceptor 在异步线程中失效原因是？（6分）

- A. 网络不通
- B. RequestContextHolder 用 ThreadLocal 存储，子线程无法获取
- C. Feign 不支持异步
- D. 拦截器不执行

> 答案：B
> 解析：@Async/CompletableFuture 切换线程 → ThreadLocal 丢失 → 需手动传递或 InheritableThreadLocal。

### 6. 以下哪种 NOT 是 Feign 支持的连接池实现？（6分）

- A. Apache HttpClient
- B. OkHttp
- C. HikariCP
- D. Java 11 HttpClient

> 答案：C
> 解析：HikariCP 是数据库连接池，非 HTTP 连接池。

### 7. @FeignClient 中 fallback 生效需要开启什么？（6分）

- A. feign.retry.enabled=true
- B. feign.circuitbreaker.enabled=true（或 Sentinel/Hystrix 集成）
- C. 无需额外配置
- D. ribbon.enabled=true

> 答案：B
> 解析：OpenFeign 本身不做熔断，需开启 CircuitBreaker 才触发 fallback。

### 8. Feign 超时设置的正确做法包括（多选）？（9分）

- A. 调用方 readTimeout > 被调方处理时间
- B. 全局 default + 特定 client 覆盖
- C. 所有接口统一 60s 超时
- D. 慢接口单独配更长超时

> 答案：A、B、D
> 解析：C 不合理——快接口 60s 超时掩盖问题。

### 9. 关于 Feign 日志级别说法正确的是（多选）？（9分）

- A. NONE 默认，不记录
- B. BASIC 只记录方法+URL+状态码+耗时
- C. FULL 记录请求/响应 Body
- D. FULL 适合生产环境长期使用

> 答案：A、B、C
> 解析：D 错——FULL 性能开销大且泄露敏感数据，仅调试用。

### 10. 简答题：线上反馈"Feign 调用间歇性超时"，给出排查步骤与解决方案。（40分）

- 要点1：确认是 connect 超时还是 read 超时（日志中 SocketTimeoutException 区分）
- 要点2：connect 超时→目标服务不可达/连接池耗尽→检查 Nacos 健康实例数
- 要点3：read 超时→目标服务处理慢→检查 GC/慢 SQL/线程池满
- 要点4：网络层：ping/traceroute 确认跨机房延迟
- 要点5：优化：开启连接池+合理超时+熔断降级+链路追踪定位瓶颈

> 答案：见要点
> 解析：间歇性超时通常是下游 GC/网络抖动，需分层排查。
