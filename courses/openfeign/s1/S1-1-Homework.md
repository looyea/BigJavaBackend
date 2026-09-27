# Feign 调用链与超时重试陷阱 · 作业

## 作业 1：超时与重试叠加验证

**目标**：观察 Feign Retryer × LB Retry 实际请求次数。

1. 启动一个慢接口 `@GetMapping("/slow") Thread.sleep(6000)`。
2. 调用方配置：readTimeout=2000ms, Retryer maxAttempts=2, LB max-attempts=2。
3. 在被调方加日志打印每次请求时间戳 → 统计总请求次数。
4. 验证最坏情况 = 2×2 = 4 次实际到达。

## 作业 2：连接池对比

**目标**：对比默认 vs Apache HttpClient 性能差异。

1. 不加连接池（默认 HttpURLConnection），JMeter 200 并发打 10000 请求。
2. 开启 `feign.httpclient.enabled=true`，max-connections=200。
3. 对比两组 TP99 延迟和 TIME_WAIT 数量（`netstat -an | grep TIME_WAIT | wc -l`）。

## 作业 3：异步场景 Token 透传

**目标**：解决 @Async 中 RequestContextHolder 丢失问题。

1. 在主线程调用 @Async 方法 → 内部用 Feign 调下游 → 发现 Authorization Header 为空。
2. 方案 A：用 `TaskDecorator` 在主线程捕获 Request 属性传入子线程。
3. 方案 B：手动将 Token 作为方法参数传递 → Interceptor 中从自定义 ThreadLocal 读取。
4. 验证异步调用下游也收到正确 Token。
