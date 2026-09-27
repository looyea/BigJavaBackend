# 小测验 · REST 设计、全局异常与统一返回

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. 下列哪个最符合 REST 资源建模规范？（20分）

- A. `POST /addOrder`
- B. `GET /getOrderById?id=1`
- C. `DELETE /orders/{id}`
- D. `POST /updateOrderStatus`

> 答案：C
> 解析：URL 用名词、动作交给 HTTP 动词；`DELETE /orders/{id}` 语义正确，其余把动词写进了路径。

### 2. 关于幂等，下列说法正确的是？（20分）

- A. POST 天然幂等
- B. GET/PUT/DELETE 幂等，POST 需靠幂等键（如 Idempotency-Key）保证不重复
- C. 所有 HTTP 方法都不幂等
- D. 幂等只和数据库有关

> 答案：B
> 解析：重复提交高危的 POST 要用幂等键 + 去重存储实现"同一请求多次执行结果一致"。

### 3.（多选）一个健壮的全局异常处理 `@RestControllerAdvice` 应当？（25分）

- A. 对具体异常（如校验异常）优先声明专用 handler
- B. 有一个 `Throwable` 兜底 handler
- C. 对外响应不泄露堆栈/SQL，内部记 traceId
- D. 把异常 message 原样返回给客户端方便排查

> 答案：ABC
> 解析：D 是安全隐患，原始异常信息可能泄露内部结构，不能直接吐给外部。

### 4. Spring 6 / Boot 3 原生支持的标准化错误响应体是？（15分）

- A. 自研 Result
- B. RFC 7807 Problem Details（`ProblemDetail`）
- C. SOAP Fault
- D. HTTP 纯状态码无 body

> 答案：B
> 解析：`ProblemDetail` 提供 type/title/status/detail + 扩展属性，是可被机器识别的标准错误契约。

### 5. 判断题：把接口 HTTP 状态一律返回 200、错误只体现在 body 的 code 里，是推荐做法。（20分）

- A. 正确
- B. 错误

> 答案：B
> 解析：这会让网关、监控错误率、客户端重试等基于状态码的机制全部失效，应使用语义化 HTTP 状态码。
