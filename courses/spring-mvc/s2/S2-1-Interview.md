# 实际面试题 · REST 设计、全局异常与统一返回

## 题 1：你们 API 是"全 200 + body 里 code"还是用语义化状态码？怎么选？

**考察层次**：初级二选一背；中级能讲各自代价；高级能从网关/监控/客户端生态谈取舍。

**参考答法**：

1. 纯"HTTP 永远 200、错误看 body.code"的好处是客户端处理统一，但代价惨重：网关限流/熔断、监控错误率、重试策略、CDN、标准 HTTP 客户端全部依赖状态码，被你抹平了。
2. 推荐：**对外 API 用语义化 HTTP 状态码 + RFC 7807 ProblemDetail**；内部微服务可视团队习惯用统一 `Result`，但也应让状态码承载"传输层结果"、code 承载"业务细分码"，二者不互相替代。
3. 关键是分层：4xx（客户端错）与 5xx（服务端错）必须真实，否则可观测性和稳定性建设无从谈起。

**追问**：422 和 400 区别？→ 400 请求格式/语法就不对（坏 JSON、缺参）；422 语法对但语义/校验不通过（字段值非法）。

## 题 2：全局异常处理怎么设计才不会漏、又不泄露信息？

**答题要点**：`@RestControllerAdvice` 里按"具体异常优先"注册专用 handler（校验、业务、鉴权…），最后必有一个 `Throwable` 兜底；对外返回标准错误体（ProblemDetail）含 traceId，**绝不回传堆栈/SQL/内部 message**；完整异常用 logger 带 traceId 落内部日志。注意：Spring Security 抛在 DispatcherServlet 之前的认证/授权异常，普通 `@ExceptionHandler` 抓不到，要配 `AuthenticationEntryPoint`/`AccessDeniedHandler`。

## 题 3：POST 下单接口怎么防重复提交？

**结构化回答**：

1. 幂等三要素：唯一幂等键（客户端生成 `Idempotency-Key` 或由业务唯一键）、服务端去重存储、结果可重放。
2. 实现：Redis `SETNX(key, "PROCESSING", TTL)` 抢锁 → 处理 → 存最终结果；重复请求命中已有 key 直接返回已存结果或告知"处理中"。
3. 边角：处理中途失败要删除/置失败态 key 允许重试；TTL 要覆盖最大处理时长；高并发下配合 DB 唯一约束兜底。
4. 金融：叠加账户/流水级唯一索引，做"防重 + 对账"双保险。

## 题 4：API 要演进，怎么升级才不打挂老客户端？

**答题要点**：区分**兼容变更**（新增可选字段、新增枚举需考虑老客户端解析、放宽校验）与**破坏性变更**（删字段、改类型/语义、收紧必填）。兼容变更在同一小版本灰度发布即可；破坏性变更开新版本（`/v1`→`/v2`），制定弃用期、双版本并行、下线公告与流量监控。契约测试（如 OpenAPI + schema 校验 / Pact）把它挡在 CI。

## 高频追问速答

1. `@ControllerAdvice` 和 `@RestControllerAdvice` 区别？→ 后者 = 前者 + `@ResponseBody`， handler 直接返回 body（REST 用）。
2. 多个 Advice 命中同一异常谁赢？→ 按 `@Order` 与异常类型的最近匹配；具体异常处理器优先。
3. PATCH 和 PUT 区别？→ PUT 全量替换、幂等；PATCH 局部更新、是否幂等取决于实现（用 JSON Merge Patch/JSON Patch）。
4. 统一返回体该不该带 traceId？→ 应该，前端/客服报障时可凭 traceId 秒定位全链路日志。
5. 健康检查、下载接口为什么不能套统一返回？→ 它们不是业务 JSON，被 Advice 包装会破坏协议（下载变 JSON、探针解析失败），要排除。
